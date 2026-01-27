/**
 * ZERØ Diagnostics Worker
 * Cloudflare Worker + R2 for receiving opt-in diagnostics uploads.
 *
 * Endpoints:
 *   GET  /health                  – liveness check
 *   POST /v1/zero/ingest          – receive upload packet
 *   GET  /v1/zero/list?limit=N    – list stored packets (dev only)
 *   GET  /v1/zero/get/<key>       – retrieve a stored packet (dev only)
 *
 * Environment bindings:
 *   env.ZERO_R2       – R2 bucket
 *   env.ZERO_API_KEY  – optional shared secret (if empty, open ingest)
 */

const MAX_BODY_BYTES = 512 * 1024; // 512 KB logical cap
const MAX_EVENTS_DELTA = 5000;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Zero-Client-Id, X-Zero-Version, X-Zero-Api-Key',
    'Access-Control-Max-Age': '86400',
  };
}

function withCors(response, request) {
  const cors = corsHeaders(request);
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(cors)) {
    res.headers.set(k, v);
  }
  return res;
}

function requireApiKey(request, env) {
  const key = env.ZERO_API_KEY;
  if (!key) return true; // no key configured → open access
  return request.headers.get('X-Zero-Api-Key') === key;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleHealth() {
  return json({ ok: true, ts: Date.now() });
}

async function handleIngest(request, env) {
  // Size guard
  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'Payload too large' }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  // Validate required fields
  const required = ['clientId', 'uploadId', 'createdAt', 'schemaVersion', 'extensionVersion', 'eventsDelta'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return json({ ok: false, error: `Missing required field: ${field}` }, 400);
    }
  }

  // Validate eventsDelta is an array with bounded length
  if (!Array.isArray(body.eventsDelta)) {
    return json({ ok: false, error: 'eventsDelta must be an array' }, 400);
  }
  if (body.eventsDelta.length > MAX_EVENTS_DELTA) {
    return json({ ok: false, error: `eventsDelta exceeds max length of ${MAX_EVENTS_DELTA}` }, 400);
  }

  // Validate clientId format (non-empty string, reasonable length)
  if (typeof body.clientId !== 'string' || body.clientId.length < 1 || body.clientId.length > 128) {
    return json({ ok: false, error: 'Invalid clientId' }, 400);
  }

  // Build R2 object key
  const ts = typeof body.createdAt === 'number' ? body.createdAt : Date.now();
  const safeClientId = body.clientId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
  const safeUploadId = String(body.uploadId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
  const objectKey = `uploads/${safeClientId}/${ts}_${safeUploadId}.json`;

  // Store in R2
  try {
    await env.ZERO_R2.put(objectKey, JSON.stringify(body), {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: {
        clientId: safeClientId,
        extensionVersion: String(body.extensionVersion).substring(0, 32),
        eventCount: String(body.eventsDelta.length),
      },
    });
  } catch (err) {
    console.error('R2 put failed:', err);
    return json({ ok: false, error: 'Storage error' }, 500);
  }

  return json({ ok: true, key: objectKey });
}

async function handleList(request, env) {
  const url = new URL(request.url);
  let limit = parseInt(url.searchParams.get('limit') || String(DEFAULT_LIST_LIMIT), 10);
  limit = Math.min(Math.max(1, limit), MAX_LIST_LIMIT);

  const clientId = url.searchParams.get('clientId');
  const prefix = clientId
    ? `uploads/${clientId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64)}/`
    : 'uploads/';

  try {
    const listed = await env.ZERO_R2.list({ prefix, limit });
    const keys = listed.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded?.toISOString() || null,
    }));
    return json({ ok: true, count: keys.length, keys });
  } catch (err) {
    console.error('R2 list failed:', err);
    return json({ ok: false, error: 'Storage error' }, 500);
  }
}

async function handleGet(request, env, objectKey) {
  if (!objectKey || objectKey.length < 5) {
    return json({ ok: false, error: 'Invalid key' }, 400);
  }

  try {
    const obj = await env.ZERO_R2.get(objectKey);
    if (!obj) {
      return json({ ok: false, error: 'Not found' }, 404);
    }
    const data = await obj.json();
    return json({ ok: true, key: objectKey, data });
  } catch (err) {
    console.error('R2 get failed:', err);
    return json({ ok: false, error: 'Storage error' }, 500);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health (no auth required)
    if (path === '/health' && request.method === 'GET') {
      return withCors(await handleHealth(), request);
    }

    // Ingest (API key optional depending on config)
    if (path === '/v1/zero/ingest' && request.method === 'POST') {
      // If API key is configured, enforce it for ingest too
      if (!requireApiKey(request, env)) {
        return withCors(json({ ok: false, error: 'Unauthorized' }, 401), request);
      }
      return withCors(await handleIngest(request, env), request);
    }

    // List (always requires API key if configured)
    if (path === '/v1/zero/list' && request.method === 'GET') {
      if (!requireApiKey(request, env)) {
        return withCors(json({ ok: false, error: 'Unauthorized' }, 401), request);
      }
      return withCors(await handleList(request, env), request);
    }

    // Get (always requires API key if configured)
    if (path.startsWith('/v1/zero/get/') && request.method === 'GET') {
      if (!requireApiKey(request, env)) {
        return withCors(json({ ok: false, error: 'Unauthorized' }, 401), request);
      }
      const objectKey = decodeURIComponent(path.replace('/v1/zero/get/', ''));
      return withCors(await handleGet(request, env, objectKey), request);
    }

    return withCors(json({ ok: false, error: 'Not found' }, 404), request);
  },
};

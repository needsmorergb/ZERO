# ZERØ Diagnostics Worker — Deployment

## Prerequisites
- Node.js 18+
- Cloudflare account with an existing R2 bucket
- `wrangler` CLI: `npm install -g wrangler`

## Setup

1. **Update `wrangler.toml`** — replace `<R2_BUCKET_NAME>` with your actual R2 bucket name.

2. **Authenticate:**
   ```bash
   wrangler login
   ```

3. **(Optional) Set API key as a secret:**
   ```bash
   wrangler secret put ZERO_API_KEY
   ```
   Enter your chosen key when prompted. If you skip this, the worker runs in open-ingest mode.

4. **Deploy:**
   ```bash
   cd worker
   wrangler deploy
   ```

5. **Verify:**
   ```bash
   curl https://<WORKER_URL>/health
   # → {"ok":true,"ts":...}
   ```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Liveness check |
| POST | `/v1/zero/ingest` | API key (if set) | Receive upload packet |
| GET | `/v1/zero/list?limit=50&clientId=<id>` | API key (if set) | List stored packets |
| GET | `/v1/zero/get/<encodedKey>` | API key (if set) | Retrieve a stored packet |

## Extension Configuration

Set the extension's diagnostics endpoint URL to:
```
https://<WORKER_URL>/v1/zero/ingest
```

## Reviewing Data

```bash
# List recent uploads
curl -H "X-Zero-Api-Key: YOUR_KEY" "https://<WORKER_URL>/v1/zero/list?limit=20"

# Get a specific packet
curl -H "X-Zero-Api-Key: YOUR_KEY" "https://<WORKER_URL>/v1/zero/get/uploads/clientXYZ/1706000000000_upload123.json"
```

## R2 Retention

For beta, keep raw packets 30–90 days. Add lifecycle rules in R2 dashboard later:
- Cloudflare Dashboard → R2 → Bucket → Settings → Object lifecycle rules

## CORS

The worker allows all origins for beta (`Access-Control-Allow-Origin` echoes the request origin).
For production, restrict to your extension's origin.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 Unauthorized | Check `X-Zero-Api-Key` header matches the secret |
| 413 Payload too large | Reduce packet size (max 512 KB) |
| CORS errors | Ensure the worker is deployed and the extension has `host_permissions` for the worker domain |
| R2 errors | Verify bucket name in `wrangler.toml` matches your R2 bucket |

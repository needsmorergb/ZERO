/**
 * Shared Proxy Fetch Utility
 * Routes all extension network calls through the background service worker
 * to avoid CORS restrictions in content scripts.
 *
 * Uses chrome.runtime.sendMessage({ type: 'PROXY_FETCH' }).
 * Handles extension context invalidation gracefully.
 */

/**
 * Send a proxied fetch request via the background service worker.
 * @param {string} url - Fully qualified URL to fetch
 * @param {RequestInit} [options] - Fetch options (method, headers, body)
 * @returns {Promise<{ ok: boolean, data?: any, error?: string, status?: number }>}
 */
export async function proxyFetch(url, options) {
    try {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
            return { ok: false, error: 'Chrome runtime not available' };
        }

        return await chrome.runtime.sendMessage({
            type: 'PROXY_FETCH',
            url,
            options: options || { method: 'GET' }
        });
    } catch (e) {
        const msg = e?.message || '';
        // Extension context invalidated — non-fatal
        if (msg.includes('context invalidated') || msg.includes('Receiving end does not exist')) {
            return { ok: false, error: 'context_invalidated' };
        }
        return { ok: false, error: msg || 'Proxy fetch failed' };
    }
}

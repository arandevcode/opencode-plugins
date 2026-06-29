/**
 * HTTP utilities for provider API calls.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
/**
 * Fetch with timeout using AbortController.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (headers, method, body, etc.)
 * @param timeoutMs - Timeout in milliseconds
 * @returns The fetch Response
 * @throws Error with message "Request timeout after Xs" if request times out
 */
export async function fetchWithTimeout(url, options, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    }
    catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new Error(`Request timeout after ${Math.round(timeoutMs / 1000)}s`);
        }
        throw err;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
//# sourceMappingURL=http.js.map
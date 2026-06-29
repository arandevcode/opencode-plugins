/**
 * HTTP utilities for provider API calls.
 */
export declare const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
/**
 * Fetch with timeout using AbortController.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (headers, method, body, etc.)
 * @param timeoutMs - Timeout in milliseconds
 * @returns The fetch Response
 * @throws Error with message "Request timeout after Xs" if request times out
 */
export declare function fetchWithTimeout(url: string, options: RequestInit, timeoutMs?: number): Promise<Response>;
//# sourceMappingURL=http.d.ts.map
/**
 * Display sanitization for user-visible toast output.
 *
 * Mirrors the upstream `@slkiser/opencode-quota` helper of the same name:
 * strips ANSI escape sequences and control characters (except newline/tab)
 * so that provider error text cannot inject terminal control codes into
 * toasts or transcript output.
 */
// eslint-disable-next-line no-control-regex
const DISPLAY_CONTROL_RE = /\x1B\[[0-9;]*[A-Za-z]|[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
export function sanitizeDisplayText(text) {
    return text.replace(DISPLAY_CONTROL_RE, "");
}
//# sourceMappingURL=sanitize.js.map
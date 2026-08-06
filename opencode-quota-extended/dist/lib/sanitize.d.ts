/**
 * Display sanitization for user-visible toast output.
 *
 * Mirrors the upstream `@slkiser/opencode-quota` helper of the same name:
 * strips ANSI escape sequences and control characters (except newline/tab)
 * so that provider error text cannot inject terminal control codes into
 * toasts or transcript output.
 */
export declare function sanitizeDisplayText(text: string): string;
//# sourceMappingURL=sanitize.d.ts.map
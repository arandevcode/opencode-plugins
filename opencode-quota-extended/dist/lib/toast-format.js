import { formatResetRelative, clampPercent } from "./reset-format.js";
function padRight(text, width) {
    if (text.length >= width)
        return text;
    return text + " ".repeat(width - text.length);
}
function padLeft(text, width) {
    if (text.length >= width)
        return text;
    return " ".repeat(width - text.length) + text;
}
function formatProviderHeader(provider) {
    return provider.label;
}
function formatWindowLine(provider, window, now) {
    const label = padRight(window.label, 7);
    const countdown = formatResetRelative(window.resetTimeIso, now);
    const reset = padRight(countdown, 11);
    const percent = `${clampPercent(window.percentRemaining)}%`;
    const percentCell = padLeft(percent, 4);
    // Copilot exposes remaining/total counts — surface them after the percent.
    let suffix = "";
    if (provider.id === "github-copilot" &&
        typeof window.remaining === "number" &&
        typeof window.total === "number") {
        suffix = ` (${window.remaining}/${window.total})`;
    }
    return `  ${label} ${reset} ${percentCell}${suffix}`;
}
function formatProviderBlock(provider, now) {
    if (provider.status !== "ok" || provider.windows.length === 0)
        return [];
    const lines = [{ text: formatProviderHeader(provider) }];
    for (const window of provider.windows) {
        lines.push({ text: formatWindowLine(provider, window, now) });
    }
    return lines;
}
function formatProviderError(provider) {
    if (provider.status === "ok")
        return null;
    // Skip purely "skipped" providers (no auth configured) — they would spam
    // the toast every time it fires. Surface only real errors.
    if (provider.status === "skipped" || provider.status === "no-auth") {
        return null;
    }
    const reason = provider.error ?? provider.status;
    return { text: `${provider.label}: ${reason}` };
}
/**
 * Render a CardsSnapshot to a multi-line toast string, or `null` if there
 * is nothing meaningful to display.
 */
export function formatToastMessage(snapshot, opts = {}) {
    const now = opts.now ?? new Date();
    const maxWidth = opts.maxLineWidth ?? 60;
    const lines = [];
    for (const provider of snapshot.providers) {
        const block = formatProviderBlock(provider, now);
        if (block.length > 0) {
            lines.push(...block);
        }
    }
    const errors = [];
    for (const provider of snapshot.providers) {
        const err = formatProviderError(provider);
        if (err)
            errors.push(err);
    }
    if (errors.length > 0) {
        if (lines.length > 0)
            lines.push({ text: "" });
        lines.push(...errors);
    }
    if (lines.length === 0)
        return null;
    return lines.map((l) => l.text.slice(0, maxWidth)).join("\n");
}
//# sourceMappingURL=toast-format.js.map
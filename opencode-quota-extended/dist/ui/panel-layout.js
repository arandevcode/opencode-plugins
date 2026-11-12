export function panelLayout(providers, activeProviderId) {
    const cards = [];
    const unconfigured = [];
    for (const provider of providers) {
        if (provider.status === "skipped" && provider.id !== activeProviderId) {
            unconfigured.push(provider);
        }
        else {
            cards.push(provider);
        }
    }
    const ready = cards.filter((p) => p.status === "ok" || p.status === "stale").length;
    return { cards, unconfigured, ready, total: cards.length };
}
/** Text of the collapsed line, e.g. "not set up: OpenAI". */
export function unconfiguredSummary(unconfigured) {
    return `not set up: ${unconfigured.map((p) => p.label).join(", ")}`;
}
//# sourceMappingURL=panel-layout.js.map
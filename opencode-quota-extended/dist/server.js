export const quotaCardsServerPlugin = async () => {
    return {};
};
const plugin = {
    id: "@local/opencode-quota-extended",
    server: quotaCardsServerPlugin,
    async setup(ctx) {
        // OpenCode 1.19.x calls setup() too, but without the V2 context.
        if (!ctx?.storage || !ctx?.location)
            return;
        // V2 has no server-side quota work. The TUI cards are still V1-only;
        // this entry point exists so V2 can load the package without error.
    },
};
export default plugin;
//# sourceMappingURL=server.js.map
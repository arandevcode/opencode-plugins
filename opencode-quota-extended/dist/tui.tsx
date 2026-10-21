/** @jsxImportSource @opentui/solid */
import { createSignal, ErrorBoundary } from "solid-js";
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { loadCardsConfig } from "./config/loader.js";
import { createRefreshScheduler } from "./lib/refresh-scheduler.js";
import { collectSnapshot } from "./providers/registry.js";
import { SidebarPanel } from "./ui/SidebarPanel.js";

const REFRESH_INTERVAL_MS = 60_000;
const MOUNT_RECOVERY_DELAY_MS = 1_500;

type CardsSnapshot = Awaited<ReturnType<typeof collectSnapshot>>;

export const quotaCardsTuiPlugin: TuiPlugin = async (api, _options, _meta) => {
  try {
    const loaded = await loadCardsConfig();
    const config = loaded.config;

    if (!config.enabled || !config.cardsSidebar.enabled) {
      return;
    }

    // Quota is account-wide, not per session: one shared snapshot and one
    // poller serve every mounted sidebar instead of one per session.
    const [snapshot, setSnapshot] = createSignal<CardsSnapshot>({
      generatedAt: new Date(0).toISOString(),
      providers: [],
    });

    let inFlight = false;
    let queued = false;
    let version = 0;
    let disposed = false;

    const reload = () => {
      if (disposed) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      const v = ++version;
      collectSnapshot(config).then((next) => {
        if (v === version && !disposed) setSnapshot(next);
      }).catch((err) => {
        const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
        try { process.stderr.write(`[quota-cards] snapshot refresh failed: ${msg}\n`); } catch {}
      }).finally(() => {
        inFlight = false;
        if (queued) { queued = false; reload(); }
      });
    };

    const scheduler = createRefreshScheduler({
      refresh: reload,
      intervalMs: config.refreshIntervalMs ?? REFRESH_INTERVAL_MS,
    });
    const unsubs = [
      api.event.on("session.updated", () => scheduler.schedule()),
      api.event.on("message.updated", () => scheduler.schedule()),
      api.event.on("message.removed", () => scheduler.schedule()),
      api.event.on("tui.session.select", () => scheduler.schedule()),
    ];

    const dispose = () => {
      disposed = true;
      scheduler.dispose();
      for (const u of unsubs) u();
    };
    api.lifecycle.onDispose(dispose);

    scheduler.start();
    reload();
    scheduler.schedule(MOUNT_RECOVERY_DELAY_MS, true);

    function SidebarContentView() {
      return <SidebarPanel api={api} config={config} snapshot={snapshot} />;
    }

    api.slots.register({
      order: config.cardsSidebar.order,
      slots: {
        sidebar_content(_ctx: unknown, _props: { session_id: string }) {
          return (
            <ErrorBoundary fallback={<text fg={api.theme.current.error}>Quota error</text>}>
              <SidebarContentView />
            </ErrorBoundary>
          );
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    try { process.stderr.write(`[quota-cards] tui plugin: FATAL ${msg}\n`); } catch {}
  }
};

const pluginModule: TuiPluginModule & { id: string } = {
  id: "@local/opencode-quota-extended",
  tui: quotaCardsTuiPlugin,
};

export default pluginModule;

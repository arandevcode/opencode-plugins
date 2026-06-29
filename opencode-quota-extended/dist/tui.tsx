/** @jsxImportSource @opentui/solid */
import { createSignal, onCleanup } from "solid-js";
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { loadCardsConfig } from "./config/loader.js";
import { collectSnapshot } from "./providers/registry.js";
import { SidebarPanel } from "./ui/SidebarPanel.js";

const REFRESH_INTERVAL_MS = 60_000;
const EVENT_REFRESH_DELAYS_MS = [150, 600] as const;
const MOUNT_RECOVERY_DELAYS_MS = [500, 1500, 4000] as const;

type CardsSnapshot = Awaited<ReturnType<typeof collectSnapshot>>;

export const quotaCardsTuiPlugin: TuiPlugin = async (api, _options, _meta) => {
  try {
    const loaded = await loadCardsConfig();
    const config = loaded.config;

    if (!config.enabled || !config.cardsSidebar.enabled) {
      return;
    }

    const sessionResources = new Map<string, {
      snapshot: () => CardsSnapshot;
      dispose: () => void;
    }>();

    function acquire(sessionID: string) {
      const existing = sessionResources.get(sessionID);
      if (existing) return existing;

      const [snapshot, setSnapshot] = createSignal<CardsSnapshot>({
        generatedAt: new Date(0).toISOString(),
        providers: [],
      });

      let inFlight = false;
      let queued = false;
      let version = 0;
      const timers = new Set<ReturnType<typeof setTimeout>>();

      const reload = () => {
        if (inFlight) {
          queued = true;
          version += 1;
          return;
        }
        inFlight = true;
        const v = ++version;
        collectSnapshot(config).then((next) => {
          if (v === version) setSnapshot(next);
        }).catch(() => {}).finally(() => {
          inFlight = false;
          if (queued) { queued = false; reload(); }
        });
      };

      const queueRefresh = (delay: number) => {
        const t = setTimeout(() => { timers.delete(t); reload(); }, delay);
        timers.add(t);
      };
      const scheduleRefresh = () => {
        for (const d of EVENT_REFRESH_DELAYS_MS) queueRefresh(d);
      };
      const scheduleMountRecovery = () => {
        for (const d of MOUNT_RECOVERY_DELAYS_MS) queueRefresh(d);
      };

      const interval = setInterval(reload, config.refreshIntervalMs ?? REFRESH_INTERVAL_MS);
      const unsubs = [
        api.event.on("session.updated", (e) => { if (e?.properties?.info?.id === sessionID) scheduleRefresh(); }),
        api.event.on("message.updated", (e) => { if (e?.properties?.info?.sessionID === sessionID) scheduleRefresh(); }),
        api.event.on("message.removed", (e) => { if (e?.properties?.sessionID === sessionID) scheduleRefresh(); }),
        api.event.on("tui.session.select", (e) => { if (e?.properties?.sessionID === sessionID) scheduleRefresh(); }),
      ];

      reload();
      scheduleMountRecovery();

      const dispose = () => {
        clearInterval(interval);
        for (const t of timers) clearTimeout(t);
        timers.clear();
        for (const u of unsubs) u();
        sessionResources.delete(sessionID);
      };

      const resource = { snapshot, dispose };
      sessionResources.set(sessionID, resource);
      return resource;
    }

    function SidebarContentView(props: { sessionID: string }) {
      const r = acquire(props.sessionID);
      onCleanup(() => {
        r.dispose();
      });

      return <SidebarPanel api={api} config={config} snapshot={r.snapshot} />;
    }

    api.slots.register({
      order: config.cardsSidebar.order,
      slots: {
        sidebar_content(_ctx: unknown, props: { session_id: string }) {
          return <SidebarContentView sessionID={props.session_id} />;
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

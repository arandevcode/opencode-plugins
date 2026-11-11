/** @jsxImportSource @opentui/solid */
import { createSignal, ErrorBoundary } from "solid-js";
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { loadCardsConfig } from "./config/loader.js";
import { createRefreshScheduler } from "./lib/refresh-scheduler.js";
import { collectSnapshot } from "./providers/registry.js";
import { SidebarPanel } from "./ui/SidebarPanel.js";
import { setV2CredentialLoader, type V2CredentialEntry } from "./lib/auth.js";
import { createQuotaV2Api, type V2Context } from "./v2.js";
import { loadSnapshotCache, saveSnapshotCache } from "./lib/snapshot-cache.js";
import type { CardsSnapshot } from "./lib/types.js";
import {
  matchSessionProvider,
  providerIdFromMessages,
  providerIdFromSessionResponse,
} from "./lib/session-provider.js";
import { readActiveOpenCodeGoAccount } from "./lib/opencode-go-config.js";
import { createExpansionState } from "./ui/expansion.js";

const REFRESH_INTERVAL_MS = 60_000;
const CLOCK_INTERVAL_MS = 30_000;
const MOUNT_RECOVERY_DELAY_MS = 1_500;

export const quotaCardsTuiPlugin: TuiPlugin = async (api, _options, _meta) => {
  try {
    const loaded = await loadCardsConfig();
    const config = loaded.config;

    if (!config.enabled || !config.cardsSidebar.enabled) {
      return;
    }

    // Quota is account-wide, not per session: one shared snapshot and one
    // poller serve every mounted sidebar instead of one per session.
    // The cache keeps the last reading visible across restarts and gives
    // failed fetches something to fall back to.
    const cached = await loadSnapshotCache();
    let previous = cached?.snapshot;
    const [snapshot, setSnapshot] = createSignal<CardsSnapshot>(
      cached?.snapshot ?? {
        generatedAt: new Date(0).toISOString(),
        providers: [],
      },
    );

    let disposed = false;

    // This clock only repaints age labels; it never triggers provider requests.
    const [now, setNow] = createSignal(Date.now());
    const clock = setInterval(() => {
      if (!disposed) setNow(Date.now());
    }, CLOCK_INTERVAL_MS);

    // Session focus: which model provider each mounted session is using.
    // The snapshot itself stays account-wide and shared across sessions.
    const [sessionProviders, setSessionProviders] = createSignal<
      Record<string, string | undefined>
    >({});
    const [activeGoAccount, setActiveGoAccount] = createSignal<
      string | undefined
    >();
    const knownSessions = new Set<string>();
    const sessionPending = new Set<string>();
    const sessionFetchedAt = new Map<string, number>();
    const expansion = createExpansionState();

    const setSessionProvider = (
      sessionId: string,
      providerId: string | undefined,
    ) => {
      setSessionProviders((previous) =>
        previous[sessionId] === providerId
          ? previous
          : { ...previous, [sessionId]: providerId },
      );
    };

    const refreshActiveGoAccount = () => {
      void readActiveOpenCodeGoAccount()
        .then((account) => {
          if (!disposed) setActiveGoAccount(account);
        })
        .catch(() => {});
    };

    const syncSessionProvider = (sessionId: string, force = false) => {
      if (!sessionId || disposed) return;
      knownSessions.add(sessionId);
      const nowMs = Date.now();
      if (!force && nowMs - (sessionFetchedAt.get(sessionId) ?? 0) < 1_000) {
        return;
      }

      // v2: the adapter injects an async loader backed by the session record
      // (preferred) or the transcript.
      const loadProvider = (api as {
        sessionProvider?: (id: string) => Promise<string | undefined>;
      }).sessionProvider;
      if (typeof loadProvider === "function") {
        if (sessionPending.has(sessionId)) return;
        sessionPending.add(sessionId);
        sessionFetchedAt.set(sessionId, nowMs);
        void loadProvider(sessionId)
          .then((providerId) => {
            if (disposed || !providerId) return;
            setSessionProvider(sessionId, providerId);
          })
          .catch(() => {})
          .finally(() => sessionPending.delete(sessionId));
        return;
      }

      // Older v2 adapters only exposed the transcript.
      const loadMessages = (api as { sessionMessages?: (id: string) => Promise<readonly unknown[] | undefined> })
        .sessionMessages;
      if (typeof loadMessages === "function") {
        if (sessionPending.has(sessionId)) return;
        sessionPending.add(sessionId);
        sessionFetchedAt.set(sessionId, nowMs);
        void loadMessages(sessionId)
          .then((messages) => {
            if (disposed || messages === undefined) return;
            setSessionProvider(
              sessionId,
              providerIdFromMessages(messages, true),
            );
          })
          .catch(() => {})
          .finally(() => sessionPending.delete(sessionId));
        return;
      }

      // v1: the session record already carries the selected model, so prefer
      // it over parsing the transcript. Fall back to messages for older hosts
      // whose session view does not expose `model`.
      const sessionState = (api as {
        state?: {
          session?: {
            get?: (id: string) => unknown;
            messages?: (id: string) => readonly unknown[];
          };
        };
      }).state?.session;
      if (typeof sessionState?.get === "function") {
        try {
          const providerId = providerIdFromSessionResponse(
            sessionState.get.call(sessionState, sessionId),
          );
          if (providerId) {
            sessionFetchedAt.set(sessionId, nowMs);
            setSessionProvider(sessionId, providerId);
            return;
          }
        } catch {
          // Fall through to the transcript.
        }
      }

      const readMessages = sessionState?.messages;
      if (typeof readMessages !== "function") return;
      try {
        const messages = readMessages.call(sessionState, sessionId);
        if (messages === undefined) return;
        sessionFetchedAt.set(sessionId, nowMs);
        setSessionProvider(
          sessionId,
          providerIdFromMessages(messages, false),
        );
      } catch {
        // A session can disappear between render and read; keep the old value.
      }
    };

    const refreshKnownSessions = () => {
      refreshActiveGoAccount();
      for (const sessionId of knownSessions) {
        syncSessionProvider(sessionId, true);
      }
    };

    const refreshIntervalMs = config.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
    let inFlight = false;
    let queued = false;
    let version = 0;

    const reload = () => {
      if (disposed) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      const v = ++version;
      collectSnapshot(config, previous).then((next) => {
        if (v === version && !disposed) {
          previous = next;
          setSnapshot(next);
          void saveSnapshotCache(next);
          refreshActiveGoAccount();
        }
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
      intervalMs: refreshIntervalMs,
    });
    const unsubs = [
      api.event.on("session.updated", () => {
        scheduler.schedule();
        refreshKnownSessions();
      }),
      api.event.on("message.updated", () => {
        scheduler.schedule();
        refreshKnownSessions();
      }),
      api.event.on("message.removed", () => {
        scheduler.schedule();
        refreshKnownSessions();
      }),
      api.event.on("tui.session.select", () => {
        scheduler.schedule();
        refreshKnownSessions();
      }),
    ];

    const dispose = () => {
      disposed = true;
      clearInterval(clock);
      scheduler.dispose();
      for (const u of unsubs) u();
    };
    api.lifecycle.onDispose(dispose);

    scheduler.start();
    refreshActiveGoAccount();
    reload();
    scheduler.schedule(MOUNT_RECOVERY_DELAY_MS, true);

    function SidebarContentView(props: { sessionId: string }) {
      const activeProviderId = () =>
        matchSessionProvider(
          sessionProviders()[props.sessionId],
          snapshot().providers.map((provider) => provider.id),
          activeGoAccount(),
        );

      return (
        <SidebarPanel
          api={api}
          config={config}
          snapshot={snapshot}
          now={now}
          refreshIntervalMs={refreshIntervalMs}
          sessionId={props.sessionId}
          activeProviderId={activeProviderId}
          expansion={expansion}
        />
      );
    }

    api.slots.register({
      order: config.cardsSidebar.order,
      slots: {
        sidebar_content(_ctx: unknown, props: { session_id: string }) {
          const sessionId = props.session_id ?? "";
          syncSessionProvider(sessionId);
          return (
            <ErrorBoundary fallback={<text fg={api.theme.current.error}>Quota error</text>}>
              <SidebarContentView sessionId={sessionId} />
            </ErrorBoundary>
          );
        },
        sidebar_footer() {
          const version = api.app?.version?.trim();
          if (!version) return null;
          // OpenCode 1 already renders its own path + version footer. Only add
          // the version line on 2.x, where the core footer just shows the path.
          const major = Number.parseInt(version.split(".")[0] ?? "", 10);
          if (Number.isFinite(major) && major < 2) return null;
          // Match OpenCode 1's official footer wordmark: the bullet uses the
          // theme success color, "Open" inherits the muted text color, and
          // "Code" is the brighter bold segment.
          return (
            <box flexDirection="row" paddingLeft={1}>
              <text fg={api.theme.current.textMuted}>
                <span style={{ fg: api.theme.current.success } as any}>•</span>{" "}
                <b>Open</b>
                <span style={{ fg: api.theme.current.text } as any}>
                  <b>Code</b>
                </span>{" "}
                <span>{version}</span>
              </text>
            </box>
          );
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    try { process.stderr.write(`[quota-cards] tui plugin: FATAL ${msg}\n`); } catch {}
  }
};

export async function quotaCardsTuiV2(context: V2Context): Promise<() => void> {
  const cleanups: Array<() => void> = [];
  const api = createQuotaV2Api(context, cleanups);
  // Prefer OpenCode 2's own credentials (official client API); auth.json is only a fallback.
  const list = context.client?.credential?.list;
  setV2CredentialLoader(
    typeof list === "function"
      ? async () => (await list.call(context.client!.credential)) as V2CredentialEntry[]
      : async () => null,
  );
  cleanups.push(() => setV2CredentialLoader(null));
  await quotaCardsTuiPlugin(api, context.options ?? {}, {} as any);
  return () => {
    for (const cleanup of cleanups.reverse()) {
      try { cleanup(); } catch {}
    }
  };
}

const pluginModule: TuiPluginModule & { id: string; setup?: (context: V2Context) => Promise<() => void> } = {
  id: "@local/opencode-quota-extended",
  tui: quotaCardsTuiPlugin,
  setup: quotaCardsTuiV2,
};

export default pluginModule;

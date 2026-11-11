import {
  providerIdFromMessages,
  providerIdFromSessionResponse,
  sessionMessagesFromResponse,
} from "./lib/session-provider.js";

type ColorToken = unknown;

export type V2Theme = {
  // OpenCode 2 exposes design tokens: RGBA values live under `.base`, and the
  // semantic colors under `text.feedback.*`.
  text?:
    | {
        base?: ColorToken;
        muted?: ColorToken;
        feedback?: {
          success?: { base?: ColorToken };
          warning?: { base?: ColorToken };
          error?: { base?: ColorToken };
          info?: { base?: ColorToken };
        };
        action?: { primary?: { base?: ColorToken } };
      }
    | string;
  accent?: { base?: ColorToken } | string;
  background?: {
    raised?: { base?: ColorToken; high?: ColorToken };
    overlay?: { base?: ColorToken };
    panel?: ColorToken;
    element?: ColorToken;
  };
  status?: {
    success?: ColorToken;
    warning?: ColorToken;
    danger?: ColorToken;
    error?: ColorToken;
  };
  primary?: ColorToken;
  success?: ColorToken;
  warning?: ColorToken;
  error?: ColorToken;
  textMuted?: ColorToken;
  backgroundPanel?: ColorToken;
  backgroundElement?: ColorToken;
};

export type V2Context = {
  app?: { version?: string };
  theme?: V2Theme;
  options?: Record<string, unknown>;
  client?: {
    credential?: { list?: () => Promise<unknown> };
    session?: {
      get?: (input: unknown) => Promise<unknown>;
      messages?: (input: unknown) => Promise<unknown>;
      // OpenCode 2's in-process client exposes the transcript here.
      message?: { list?: (input: unknown) => unknown };
    };
  };
  data?: {
    on?: (type: string, handler: (event: unknown) => void) => () => void;
    listen?: (handler: (event: unknown) => void) => () => void;
  };
  ui?: {
    slot?: (input: { append?: string; render: (props: { sessionID?: string }) => unknown }) => () => void;
  };
};

/**
 * Return a value accepted by OpenTUI's `fg`/`borderColor` props.
 *
 * V2 theme tokens are RGBA objects nested under `.base`; v1-style callers and
 * tests may pass plain strings or flat token names. Preserve the RGBA object
 * rather than stringifying it so terminal themes keep their exact colors.
 */
function tokenColor(value: unknown, fallback: string): unknown {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  const base = record.base;
  if (typeof base === "string") return base;
  if (base && typeof base === "object") return base;
  if (typeof record.toInts === "function" || ("r" in record && "g" in record && "b" in record)) {
    return value;
  }
  return fallback;
}

export function v2Theme(theme?: V2Theme) {
  const t = (theme ?? {}) as Record<string, any>;
  const text = t.text;
  const feedback = text?.feedback;
  const action = text?.action;
  const background = t.background;
  return {
    text: tokenColor(
      typeof text === "string" ? text : text?.base,
      "#ffffff",
    ),
    textMuted: tokenColor(
      typeof text === "object" ? text?.muted : t.textMuted,
      "#888888",
    ),
    primary: tokenColor(action?.primary?.base ?? t.primary, "#4aa3ff"),
    accent: tokenColor(action?.primary?.base ?? t.accent, "#4aa3ff"),
    success: tokenColor(
      feedback?.success?.base ?? t.status?.success ?? t.success,
      "#4cc46a",
    ),
    warning: tokenColor(
      feedback?.warning?.base ?? t.status?.warning ?? t.warning,
      "#e6b450",
    ),
    error: tokenColor(
      feedback?.error?.base ?? t.status?.danger ?? t.status?.error ?? t.error,
      "#e5534b",
    ),
    backgroundPanel: tokenColor(
      background?.raised?.base ?? background?.panel ?? t.backgroundPanel,
      "#111111",
    ),
    backgroundElement: tokenColor(
      background?.overlay?.base ??
        background?.raised?.high ??
        background?.element ??
        t.backgroundElement,
      "#222222",
    ),
  };
}

/**
 * Adapt a V2 CLI plugin context to the V1 TUI API the cards already use.
 * The components only read `theme.current`; events and slots are bridged so
 * the existing refresh scheduler and sidebar markup stay unchanged.
 */
export function createQuotaV2Api(context: V2Context, cleanups: Array<() => void>) {
  const currentTheme = v2Theme(context.theme);
  const theme = { current: currentTheme } as { current: typeof currentTheme };
  Object.defineProperty(theme, "current", { get: () => v2Theme(context.theme) });
  const app = { version: context.app?.version ?? "" };

  const sessionClient = context.client?.session;
  const rawGet = sessionClient?.get;
  const rawMessages = sessionClient?.messages;
  const rawList = sessionClient?.message?.list;
  const sessionMessages =
    typeof rawMessages === "function" || typeof rawList === "function"
      ? async (sessionID: string): Promise<readonly unknown[] | undefined> => {
          const tryCall = async (
            fn: (...args: any[]) => unknown,
            thisArg: unknown,
            input: unknown,
          ): Promise<unknown> => {
            try {
              return await fn.call(thisArg, input);
            } catch {
              return undefined;
            }
          };

          if (typeof rawMessages === "function") {
            // OpenCode 2 SDK shape: ordered, limited transcript.
            const v2 = sessionMessagesFromResponse(
              await tryCall(rawMessages, sessionClient, {
                sessionID,
                limit: 20,
                order: "desc",
              }),
            );
            if (v2) return v2;
            // Older SDK shape still used by some hosts.
            const legacy = sessionMessagesFromResponse(
              await tryCall(rawMessages, sessionClient, {
                path: { id: sessionID },
                query: { limit: 20 },
              }),
            );
            if (legacy) return legacy;
          }

          if (typeof rawList === "function") {
            // In-process OpenCode 2 client: session.message.list(...)
            for (const input of [sessionID, { sessionID }]) {
              const messages = sessionMessagesFromResponse(
                await tryCall(rawList, sessionClient?.message, input),
              );
              if (messages) return messages;
            }
          }

          return undefined;
        }
      : undefined;

  const sessionProvider = async (
    sessionID: string,
  ): Promise<string | undefined> => {
    // Prefer the session record: it carries the selected model directly and
    // does not depend on transcript ordering or projection details.
    if (typeof rawGet === "function") {
      for (const input of [{ sessionID }, sessionID]) {
        try {
          const providerId = providerIdFromSessionResponse(
            await rawGet.call(sessionClient, input),
          );
          if (providerId) return providerId;
        } catch {
          // Try the next call shape.
        }
      }
    }
    if (sessionMessages) {
      const messages = await sessionMessages(sessionID);
      return providerIdFromMessages(messages, true);
    }
    return undefined;
  };

  const event = {
    on(_type: string, handler: (event: unknown) => void) {
      const unsubscribe = context.data?.on?.("session.execution.started", handler)
        ?? context.data?.on?.("session.updated", handler)
        ?? (() => {});
      if (context.data?.listen) {
        const stop = context.data.listen(handler);
        cleanups.push(stop);
      }
      cleanups.push(unsubscribe);
      return () => {
        unsubscribe();
      };
    },
  };

  const lifecycle = {
    onDispose(fn: () => void) {
      cleanups.push(fn);
    },
  };

  const slots = {
    register(input: {
      slots: {
        sidebar_content?: (ctx: unknown, props: { session_id: string }) => unknown;
        sidebar_footer?: (ctx: unknown, props: { session_id: string }) => unknown;
      };
    }) {
      const register = (
        render: ((ctx: unknown, props: { session_id: string }) => unknown) | undefined,
        append: string,
      ) => {
        if (!render || !context.ui?.slot) return;
        const dispose = context.ui.slot({
          append,
          render: (props) => render({}, { session_id: props.sessionID ?? "" }),
        });
        if (typeof dispose === "function") cleanups.push(dispose);
      };
      register(input.slots.sidebar_content, "sidebar.content");
      register(input.slots.sidebar_footer, "sidebar.footer");
    },
  };

  return {
    app,
    theme,
    event,
    lifecycle,
    slots,
    sessionMessages,
    sessionProvider,
  } as any;
}

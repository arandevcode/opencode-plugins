export type V2Theme = {
  text?: { base?: string; muted?: string } | string;
  accent?: { base?: string } | string;
  background?: { panel?: string; element?: string };
  status?: { success?: string; warning?: string; danger?: string; error?: string };
  primary?: string;
  success?: string;
  warning?: string;
  error?: string;
  textMuted?: string;
  backgroundPanel?: string;
  backgroundElement?: string;
};

export type V2Context = {
  theme?: V2Theme;
  options?: Record<string, unknown>;
  data?: {
    on?: (type: string, handler: (event: unknown) => void) => () => void;
    listen?: (handler: (event: unknown) => void) => () => void;
  };
  ui?: {
    slot?: (input: { append?: string; render: (props: { sessionID?: string }) => unknown }) => () => void;
  };
};

export function asColor(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { base?: unknown }).base === "string") {
    return (value as { base: string }).base;
  }
  return fallback;
}

export function v2Theme(theme?: V2Theme) {
  const text = theme?.text;
  return {
    text: typeof text === "string" ? text : asColor(text?.base, "#ffffff"),
    textMuted: typeof text === "object" ? asColor(text?.muted, "#888888") : asColor(theme?.textMuted, "#888888"),
    primary: asColor(theme?.primary, "#4aa3ff"),
    accent: asColor(theme?.accent, "#4aa3ff"),
    success: asColor(theme?.status?.success ?? theme?.success, "#4cc46a"),
    warning: asColor(theme?.status?.warning ?? theme?.warning, "#e6b450"),
    error: asColor(theme?.status?.danger ?? theme?.status?.error ?? theme?.error, "#e5534b"),
    backgroundPanel: asColor(theme?.background?.panel ?? theme?.backgroundPanel, "#111111"),
    backgroundElement: asColor(theme?.background?.element ?? theme?.backgroundElement, "#222222"),
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
    register(input: { slots: { sidebar_content?: (ctx: unknown, props: { session_id: string }) => unknown } }) {
      const render = input.slots.sidebar_content;
      if (!render || !context.ui?.slot) return;
      const dispose = context.ui.slot({
        append: "sidebar.content",
        render: (props) => render({}, { session_id: props.sessionID ?? "" }),
      });
      if (typeof dispose === "function") cleanups.push(dispose);
    },
  };

  return { theme, event, lifecycle, slots } as any;
}

export type V2ThemeLike = {
  text?: { base?: string; muted?: string } | string;
  accent?: { base?: string } | string;
  status?: { success?: string; warning?: string; danger?: string };
  success?: string;
  warning?: string;
  error?: string;
  textMuted?: string;
};

export type V2ThinkingContext = {
  theme?: V2ThemeLike;
  options?: Record<string, unknown>;
  data?: {
    listen?: (handler: (event: any) => void) => () => void;
    session?: { status?: (sessionID: string) => "idle" | "running" };
  };
  ui?: {
    slot?: (input: { append?: string; render: (props?: any) => unknown }) => () => void;
    toast?: { show?: (input: { title?: string; message: string; variant?: string }) => void };
    router?: { current?: () => { type?: string; sessionID?: string } };
  };
  keymap?: { layer?: (factory: () => unknown) => void };
};

export function v2Color(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { base?: unknown }).base === "string") {
    return (value as { base: string }).base;
  }
  return fallback;
}

function v2Theme(theme?: V2ThemeLike) {
  const text = theme?.text;
  return {
    text: typeof text === "string" ? text : v2Color(text?.base, "#ffffff"),
    textMuted: typeof text === "object" ? v2Color(text?.muted, "#888888") : v2Color(theme?.textMuted, "#888888"),
    primary: v2Color(theme?.accent, "#4aa3ff"),
    accent: v2Color(theme?.accent, "#4aa3ff"),
    success: v2Color(theme?.status?.success ?? theme?.success, "#4cc46a"),
    warning: v2Color(theme?.status?.warning ?? theme?.warning, "#e6b450"),
    error: v2Color(theme?.status?.danger ?? theme?.error, "#e5534b"),
    backgroundPanel: "#111111",
    backgroundElement: "#222222",
  };
}

/** Bridge V2's context to the V1 TUI API used by `thinkingVisual`. */
export function createThinkingV2Api(context: V2ThinkingContext, cleanups: Array<() => void>) {
  const theme = { current: v2Theme(context.theme) };
  Object.defineProperty(theme, "current", { get: () => v2Theme(context.theme) });

  const handlers = new Map<string, (event: any) => void>();

  const focusedSession = (): string | undefined => {
    try {
      const route = context.ui?.router?.current?.();
      return route?.type === "session" ? route.sessionID : undefined;
    } catch { return undefined; }
  };
  const routeAvailable = typeof context.ui?.router?.current === "function";

  const emit = (type: string, event: any) => {
    if (type.startsWith("session.execution.")) {
      const sessionID = event?.data?.sessionID;
      if (routeAvailable) {
        const focused = focusedSession();
        // Only the focused session drives the indicator; subagents and other
        // sessions running in the background must not turn it on or off.
        if (!focused) return;
        if (sessionID && sessionID !== focused) return;
      }
    }
    handlers.get(type)?.(event);
    if (type === "session.execution.started") handlers.get("session.status")?.({ properties: { status: { type: "busy" } } });
    if (
      type === "session.execution.succeeded" ||
      type === "session.execution.failed" ||
      type === "session.execution.interrupted"
    ) {
      handlers.get("session.status")?.({ properties: { status: { type: "idle" } } });
      handlers.get("session.idle")?.({});
    }
  };

  // OpenCode 2 delivers events as `{ details: OpenCodeEvent }`, while older
  // previews passed the event itself. Accept both shapes.
  const unwrapEvent = (event: any) => (event && typeof event === "object" && "details" in event ? event.details : event);

  if (context.data?.listen) {
    cleanups.push(context.data.listen((event: any) => {
      const details = unwrapEvent(event);
      const type = String(details?.type ?? "");
      if (type) emit(type, details);
    }));
  }

  const event = {
    on(type: string, handler: (event: any) => void) {
      handlers.set(type, handler);
      return () => handlers.delete(type);
    },
  };

  const ui = {
    Prompt: () => null,
    toast(input: { title?: string; message: string; variant?: string }) {
      context.ui?.toast?.show?.(input);
    },
    dialog: {},
  };

  const lifecycle = { onDispose(fn: () => void) { cleanups.push(fn); } };

  let lastFocus: string | undefined;
  const syncFocus = (sessionID?: string) => {
    if (!sessionID || sessionID === lastFocus) return;
    lastFocus = sessionID;
    // Querying the status lets a session that is already running light up
    // immediately when you switch to it.
    queueMicrotask(() => {
      const status = context.data?.session?.status?.(sessionID);
      if (status === "running") handlers.get("session.status")?.({ properties: { status: { type: "busy" } } });
      else if (status === "idle") handlers.get("session.status")?.({ properties: { status: { type: "idle" } } });
    });
  };
  const resetFocus = () => {
    if (lastFocus === undefined) return;
    lastFocus = undefined;
    queueMicrotask(() => handlers.get("session.status")?.({ properties: { status: { type: "idle" } } }));
  };

  const slots = {
    register(input: { slots: Record<string, (ctx: unknown, props: any) => unknown> }) {
      // OpenCode 2 has no composer wrapper. Draw a full-width bar with a
      // colored top border above the composer instead of the small pill.
      const bar = input.slots.prompt_bar;
      if (bar && context.ui?.slot) {
        cleanups.push(context.ui.slot({
          append: "session.composer.top",
          render: (props) => {
            const sessionID = props?.sessionID;
            if (!sessionID) return null;
            syncFocus(sessionID);
            return bar({}, {});
          },
        }));
      }
      const home = input.slots.home_prompt;
      if (home && context.ui?.slot) {
        cleanups.push(context.ui.slot({
          append: "home.footer.status",
          render: () => { resetFocus(); return home({}, {}); },
        }));
      }
      const sidebar = input.slots.sidebar_title;
      if (sidebar && context.ui?.slot) {
        cleanups.push(context.ui.slot({
          append: "sidebar.content",
          render: (props) => { syncFocus(props?.sessionID); return sidebar({}, {}); },
        }));
      }
    },
  };

  const keymap = {
    registerLayer(input: any) {
      context.keymap?.layer?.(() => ({
        mode: "global",
        commands: (input?.commands ?? []).map((command: any) => ({
          id: command.id,
          title: command.name ?? command.id,
          group: command.category,
          run: command.run,
        })),
        bindings: [],
      }));
    },
  };

  return { theme, event, ui, lifecycle, slots, keymap } as any;
}

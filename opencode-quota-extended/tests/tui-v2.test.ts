import { describe, expect, it, vi } from "vitest";

import { createQuotaV2Api, v2Theme } from "../src/v2.js";

describe("quota V2 TUI adapter", () => {
  it("maps semantic theme tokens with safe fallbacks", () => {
    const theme = v2Theme({
      text: { base: "#fafafa", muted: "#777777" },
      accent: { base: "#00aaff" },
      status: { success: "#00ff00", warning: "#ffaa00", danger: "#ff0000" },
      background: { panel: "#101010", element: "#202020" },
    });
    expect(theme.text).toBe("#fafafa");
    expect(theme.textMuted).toBe("#777777");
    expect(theme.accent).toBe("#00aaff");
    expect(theme.error).toBe("#ff0000");
    expect(theme.backgroundPanel).toBe("#101010");
  });

  it("registers the sidebar slot as sidebar.content", () => {
    const dispose = vi.fn();
    const slot = vi.fn(() => dispose);
    const cleanups: Array<() => void> = [];
    const api = createQuotaV2Api({ ui: { slot } }, cleanups);

    api.slots.register({ slots: { sidebar_content: () => null } });

    expect(slot).toHaveBeenCalledWith(
      expect.objectContaining({ append: "sidebar.content", render: expect.any(Function) }),
    );
    expect(cleanups).toContain(dispose);
  });

  it("subscribes to V2 events and cleans them up", () => {
    let listener: ((event: unknown) => void) | undefined;
    const stop = vi.fn();
    const cleanups: Array<() => void> = [];
    const api = createQuotaV2Api(
      { data: { listen: (fn) => { listener = fn; return stop; } } },
      cleanups,
    );
    const handler = vi.fn();

    api.event.on("session.updated", handler);
    listener?.({ type: "session.execution.started" });

    expect(handler).toHaveBeenCalled();
    expect(cleanups).toContain(stop);
  });
});

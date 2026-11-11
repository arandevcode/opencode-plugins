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

  it("maps OpenCode 2 nested RGBA tokens without using fallback colors", () => {
    const text = { r: 250, g: 250, b: 250, a: 1 };
    const muted = { r: 120, g: 120, b: 120, a: 1 };
    const success = { r: 0, g: 200, b: 100, a: 1 };
    const warning = { r: 240, g: 180, b: 60, a: 1 };
    const error = { r: 230, g: 70, b: 60, a: 1 };
    const accent = { r: 70, g: 160, b: 255, a: 1 };
    const raised = { r: 20, g: 20, b: 20, a: 1 };

    const theme = v2Theme({
      text: {
        base: text,
        muted,
        feedback: {
          success: { base: success },
          warning: { base: warning },
          error: { base: error },
        },
        action: { primary: { base: accent } },
      },
      background: { raised: { base: raised } },
    });

    expect(theme.text).toBe(text);
    expect(theme.textMuted).toBe(muted);
    expect(theme.success).toBe(success);
    expect(theme.warning).toBe(warning);
    expect(theme.error).toBe(error);
    expect(theme.accent).toBe(accent);
    expect(theme.backgroundPanel).toBe(raised);
  });

  it("exposes the OpenCode app version for the sidebar footer", () => {
    const api = createQuotaV2Api({ app: { version: "2.2.5" } }, []);
    expect(api.app.version).toBe("2.2.5");
  });

  it("registers content and footer slots", () => {
    const disposeContent = vi.fn();
    const disposeFooter = vi.fn();
    const slot = vi
      .fn()
      .mockReturnValueOnce(disposeContent)
      .mockReturnValueOnce(disposeFooter);
    const cleanups: Array<() => void> = [];
    const footer = vi.fn(() => null);
    const api = createQuotaV2Api({ ui: { slot } }, cleanups);

    api.slots.register({
      slots: { sidebar_content: () => null, sidebar_footer: footer },
    });

    expect(slot).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ append: "sidebar.content", render: expect.any(Function) }),
    );
    expect(slot).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ append: "sidebar.footer", render: expect.any(Function) }),
    );
    expect(cleanups).toEqual([disposeContent, disposeFooter]);

    slot.mock.calls[1][0].render({ sessionID: "ses_test" });
    expect(footer).toHaveBeenCalledWith({}, { session_id: "ses_test" });
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

  it("resolves the session provider from the session record first", async () => {
    const get = vi.fn(async () => ({
      data: { id: "ses_1", model: { id: "gpt-6.1-sol", providerID: "openai" } },
    }));
    const messages = vi.fn(async () => ({ data: { data: [] } }));
    const api = createQuotaV2Api(
      { client: { session: { get, messages } } },
      [],
    );

    await expect(api.sessionProvider("ses_1")).resolves.toBe("openai");
    expect(get).toHaveBeenCalledWith({ sessionID: "ses_1" });
    expect(messages).not.toHaveBeenCalled();
  });

  it("falls back to the transcript when the session record has no model", async () => {
    const get = vi.fn(async () => ({ data: { id: "ses_1" } }));
    const messages = vi.fn(async () => ({
      data: { data: [{ type: "assistant", model: { providerID: "opencode-go" } }] },
    }));
    const api = createQuotaV2Api(
      { client: { session: { get, messages } } },
      [],
    );

    await expect(api.sessionProvider("ses_1")).resolves.toBe("opencode-go");
  });

  it("loads session messages through the V2 client shape", async () => {
    const messages = [
      { type: "assistant", model: { providerID: "opencode-go" } },
    ];
    const messagesFn = vi.fn(async () => ({ data: { data: messages, cursor: "" } }));
    const api = createQuotaV2Api(
      { client: { session: { messages: messagesFn } } },
      [],
    );

    await expect(api.sessionMessages("ses_1")).resolves.toEqual(messages);
    expect(messagesFn).toHaveBeenCalledWith({
      sessionID: "ses_1",
      limit: 20,
      order: "desc",
    });
  });

  it("loads session messages through the in-process message.list client", async () => {
    const messages = [
      { type: "assistant", model: { providerID: "openai" }, time: { created: 2 } },
    ];
    const list = vi.fn(() => messages);
    const api = createQuotaV2Api(
      { client: { session: { message: { list } } } },
      [],
    );

    await expect(api.sessionMessages("ses_2")).resolves.toEqual(messages);
    expect(list).toHaveBeenCalledWith("ses_2");
  });

  it("normalizes a messages envelope from message.list", async () => {
    const messages = [{ type: "model-switched", model: { providerID: "opencode-go" } }];
    const list = vi.fn(async () => ({ data: { messages } }));
    const api = createQuotaV2Api(
      { client: { session: { message: { list } } } },
      [],
    );

    await expect(api.sessionMessages("ses_3")).resolves.toEqual(messages);
  });

  it("falls back to the legacy client shape and exposes no loader without a client", async () => {
    const messages = [{ info: { providerID: "openai" }, parts: [] }];
    const messagesFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("unsupported"))
      .mockResolvedValueOnce({ data: messages });
    const api = createQuotaV2Api(
      { client: { session: { messages: messagesFn } } },
      [],
    );

    await expect(api.sessionMessages("ses_1")).resolves.toEqual(messages);
    expect(messagesFn).toHaveBeenLastCalledWith({
      path: { id: "ses_1" },
      query: { limit: 20 },
    });

    const noClient = createQuotaV2Api({}, []);
    expect(noClient.sessionMessages).toBeUndefined();
  });
});

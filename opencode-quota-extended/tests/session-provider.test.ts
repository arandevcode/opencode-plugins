import { describe, expect, it } from "vitest";
import {
  matchSessionProvider,
  providerIdFromMessages,
  providerIdFromSessionResponse,
  sessionMessagesFromResponse,
} from "../src/lib/session-provider.js";

describe("providerIdFromMessages", () => {
  it("reads v1 user and assistant messages", () => {
    expect(
      providerIdFromMessages([
        { role: "user", model: { providerID: "openai" } },
        { role: "assistant", providerID: "github-copilot" },
      ]),
    ).toBe("github-copilot");
  });

  it("reads projected v2 assistant and model-switched messages", () => {
    expect(
      providerIdFromMessages(
        [
          { type: "user" },
          { type: "assistant", model: { providerID: "opencode-go" } },
        ],
        true,
      ),
    ).toBe("opencode-go");
    expect(
      providerIdFromMessages(
        [{ type: "model-switched", model: { providerID: "openai" } }],
        true,
      ),
    ).toBe("openai");
  });

  it("accepts the newest provider when the transcript is newest-first", () => {
    const messages = [
      { type: "assistant", model: { providerID: "openai" } },
      { type: "assistant", model: { providerID: "opencode-go" } },
    ];
    expect(providerIdFromMessages(messages, true)).toBe("openai");
    expect(providerIdFromMessages(messages, false)).toBe("opencode-go");
  });

  it("prefers message timestamps over array order", () => {
    const messages = [
      { type: "assistant", model: { providerID: "openai" }, time: { created: 300 } },
      { type: "assistant", model: { providerID: "opencode-go" }, time: { created: 100 } },
    ];
    expect(providerIdFromMessages(messages, false)).toBe("openai");
    expect(providerIdFromMessages(messages, true)).toBe("openai");
  });

  it("unwraps info and data envelopes", () => {
    expect(
      providerIdFromMessages([{ info: { role: "assistant", providerID: "openai" } }]),
    ).toBe("openai");
    expect(
      providerIdFromMessages([{ data: { model: { providerID: "openai" } } }]),
    ).toBe("openai");
  });

  it("returns undefined for empty or malformed messages", () => {
    expect(providerIdFromMessages([])).toBeUndefined();
    expect(providerIdFromMessages(undefined)).toBeUndefined();
    expect(providerIdFromMessages([{ role: "user" }, null])).toBeUndefined();
  });
});

describe("sessionMessagesFromResponse", () => {
  it("normalizes bare arrays and both SDK response envelopes", () => {
    const messages = [{ type: "assistant" }];
    expect(sessionMessagesFromResponse(messages)).toEqual(messages);
    expect(sessionMessagesFromResponse({ data: messages })).toEqual(messages);
    expect(sessionMessagesFromResponse({ data: { data: messages } })).toEqual(
      messages,
    );
  });

  it("returns undefined for unknown shapes", () => {
    expect(sessionMessagesFromResponse(undefined)).toBeUndefined();
    expect(sessionMessagesFromResponse({})).toBeUndefined();
    expect(sessionMessagesFromResponse({ data: { cursor: "x" } })).toBeUndefined();
  });
});

describe("providerIdFromSessionResponse", () => {
  it("reads the selected model from a session/get response", () => {
    expect(
      providerIdFromSessionResponse({
        data: { id: "ses_1", model: { id: "gpt-6.1-sol", providerID: "openai" } },
      }),
    ).toBe("openai");
  });

  it("unwraps nested data and parses a JSON model string", () => {
    expect(
      providerIdFromSessionResponse({
        data: {
          data: {
            model: JSON.stringify({ id: "deepseek", providerID: "opencode-go" }),
          },
        },
      }),
    ).toBe("opencode-go");
  });

  it("returns undefined when the session has no model", () => {
    expect(providerIdFromSessionResponse({ data: { id: "ses_1" } })).toBeUndefined();
    expect(providerIdFromSessionResponse(undefined)).toBeUndefined();
  });
});

describe("matchSessionProvider", () => {
  const ids = ["openai", "opencode-go", "opencode-go-aRaN", "opencode-go-Work"];

  it("matches a plain provider id exactly", () => {
    expect(matchSessionProvider("openai", ids)).toBe("openai");
    expect(matchSessionProvider("github-copilot", ids)).toBeUndefined();
  });

  it("maps the OpenCode Go provider to the active named account", () => {
    expect(matchSessionProvider("opencode-go", ids, "aran")).toBe(
      "opencode-go-aRaN",
    );
    expect(matchSessionProvider("opencode-go", ids, "work")).toBe(
      "opencode-go-Work",
    );
  });

  it("falls back to the first named Go account and then the base card", () => {
    expect(matchSessionProvider("opencode-go", ["openai", "opencode-go-aRaN"])).toBe(
      "opencode-go-aRaN",
    );
    expect(matchSessionProvider("opencode-go", ["opencode-go"])).toBe(
      "opencode-go",
    );
  });

  it("honours an explicit account id even when the active account differs", () => {
    expect(matchSessionProvider("opencode-go-Work", ids, "aRaN")).toBe(
      "opencode-go-Work",
    );
  });
});

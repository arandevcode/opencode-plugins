import { describe, expect, it } from "vitest";

import type { ProviderQuota } from "../src/lib/types.js";
import { panelLayout, unconfiguredSummary } from "../src/ui/panel-layout.js";

function provider(
  id: string,
  label: string,
  status: ProviderQuota["status"],
): ProviderQuota {
  return { id, label, status, windows: [], fetchedAt: "2026-11-12T00:00:00Z" };
}

const openai = provider("openai", "OpenAI", "skipped");
const copilot = provider("github-copilot", "GitHub Copilot", "ok");
const go = provider("opencode-go", "OpenCode Go", "ok");

describe("panelLayout", () => {
  it("does not count a provider the user never set up (issue #4)", () => {
    const layout = panelLayout([openai, copilot, go], "github-copilot");
    expect(`${layout.ready}/${layout.total}`).toBe("2/2");
    expect(layout.cards.map((p) => p.id)).toEqual(["github-copilot", "opencode-go"]);
    expect(layout.unconfigured.map((p) => p.id)).toEqual(["openai"]);
  });

  it("keeps the card and the count for the provider the session is using", () => {
    const goMissing = provider("opencode-go", "OpenCode Go", "skipped");
    const layout = panelLayout([openai, copilot, goMissing], "opencode-go");
    expect(`${layout.ready}/${layout.total}`).toBe("1/2");
    expect(layout.cards.map((p) => p.id)).toEqual(["github-copilot", "opencode-go"]);
    expect(layout.unconfigured.map((p) => p.id)).toEqual(["openai"]);
  });

  it("still counts configured providers that fail", () => {
    const broken = provider("github-copilot", "GitHub Copilot", "error");
    const layout = panelLayout([openai, broken, go], undefined);
    expect(`${layout.ready}/${layout.total}`).toBe("1/2");
  });

  it("folds everything into the setup line on a fresh install", () => {
    const layout = panelLayout(
      [openai, provider("opencode-go", "OpenCode Go", "skipped")],
      undefined,
    );
    expect(layout.total).toBe(0);
    expect(unconfiguredSummary(layout.unconfigured)).toBe(
      "not set up: OpenAI, OpenCode Go",
    );
  });
});

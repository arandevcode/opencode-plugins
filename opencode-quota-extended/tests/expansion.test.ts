import { describe, expect, it } from "vitest";
import { createExpansionState, isExpandedFor } from "../src/ui/expansion.js";

describe("isExpandedFor", () => {
  it("expands everything when no session provider is known", () => {
    expect(isExpandedFor({}, "s1", "openai", undefined)).toBe(true);
    expect(isExpandedFor({}, "s1", "opencode-go", undefined)).toBe(true);
  });

  it("expands only the session provider by default", () => {
    expect(isExpandedFor({}, "s1", "openai", "openai")).toBe(true);
    expect(isExpandedFor({}, "s1", "opencode-go", "openai")).toBe(false);
  });

  it("lets a manual override win in both directions", () => {
    const overrides = { s1: { openai: false, "opencode-go": true } };
    expect(isExpandedFor(overrides, "s1", "openai", "openai")).toBe(false);
    expect(isExpandedFor(overrides, "s1", "opencode-go", "openai")).toBe(true);
    expect(isExpandedFor(overrides, "s2", "opencode-go", "openai")).toBe(false);
  });
});

describe("createExpansionState", () => {
  it("keeps overrides per session", () => {
    const state = createExpansionState();
    expect(state.isExpanded("s1", "openai", "openai")).toBe(true);

    state.toggle("s1", "openai", "openai");
    expect(state.isExpanded("s1", "openai", "openai")).toBe(false);
    expect(state.isExpanded("s2", "openai", "openai")).toBe(true);
  });

  it("can expand a non-active card and clears per session", () => {
    const state = createExpansionState();
    state.toggle("s1", "github-copilot", "openai");
    expect(state.isExpanded("s1", "github-copilot", "openai")).toBe(true);

    state.clearSession("s1");
    expect(state.isExpanded("s1", "github-copilot", "openai")).toBe(false);
  });
});

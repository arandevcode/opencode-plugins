import { describe, it, expect } from "vitest";

import { renderProgressBar, trafficLight, trafficLightColorKey } from "../src/ui/progress-bar.js";

describe("renderProgressBar", () => {
  it("returns all empty blocks at 0%", () => {
    const out = renderProgressBar(0, 10);
    expect(out.filled).toBe("");
    expect(out.empty).toBe("░░░░░░░░░░");
  });

  it("returns all filled blocks at 100%", () => {
    const out = renderProgressBar(100, 10);
    expect(out.filled).toBe("▓▓▓▓▓▓▓▓▓▓");
    expect(out.empty).toBe("");
  });

  it("returns half filled at 50%", () => {
    const out = renderProgressBar(50, 10);
    expect(out.filled).toBe("▓▓▓▓▓");
    expect(out.empty).toBe("░░░░░");
  });

  it("rounds filled blocks to the nearest integer", () => {
    expect(renderProgressBar(75, 4).filled).toBe("▓▓▓");
    expect(renderProgressBar(75, 4).empty).toBe("░");
    expect(renderProgressBar(33, 3).filled).toBe("▓");
    expect(renderProgressBar(33, 3).empty).toBe("░░");
  });

  it("uses a default width of 12", () => {
    const out = renderProgressBar(50);
    expect(out.filled + out.empty).toHaveLength(12);
    expect(out.width).toBe(12);
  });

  it("clamps values outside [0,100]", () => {
    expect(renderProgressBar(-5, 4).filled).toBe("");
    expect(renderProgressBar(150, 4).filled).toBe("▓▓▓▓");
  });
});

describe("trafficLight", () => {
  it("returns ok for >= 50%", () => {
    expect(trafficLight(50)).toBe("ok");
    expect(trafficLight(80)).toBe("ok");
    expect(trafficLight(100)).toBe("ok");
  });

  it("returns warning for 25-49%", () => {
    expect(trafficLight(49)).toBe("warning");
    expect(trafficLight(25)).toBe("warning");
  });

  it("returns error for < 25%", () => {
    expect(trafficLight(24)).toBe("error");
    expect(trafficLight(0)).toBe("error");
  });
});

describe("trafficLightColorKey", () => {
  it("maps ok -> success (theme green)", () => {
    expect(trafficLightColorKey("ok")).toBe("success");
  });
  it("maps warning -> warning", () => {
    expect(trafficLightColorKey("warning")).toBe("warning");
  });
  it("maps error -> error", () => {
    expect(trafficLightColorKey("error")).toBe("error");
  });
});

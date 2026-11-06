import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRefreshScheduler } from "../src/lib/refresh-scheduler.js";

describe("refresh scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces a burst of events into one refresh per gap", () => {
    const refresh = vi.fn();
    const scheduler = createRefreshScheduler({ refresh, intervalMs: 60_000 });

    for (let i = 0; i < 100; i += 1) scheduler.schedule();
    vi.advanceTimersByTime(1_499);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 100; i += 1) scheduler.schedule();
    vi.advanceTimersByTime(19_999);
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });

  it("keeps the interval and stops after dispose", () => {
    const refresh = vi.fn();
    const scheduler = createRefreshScheduler({ refresh, intervalMs: 60_000 });

    scheduler.start();
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.dispose();
    vi.advanceTimersByTime(120_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("lets a forced recovery refresh bypass the gap", () => {
    const refresh = vi.fn();
    const scheduler = createRefreshScheduler({ refresh, intervalMs: 60_000 });

    scheduler.schedule(0, true);
    vi.advanceTimersByTime(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.schedule(0, true);
    vi.advanceTimersByTime(0);
    expect(refresh).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });
});

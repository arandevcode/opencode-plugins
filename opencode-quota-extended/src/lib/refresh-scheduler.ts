export type RefreshSchedulerOptions = {
  refresh: () => void;
  intervalMs: number;
  activityDelayMs?: number;
  minGapMs?: number;
  now?: () => number;
};

export type RefreshScheduler = {
  start: () => void;
  schedule: (delay?: number, force?: boolean) => void;
  dispose: () => void;
};

/**
 * Coalesces bursts of usage events into a single refresh and enforces a
 * minimum gap between attempts. A streaming message can emit many
 * `message.updated` events per second; without this every one of them would
 * fan out to the provider APIs.
 */
export function createRefreshScheduler(options: RefreshSchedulerOptions): RefreshScheduler {
  const {
    refresh,
    intervalMs,
    activityDelayMs = 1_500,
    minGapMs = 20_000,
    now = Date.now,
  } = options;

  let interval: ReturnType<typeof setInterval> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastRefreshAt = 0;
  let disposed = false;

  const run = () => {
    if (disposed) return;
    lastRefreshAt = now();
    refresh();
  };

  const schedule = (delay = activityDelayMs, force = false) => {
    if (disposed || timer !== null) return;
    const wait = force
      ? delay
      : Math.max(delay, minGapMs - (now() - lastRefreshAt));
    timer = setTimeout(() => {
      timer = null;
      if (disposed) return;
      if (!force && now() - lastRefreshAt < minGapMs) {
        schedule(0);
        return;
      }
      run();
    }, wait);
  };

  return {
    start() {
      if (disposed || interval !== null) return;
      interval = setInterval(() => {
        if (now() - lastRefreshAt >= minGapMs) run();
      }, intervalMs);
    },
    schedule,
    dispose() {
      disposed = true;
      if (interval !== null) clearInterval(interval);
      if (timer !== null) clearTimeout(timer);
      interval = null;
      timer = null;
    },
  };
}

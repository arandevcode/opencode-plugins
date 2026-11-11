import { describe, it, expect } from "vitest";

import {
  balanceUsd,
  formatBalance,
  formatBalanceCompact,
  formatWindowSpend,
} from "../src/lib/balance.js";
import type { ProviderBalance } from "../src/lib/types.js";

function balance_(over: Partial<ProviderBalance>): ProviderBalance {
  return { availableMicroCents: "918000000", useBalance: null, ...over };
}

describe("balanceUsd", () => {
  it("returns null without a balance", () => {
    expect(balanceUsd(undefined)).toBeNull();
  });

  it("converts microcents to dollars (1e8 microcents = 1 USD)", () => {
    expect(balanceUsd(balance_({ availableMicroCents: "918000000" }))).toBe(9.18);
    expect(balanceUsd(balance_({ availableMicroCents: "100000000" }))).toBe(1);
    expect(balanceUsd(balance_({ availableMicroCents: "50000000" }))).toBe(0.5);
  });

  it("returns null on unreadable input", () => {
    expect(balanceUsd(balance_({ availableMicroCents: "nope" }))).toBeNull();
  });
});

describe("formatBalance", () => {
  it("is empty without a balance", () => {
    expect(formatBalance(undefined)).toBe("");
  });

  it("renders the dollar amount and the credit label", () => {
    expect(formatBalance(balance_({ availableMicroCents: "918000000" }))).toBe("$9.18 credit");
  });

  it("adds a note when usage draws on credits", () => {
    expect(
      formatBalance(balance_({ availableMicroCents: "100000000", useBalance: true })),
    ).toBe("$1.00 credit · draws on credits");
  });

  it("adds a note when auto-recharge is enabled", () => {
    expect(
      formatBalance(
        balance_({
          availableMicroCents: "100000000",
          useBalance: true,
          autoRecharge: { enabled: true, thresholdDollars: 5, rechargeAmountDollars: 10 },
        }),
      ),
    ).toBe("$1.00 credit · draws on credits · auto-recharge");
  });

  it("stays quiet when useBalance is false and auto-recharge is off", () => {
    expect(
      formatBalance(
        balance_({ availableMicroCents: "250000000", useBalance: false, autoRecharge: { enabled: false } }),
      ),
    ).toBe("$2.50 credit");
  });
});

describe("formatBalanceCompact", () => {
  it("is empty without a balance", () => {
    expect(formatBalanceCompact(undefined)).toBe("");
  });

  it("renders only the dollar amount for a plain balance", () => {
    expect(formatBalanceCompact(balance_({ availableMicroCents: "918000000" }))).toBe("$9.18");
  });

  it("stays compact when credits or auto-recharge are enabled", () => {
    expect(
      formatBalanceCompact(
        balance_({
          availableMicroCents: "100000000",
          useBalance: true,
          autoRecharge: { enabled: true },
        }),
      ),
    ).toBe("$1.00");
  });
});

describe("formatWindowSpend", () => {
  const window_ = (over: Record<string, string>) => ({
    id: "monthly" as const,
    label: "Monthly",
    percentRemaining: 50,
    ...over,
  });

  it("renders spent and limit without a label", () => {
    expect(
      formatWindowSpend(window_({ spentMicroCents: "3951601801", limitMicroCents: "6000000000" })),
    ).toBe("$39.52 / $60.00");
  });

  it("is empty without both money fields", () => {
    expect(formatWindowSpend(window_({ spentMicroCents: "100000000" }))).toBe("");
  });
});

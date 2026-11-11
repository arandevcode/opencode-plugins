/**
 * Map a session's selected model to one of the quota cards.
 *
 * OpenCode exposes the transcript in different shapes depending on the host
 * generation. These helpers stay deliberately structural so both the v1 TUI
 * state and the v2 session client can feed them without sharing SDK types.
 */
/**
 * Pick the provider that owns the session's most recent model.
 *
 * Timestamps win when available so the result does not depend on whether the
 * host returned a chronological or reverse-chronological transcript. The
 * `newestFirst` flag is only a fallback for shapes without `time.created`.
 */
export declare function providerIdFromMessages(messages: readonly unknown[] | undefined, newestFirst?: boolean): string | undefined;
/** Extract `model.providerID` from a session/get response. */
export declare function providerIdFromSessionResponse(response: unknown): string | undefined;
/**
 * Normalize the many response envelopes used by the SDKs into a message list.
 * Accepts a bare array, `{ data: [...] }`, or `{ data: { data: [...] } }`.
 */
export declare function sessionMessagesFromResponse(response: unknown): readonly unknown[] | undefined;
/**
 * Resolve a model provider id to the id of a card that is actually present.
 *
 * OpenCode Go is a single model provider with several named account cards.
 * The session only says `opencode-go`, so the active account decides which
 * card should be highlighted. If that account is unavailable, fall back to
 * the first named account and finally to the base card.
 */
export declare function matchSessionProvider(providerId: string | undefined, availableIds: readonly string[], activeGoAccount?: string): string | undefined;
//# sourceMappingURL=session-provider.d.ts.map
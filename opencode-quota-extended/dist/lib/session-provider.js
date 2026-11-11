/**
 * Map a session's selected model to one of the quota cards.
 *
 * OpenCode exposes the transcript in different shapes depending on the host
 * generation. These helpers stay deliberately structural so both the v1 TUI
 * state and the v2 session client can feed them without sharing SDK types.
 */
function asRecord(value) {
    return value && typeof value === "object" ? value : undefined;
}
function nonEmptyString(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}
/** Read the provider id out of one message or an event-shaped envelope. */
function providerIdFromMessage(message) {
    const record = asRecord(message);
    if (!record)
        return undefined;
    // v1 assistant messages keep providerID at the top level; user messages and
    // v2 projected messages keep it under model.providerID.
    const direct = nonEmptyString(record.providerID);
    if (direct)
        return direct;
    const model = asRecord(record.model);
    const modelProvider = nonEmptyString(model?.providerID);
    if (modelProvider)
        return modelProvider;
    // Some SDK wrappers nest the actual message under `info` or `data`.
    const info = asRecord(record.info);
    if (info) {
        const fromInfo = providerIdFromMessage(info);
        if (fromInfo)
            return fromInfo;
    }
    const data = asRecord(record.data);
    if (data) {
        const fromData = providerIdFromMessage(data);
        if (fromData)
            return fromData;
    }
    return undefined;
}
/** Creation timestamp if the message shape carries one. */
function messageCreatedAt(message) {
    const record = asRecord(message);
    if (!record)
        return undefined;
    const time = asRecord(record.time);
    if (typeof time?.created === "number" && Number.isFinite(time.created)) {
        return time.created;
    }
    for (const nested of [asRecord(record.info), asRecord(record.data)]) {
        if (!nested)
            continue;
        const created = messageCreatedAt(nested);
        if (created !== undefined)
            return created;
    }
    return undefined;
}
/**
 * Pick the provider that owns the session's most recent model.
 *
 * Timestamps win when available so the result does not depend on whether the
 * host returned a chronological or reverse-chronological transcript. The
 * `newestFirst` flag is only a fallback for shapes without `time.created`.
 */
export function providerIdFromMessages(messages, newestFirst = false) {
    if (!messages || messages.length === 0)
        return undefined;
    let latest;
    for (const message of messages) {
        const providerId = providerIdFromMessage(message);
        const createdAt = messageCreatedAt(message);
        if (!providerId || createdAt === undefined)
            continue;
        if (!latest || createdAt > latest.createdAt) {
            latest = { providerId, createdAt };
        }
    }
    if (latest)
        return latest.providerId;
    if (newestFirst) {
        for (const message of messages) {
            const providerId = providerIdFromMessage(message);
            if (providerId)
                return providerId;
        }
        return undefined;
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const providerId = providerIdFromMessage(messages[i]);
        if (providerId)
            return providerId;
    }
    return undefined;
}
/** Extract `model.providerID` from a session/get response. */
export function providerIdFromSessionResponse(response) {
    const record = asRecord(response);
    if (record) {
        const data = asRecord(record.data);
        if (data) {
            const nested = providerIdFromSessionResponse(data);
            if (nested)
                return nested;
        }
        const model = record.model;
        if (typeof model === "string") {
            try {
                const parsed = JSON.parse(model);
                const fromParsed = providerIdFromSessionResponse({ model: parsed });
                if (fromParsed)
                    return fromParsed;
            }
            catch {
                // Some hosts store a plain provider id instead of JSON.
                if (model.includes("/"))
                    return model.split("/")[0];
            }
        }
        const modelRecord = asRecord(model);
        const provider = nonEmptyString(modelRecord?.providerID);
        if (provider)
            return provider;
    }
    return undefined;
}
/**
 * Normalize the many response envelopes used by the SDKs into a message list.
 * Accepts a bare array, `{ data: [...] }`, or `{ data: { data: [...] } }`.
 */
export function sessionMessagesFromResponse(response) {
    if (Array.isArray(response))
        return response;
    const record = asRecord(response);
    if (!record)
        return undefined;
    const data = record.data;
    if (Array.isArray(data))
        return data;
    const nested = asRecord(data);
    if (nested) {
        if (Array.isArray(nested.data))
            return nested.data;
        if (Array.isArray(nested.messages))
            return nested.messages;
        if (Array.isArray(nested.items))
            return nested.items;
    }
    if (Array.isArray(record.messages))
        return record.messages;
    if (Array.isArray(record.items))
        return record.items;
    return undefined;
}
/**
 * Resolve a model provider id to the id of a card that is actually present.
 *
 * OpenCode Go is a single model provider with several named account cards.
 * The session only says `opencode-go`, so the active account decides which
 * card should be highlighted. If that account is unavailable, fall back to
 * the first named account and finally to the base card.
 */
export function matchSessionProvider(providerId, availableIds, activeGoAccount) {
    if (!providerId)
        return undefined;
    // OpenCode Go needs account-level disambiguation before the generic exact
    // match: the session model is the base provider, while the visible cards are
    // usually named accounts.
    if (providerId === "opencode-go" || providerId.startsWith("opencode-go-")) {
        const requestedAccount = providerId.startsWith("opencode-go-")
            ? providerId.slice("opencode-go-".length)
            : undefined;
        const account = requestedAccount ?? activeGoAccount?.trim();
        if (account) {
            const wanted = `opencode-go-${account}`.toLowerCase();
            const named = availableIds.find((id) => id.toLowerCase() === wanted);
            if (named)
                return named;
        }
        // An explicit account id that exists should win even when the active
        // account has since changed.
        if (requestedAccount) {
            const exact = availableIds.find((id) => id === providerId);
            if (exact)
                return exact;
        }
        const firstNamed = availableIds.find((id) => id.startsWith("opencode-go-"));
        if (firstNamed)
            return firstNamed;
        return availableIds.find((id) => id === "opencode-go");
    }
    return availableIds.find((id) => id === providerId);
}
//# sourceMappingURL=session-provider.js.map
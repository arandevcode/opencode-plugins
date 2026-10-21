/**
 * Reset time formatting helpers.
 */
export function formatResetRelative(resetIso, now = new Date()) {
    if (!resetIso)
        return "";
    const reset = new Date(resetIso);
    if (Number.isNaN(reset.getTime()))
        return "";
    const diffMs = reset.getTime() - now.getTime();
    if (diffMs <= 0)
        return "now";
    return `in ${formatDuration(diffMs)}`;
}
export function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) {
        return `${days}d ${hours}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${seconds}s`;
}
export function clampPercent(value) {
    if (!Number.isFinite(value))
        return 0;
    if (value < 0)
        return 0;
    if (value > 100)
        return 100;
    return Math.round(value);
}
const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function pad(n) {
    return String(n).padStart(2, "0");
}
function isSameDay(a, b) {
    return (a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate());
}
function formatAbsoluteTime(reset, now) {
    const time = `${pad(reset.getHours())}:${pad(reset.getMinutes())}`;
    if (isSameDay(reset, now))
        return time;
    return `${reset.getDate()} ${MONTHS[reset.getMonth()]} ${time}`;
}
export function formatResetAbsolute(resetIso, now = new Date()) {
    if (!resetIso)
        return "";
    const reset = new Date(resetIso);
    if (Number.isNaN(reset.getTime()))
        return "";
    const diffMs = reset.getTime() - now.getTime();
    if (diffMs <= 0)
        return "now";
    return formatAbsoluteTime(reset, now);
}
export function formatResetCombined(resetIso, now = new Date()) {
    if (!resetIso)
        return "";
    const reset = new Date(resetIso);
    if (Number.isNaN(reset.getTime()))
        return "";
    const diffMs = reset.getTime() - now.getTime();
    if (diffMs <= 0)
        return "now";
    const relative = `in ${formatDuration(diffMs)}`;
    const absolute = formatAbsoluteTime(reset, now);
    return `${relative} (${absolute})`;
}
//# sourceMappingURL=reset-format.js.map
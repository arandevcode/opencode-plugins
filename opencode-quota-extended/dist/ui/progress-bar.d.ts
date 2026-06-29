/**
 * Build a visual progress bar using Unicode block characters.
 *
 * @param percentRemaining - Percent remaining (0-100), clamped internally
 * @param width - Character width of the bar (default 12)
 * @returns Filled (▓) and empty (░) strings of the appropriate length
 */
export declare function renderProgressBar(percentRemaining: number, width?: number): {
    filled: string;
    empty: string;
    width: number;
};
export type TrafficLight = "ok" | "warning" | "error";
/**
 * Classify a percent-remaining value into a traffic-light state.
 *
 * - `ok` (≥50%): high quota remaining
 * - `warning` (25–49%): moderate usage
 * - `error` (<25%): nearly exhausted
 */
export declare function trafficLight(percentRemaining: number): TrafficLight;
/**
 * Map a traffic-light state to the corresponding TuiThemeCurrent color key.
 */
export declare function trafficLightColorKey(light: TrafficLight): "accent" | "warning" | "error";
export declare function trafficLightIndicator(light: TrafficLight): string;
//# sourceMappingURL=progress-bar.d.ts.map
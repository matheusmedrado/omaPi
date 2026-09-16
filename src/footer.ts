/**
 * omaPi footer: one dense status strip. Model, thinking level, git branch,
 * context meter, omarchy theme, plus any status other extensions publish.
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const METER_CELLS = 8;
const METER_RAMP = ["░", "▒", "▓", "█"] as const;

export interface FooterSources {
	model: () => string | undefined;
	thinking: () => string | undefined;
	contextPercent: () => number | null | undefined;
	omarchyTheme: () => string | undefined;
	branch: () => string | null;
	statuses: () => ReadonlyMap<string, string>;
}

/** Dithered meter: fills left to right, last partial cell uses a ramp step. */
function meter(percent: number, theme: Theme): string {
	const filled = (percent / 100) * METER_CELLS;
	const whole = Math.floor(filled);
	const partial = Math.round((filled - whole) * (METER_RAMP.length - 1));
	const color = percent >= 85 ? "error" : percent >= 65 ? "warning" : "accent";
	let bar = "█".repeat(Math.min(whole, METER_CELLS));
	if (whole < METER_CELLS && partial > 0) bar += METER_RAMP[partial - 1];
	return theme.fg(color, bar) + theme.fg("borderMuted", "░".repeat(Math.max(0, METER_CELLS - visibleWidth(bar))));
}

/** `getTheme` is read per render: pi swaps the instance when the theme changes. */
export function createFooter(getTheme: () => Theme, sources: FooterSources) {
	return {
		invalidate() {},
		render(width: number): string[] {
			const theme = getTheme();
			const sep = theme.fg("borderMuted", " ▏ ");
			const left: string[] = [theme.fg("accent", "π")];

			const model = sources.model();
			if (model) left.push(theme.fg("text", model));

			const thinking = sources.thinking();
			if (thinking && thinking !== "off") left.push(theme.fg("muted", `think:${thinking}`));

			const branch = sources.branch();
			if (branch) left.push(theme.fg("borderMuted", "git:") + theme.fg("muted", branch));

			const percent = sources.contextPercent();
			if (typeof percent === "number") {
				left.push(`${meter(percent, theme)} ${theme.fg("dim", `${Math.round(percent)}%`)}`);
			}

			for (const status of sources.statuses().values()) {
				if (status) left.push(status);
			}

			const omarchy = sources.omarchyTheme();
			const right = omarchy ? theme.fg("dim", omarchy) : "";

			const line = left.join(sep);
			const pad = width - visibleWidth(line) - visibleWidth(right);
			return [pad > 1 ? line + " ".repeat(pad) + right : truncateToWidth(line, width)];
		},
	};
}

/**
 * omaPi logo: an 8-bit block mascot + pixel wordmark with a CRT boot animation.
 *
 * Everything is drawn with half/full block glyphs (U+2580..U+259F) and box
 * drawing, which every monospace font ships. No Nerd Font glyphs, no emoji.
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

/** Theme token names, derived from the theme itself so this stays in sync. */
type ThemeColor = Parameters<Theme["fg"]>[0];

const FULL = "█";
const UPPER = "▀";
const RAMP = ["░", "▒", "▓", "█"] as const;

/** 3x5 pixel font, scaled 2x horizontally when drawn. */
const GLYPHS: Record<string, string[]> = {
	O: ["111", "101", "101", "101", "111"],
	M: ["101", "111", "111", "101", "101"],
	A: ["111", "101", "111", "101", "101"],
	P: ["111", "101", "111", "100", "100"],
	I: ["111", "010", "010", "010", "111"],
};

const MASCOT = [
	"   █▌    █▌   ",
	"██████████████",
	"   ██    ██   ",
	"   ██    ██   ",
	"   ██    ██   ",
	"   ██    ██   ",
];

const MASCOT_WIDTH = 14;
const GAP = "   ";

/** Render "OMA" + "PI" as two separately colorable pixel blocks. */
function wordmark(letters: string): string[] {
	const rows = ["", "", "", "", ""];
	for (const [index, char] of [...letters].entries()) {
		const glyph = GLYPHS[char];
		if (!glyph) continue;
		for (let row = 0; row < 5; row++) {
			const pixels = [...glyph[row]].map((bit) => (bit === "1" ? FULL + FULL : "  ")).join("");
			rows[row] += (index === 0 ? "" : "  ") + pixels;
		}
	}
	return rows;
}

const OMA = wordmark("OMA");
const PI = wordmark("PI");
const WORD_WIDTH = visibleWidth(OMA[0]) + 2 + visibleWidth(PI[0]);
const FULL_WIDTH = MASCOT_WIDTH + GAP.length + WORD_WIDTH;

/** Swap solid blocks for a lighter dither step, used while a row materializes. */
function dither(line: string, step: number): string {
	const char = RAMP[Math.min(step, RAMP.length - 1)];
	return line.replaceAll(FULL, char).replaceAll("▌", char);
}

/**
 * Horizontal glitch offset. Applied to the plain text before coloring, because
 * slicing an already-colored string would cut an ANSI escape in half.
 */
function shiftSegments<T extends { plain: string }>(segments: T[], by: number): T[] {
	if (by === 0 || segments.length === 0) return segments;
	const [first, ...rest] = segments;
	if (by > 0) return [{ ...first, plain: " ".repeat(by) + first.plain }, ...rest];
	const trimmable = first.plain.length - first.plain.trimStart().length;
	const cut = Math.min(-by, trimmable);
	return cut === 0 ? segments : [{ ...first, plain: first.plain.slice(cut) }, ...rest];
}

export interface LogoOptions {
	/** Play the boot animation. */
	animate: boolean;
	/** Show the katakana tagline (needs a CJK-capable fallback font). */
	kana: boolean;
	version: string;
	/** Extra right-hand meta, e.g. the active omarchy theme. */
	meta: () => string | undefined;
}

interface Tui {
	requestRender(): void;
}

/** Phases: 0 sweep, 1 raster fill, 2 glitch, 3 settled. */
const SWEEP_FRAMES = 6;
const ROW_DELAY = 2;
const GLITCH_FRAMES = 2;
const FRAME_MS = 45;

export class OmaPiLogo {
	private frame = 0;
	private timer: ReturnType<typeof setInterval> | undefined;
	private readonly rows = MASCOT.length;
	private readonly lastFrame: number;

	/** Read the theme lazily: pi swaps the instance when the theme changes. */
	private get theme(): Theme {
		return this.getTheme();
	}

	private readonly tui: Tui;
	private readonly getTheme: () => Theme;
	private readonly options: LogoOptions;

	constructor(tui: Tui, getTheme: () => Theme, options: LogoOptions) {
		this.tui = tui;
		this.getTheme = getTheme;
		this.options = options;
		this.lastFrame = SWEEP_FRAMES + this.rows * ROW_DELAY + RAMP.length + GLITCH_FRAMES;
		this.frame = options.animate ? 0 : this.lastFrame;
		if (options.animate) this.start();
	}

	/** Replay the boot animation from the first frame. */
	replay(): void {
		this.frame = 0;
		this.start();
	}

	private start(): void {
		this.stop();
		this.timer = setInterval(() => {
			this.frame++;
			if (this.frame >= this.lastFrame) {
				this.frame = this.lastFrame;
				this.stop();
			}
			this.tui.requestRender();
		}, FRAME_MS);
		this.timer.unref?.();
	}

	private stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}

	dispose(): void {
		this.stop();
	}

	invalidate(): void {}

	render(width: number): string[] {
		const settled = this.frame >= this.lastFrame;
		if (width < WORD_WIDTH + 2) return this.renderCompact(width);

		const compact = width < FULL_WIDTH + 2;
		const body = compact ? this.renderWord() : this.renderFull();
		const lines = this.applyAnimation(body, compact);
		const showMeta = settled || this.frame > this.lastFrame - 3;
		lines.push(...(showMeta ? this.renderMeta(width) : ["", "", "", ""]));
		return lines.map((line) => truncateToWidth(line, width));
	}

	/** Mascot + wordmark side by side. */
	private renderFull(): { plain: string; color: ThemeColor }[][] {
		const word = this.renderWord();
		return MASCOT.map((mascotRow, index) => {
			const head = index === 0 ? this.eyes(mascotRow) : [{ plain: mascotRow, color: "accent" as ThemeColor }];
			const tail = index === 0 ? [] : (word[index - 1] ?? []);
			return [...head, { plain: GAP, color: "dim" as ThemeColor }, ...tail];
		});
	}

	private renderWord(): { plain: string; color: ThemeColor }[][] {
		return OMA.map((row, index) => [
			{ plain: row, color: "muted" as ThemeColor },
			{ plain: "  ", color: "dim" as ThemeColor },
			{ plain: PI[index], color: "accent" as ThemeColor },
		]);
	}

	/** Row 0 of the mascot: bright block eye + dim pupil sliver. */
	private eyes(row: string): { plain: string; color: ThemeColor }[] {
		const parts: { plain: string; color: ThemeColor }[] = [];
		for (const char of row) {
			parts.push({ plain: char, color: char === "▌" ? "dim" : "text" });
		}
		return parts;
	}

	private applyAnimation(body: { plain: string; color: ThemeColor }[][], compact: boolean): string[] {
		const width = compact ? WORD_WIDTH : FULL_WIDTH;
		const glitchStart = this.lastFrame - GLITCH_FRAMES;
		const lines: string[] = [];

		for (const [index, segments] of body.entries()) {
			const appearsAt = SWEEP_FRAMES + index * ROW_DELAY;
			if (this.frame < appearsAt) {
				lines.push(this.frame === index ? this.theme.fg("dim", "▔".repeat(width)) : "");
				continue;
			}
			const age = this.frame - appearsAt;
			const glitching = this.frame >= glitchStart && this.frame < this.lastFrame;
			const offset = glitching ? [0, 1, -1, 0, 2, 0][index % 6] : 0;
			const line = shiftSegments(segments, offset)
				.map((segment) => {
					const text = age < RAMP.length ? dither(segment.plain, age) : segment.plain;
					const color = glitching && index % 2 === 0 ? "error" : age < 2 ? "dim" : segment.color;
					return this.theme.fg(color, text);
				})
				.join("");
			lines.push(line);
		}

		// CRT reflection under the mark. Always emitted so the block keeps a
		// constant height and the transcript below it never jumps.
		const bottom = body.at(-1);
		const ready = bottom && this.frame >= this.lastFrame - 1;
		lines.push(
			ready
				? this.theme.fg(
						"borderMuted",
						bottom.map((segment) => segment.plain.replaceAll(FULL, UPPER).replaceAll("▌", UPPER)).join(""),
					)
				: "",
		);
		return lines;
	}

	private renderMeta(width: number): string[] {
		const { theme, options } = this;
		const dot = theme.fg("borderMuted", " ▪ ");
		const parts = [
			options.kana ? theme.fg("muted", "オマパイ") : theme.fg("muted", "omaPi"),
			theme.fg("dim", `v${options.version}`),
		];
		const meta = options.meta();
		if (meta) parts.push(theme.fg("dim", meta));
		const line = parts.join(dot);
		const hint = theme.fg("dim", "/omapi") + theme.fg("borderMuted", " for logo, themes, omarchy sync");
		return ["", truncateToWidth(line, width), truncateToWidth(hint, width), ""];
	}

	private renderCompact(width: number): string[] {
		const line = this.theme.fg("accent", "π ") + this.theme.fg("muted", "oma") + this.theme.fg("accent", "Pi");
		return [truncateToWidth(line, width), ""];
	}
}

/**
 * Render the omaPi header and footer to stdout without launching pi.
 *
 *   node --experimental-strip-types scripts/preview.ts [width] [--frames]
 *
 * Colors here are a stand-in palette; inside pi the real theme is used.
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import { createFooter } from "../src/footer.ts";
import { OmaPiLogo } from "../src/logo.ts";

const PALETTE: Record<string, string> = {
	accent: "\x1b[38;2;255;77;141m",
	text: "\x1b[38;2;215;220;229m",
	muted: "\x1b[38;2;138;147;166m",
	dim: "\x1b[38;2;91;100;120m",
	border: "\x1b[38;2;42;48;64m",
	borderMuted: "\x1b[38;2;31;37;50m",
	error: "\x1b[38;2;255;95;86m",
	warning: "\x1b[38;2;255;180;84m",
	success: "\x1b[38;2;134;229;138m",
};

const theme = {
	fg: (color: string, text: string) => `${PALETTE[color] ?? PALETTE.text}${text}\x1b[0m`,
	bg: (_color: string, text: string) => text,
} as unknown as Theme;

const width = Number(process.argv[2]) || 80;
const showFrames = process.argv.includes("--frames");

const logo = new OmaPiLogo({ requestRender: () => {} }, () => theme, {
	animate: false,
	kana: true,
	version: "0.1.0",
	meta: () => "inkypinky",
});

if (showFrames) {
	// Walk the animation by driving the frame counter directly.
	for (let index = 0; index <= 26; index++) {
		(logo as unknown as { frame: number }).frame = index;
		console.log(`--- frame ${index} ---`);
		console.log(logo.render(width).join("\n"));
	}
} else {
	console.log(logo.render(width).join("\n"));
}

const footer = createFooter(() => theme, {
	model: () => "claude-opus-5",
	thinking: () => "xhigh",
	contextPercent: () => 42,
	omarchyTheme: () => "inkypinky",
	branch: () => "main",
	statuses: () => new Map(),
});
console.log(footer.render(width).join("\n"));
logo.dispose();

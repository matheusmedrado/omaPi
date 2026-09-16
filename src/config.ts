/** omaPi settings, persisted at ~/.config/omapi/config.json. */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface OmaPiConfig {
	/** Replace pi's header with the omaPi logo. */
	header: boolean;
	/** Play the CRT boot animation on start. */
	animate: boolean;
	/** Katakana tagline (needs a CJK fallback font). */
	kana: boolean;
	/** Replace pi's footer with the omaPi status strip. */
	footer: boolean;
	/** Replace the streaming spinner with the 8-bit dither pulse. */
	indicator: boolean;
	/** Rewrite bridged tool-call markers into compact activity rows. */
	activity: boolean;
	/** Follow the active omarchy theme instead of a pinned omaPi theme. */
	followOmarchy: boolean;
	/** Pinned theme name. Overrides followOmarchy when set. */
	theme?: string;
}

export const DEFAULTS: OmaPiConfig = {
	header: true,
	animate: true,
	kana: true,
	footer: true,
	indicator: true,
	activity: true,
	followOmarchy: true,
};

const CONFIG_PATH = join(homedir(), ".config", "omapi", "config.json");

export function loadConfig(): OmaPiConfig {
	try {
		return { ...DEFAULTS, ...(JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<OmaPiConfig>) };
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveConfig(config: OmaPiConfig): void {
	mkdirSync(dirname(CONFIG_PATH), { recursive: true });
	writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

export { CONFIG_PATH };

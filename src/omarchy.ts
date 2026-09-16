/**
 * Omarchy integration.
 *
 * Omarchy renders every app's theme from the active theme's `colors.toml`
 * through templates in `$OMARCHY_PATH/default/themed/*.tpl`, and a user file at
 * `~/.config/omarchy/themed/<name>.tpl` overrides the built-in one. omaPi ships
 * its own `pi.json.tpl` so that `omarchy theme set <x>` produces an omaPi-grade
 * pi theme for *any* omarchy theme.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STATE_DIR = join(homedir(), ".local", "state", "omarchy", "current");
const THEME_NAME_FILE = join(STATE_DIR, "theme.name");
const TEMPLATE_TARGET = join(homedir(), ".config", "omarchy", "themed", "pi.json.tpl");

/** The theme omarchy generates for pi. */
export const OMARCHY_THEME = "omarchy-system";

export function isOmarchy(): boolean {
	return existsSync(STATE_DIR);
}

export function currentOmarchyTheme(): string | undefined {
	try {
		const name = readFileSync(THEME_NAME_FILE, "utf8").trim();
		return name.length > 0 ? name : undefined;
	} catch {
		return undefined;
	}
}

/** Fires when `omarchy theme set` swaps the current theme. */
export function watchOmarchyTheme(onChange: (name: string | undefined) => void): () => void {
	if (!isOmarchy()) return () => {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	let watcher: ReturnType<typeof watch> | undefined;
	try {
		watcher = watch(STATE_DIR, (_event, file) => {
			if (file && file !== "theme.name") return;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => onChange(currentOmarchyTheme()), 150);
			timer.unref?.();
		});
		watcher.unref?.();
	} catch {
		return () => {};
	}
	return () => {
		if (timer) clearTimeout(timer);
		watcher?.close();
	};
}

export function isTemplateInstalled(): boolean {
	return existsSync(TEMPLATE_TARGET);
}

/** Install omaPi's pi.json.tpl as the user override. Returns the target path. */
export function installTemplate(source: string): string {
	if (!existsSync(source)) throw new Error(`template not found: ${source}`);
	mkdirSync(join(homedir(), ".config", "omarchy", "themed"), { recursive: true });
	if (existsSync(TEMPLATE_TARGET)) {
		copyFileSync(TEMPLATE_TARGET, `${TEMPLATE_TARGET}.bak.${Date.now()}`);
	}
	copyFileSync(source, TEMPLATE_TARGET);
	return TEMPLATE_TARGET;
}

export { TEMPLATE_TARGET };

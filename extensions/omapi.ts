/**
 * omaPi — an 8-bit, omarchy-native face for pi.
 *
 * Replaces the header (animated block mascot + pixel wordmark), the footer
 * (dense status strip), and the streaming indicator, and keeps pi's colors in
 * step with the active omarchy theme.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { type OmaPiConfig, loadConfig, saveConfig } from "../src/config.ts";
import { createFooter } from "../src/footer.ts";
import { OmaPiLogo } from "../src/logo.ts";
import {
	OMARCHY_THEME,
	TEMPLATE_TARGET,
	currentOmarchyTheme,
	installTemplate,
	isOmarchy,
	isTemplateInstalled,
	watchOmarchyTheme,
} from "../src/omarchy.ts";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VERSION = "0.1.0";
const OMAPI_THEMES = ["omapi-famicom", "omapi-denshi", "omapi-washi"];

const TOGGLES = ["header", "animate", "kana", "footer", "indicator", "followOmarchy"] as const;
type Toggle = (typeof TOGGLES)[number];

export default function (pi: ExtensionAPI) {
	let config = loadConfig();
	let logo: OmaPiLogo | undefined;
	let unwatch: (() => void) | undefined;

	const applyTheme = (ctx: ExtensionContext): void => {
		const target = config.theme ?? (config.followOmarchy && isOmarchy() ? OMARCHY_THEME : undefined);
		if (!target) return;
		const known = ctx.ui.getAllThemes().some((theme) => theme.name === target);
		if (!known) return;
		ctx.ui.setTheme(target);
	};

	const applyHeader = (ctx: ExtensionContext): void => {
		if (!config.header) {
			logo = undefined;
			ctx.ui.setHeader(undefined);
			return;
		}
		ctx.ui.setHeader((tui) => {
			logo = new OmaPiLogo(tui, () => ctx.ui.theme, {
				animate: config.animate,
				kana: config.kana,
				version: VERSION,
				meta: () => currentOmarchyTheme(),
			});
			return logo;
		});
	};

	const applyFooter = (ctx: ExtensionContext): void => {
		if (!config.footer) {
			ctx.ui.setFooter(undefined);
			return;
		}
		ctx.ui.setFooter((tui, _theme, footerData) => ({
			...createFooter(() => ctx.ui.theme, {
				model: () => ctx.model?.id,
				thinking: () => ctx.thinkingLevel,
				contextPercent: () => ctx.getContextUsage()?.percent,
				omarchyTheme: () => currentOmarchyTheme(),
				branch: () => footerData.getGitBranch(),
				statuses: () => footerData.getExtensionStatuses(),
			}),
			dispose: footerData.onBranchChange(() => tui.requestRender()),
		}));
	};

	const applyIndicator = (ctx: ExtensionContext): void => {
		if (!config.indicator) {
			ctx.ui.setWorkingIndicator();
			return;
		}
		const theme = ctx.ui.theme;
		ctx.ui.setWorkingIndicator({
			frames: [
				theme.fg("borderMuted", "░"),
				theme.fg("dim", "▒"),
				theme.fg("muted", "▓"),
				theme.fg("accent", "█"),
				theme.fg("muted", "▓"),
				theme.fg("dim", "▒"),
			],
			intervalMs: 110,
		});
	};

	const applyAll = (ctx: ExtensionContext): void => {
		applyTheme(ctx);
		applyHeader(ctx);
		applyFooter(ctx);
		applyIndicator(ctx);
	};

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		config = loadConfig();
		applyAll(ctx);

		unwatch?.();
		unwatch = watchOmarchyTheme(() => {
			// pi hot-reloads the active theme file itself; this re-selects the
			// generated theme when the user was pinned elsewhere, and refreshes
			// the omarchy theme name shown in the header and footer.
			applyTheme(ctx);
			applyIndicator(ctx);
		});
	});

	pi.on("session_shutdown", () => {
		unwatch?.();
		unwatch = undefined;
	});

	pi.registerCommand("omapi", {
		description: "omaPi look: logo, themes, omarchy sync, toggles",
		getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
			const options = [
				{ value: "logo", label: "logo", description: "replay the boot animation" },
				{ value: "status", label: "status", description: "show current omaPi settings" },
				{ value: "omarchy install", label: "omarchy install", description: "install the omaPi pi.json template" },
				...OMAPI_THEMES.map((name) => ({ value: `theme ${name}`, label: `theme ${name}`, description: "pin theme" })),
				{ value: "theme follow", label: "theme follow", description: "follow the omarchy theme" },
				...TOGGLES.flatMap((key) => [
					{ value: `${key} on`, label: `${key} on`, description: "" },
					{ value: `${key} off`, label: `${key} off`, description: "" },
				]),
			];
			const matches = options.filter((option) => option.value.startsWith(prefix));
			return matches.length > 0 ? matches : null;
		},
		handler: async (args, ctx) => {
			const [command = "status", ...rest] = args.trim().split(/\s+/).filter(Boolean);
			const value = rest.join(" ");

			if (command === "logo") {
				if (!logo) {
					ctx.ui.notify("Header is off — /omapi header on", "warning");
					return;
				}
				logo.replay();
				return;
			}

			if (command === "theme") {
				if (value === "follow" || value === "") {
					config = { ...config, theme: undefined, followOmarchy: true };
					saveConfig(config);
					applyTheme(ctx);
					ctx.ui.notify(`Following omarchy theme: ${currentOmarchyTheme() ?? "unknown"}`, "info");
					return;
				}
				const result = ctx.ui.setTheme(value);
				if (!result.success) {
					ctx.ui.notify(`Theme failed: ${result.error}`, "error");
					return;
				}
				config = { ...config, theme: value, followOmarchy: false };
				saveConfig(config);
				ctx.ui.notify(`Theme pinned: ${value}`, "info");
				return;
			}

			if (command === "omarchy") {
				if (!isOmarchy()) {
					ctx.ui.notify("No omarchy install detected", "warning");
					return;
				}
				if (rest[0] !== "install") {
					ctx.ui.notify(`omarchy theme: ${currentOmarchyTheme() ?? "unknown"}`, "info");
					return;
				}
				const ok = await ctx.ui.confirm(
					"Install omaPi theme template?",
					`Writes ${TEMPLATE_TARGET} (existing file is backed up).\nRun 'omarchy theme set <theme>' afterwards to regenerate.`,
				);
				if (!ok) return;
				try {
					const path = installTemplate(join(PACKAGE_ROOT, "themed", "pi.json.tpl"));
					ctx.ui.notify(`Installed ${path} — re-apply your omarchy theme to regenerate`, "info");
				} catch (error) {
					ctx.ui.notify(`Install failed: ${(error as Error).message}`, "error");
				}
				return;
			}

			if ((TOGGLES as readonly string[]).includes(command)) {
				const key = command as Toggle;
				const next = value === "" ? !config[key] : value === "on";
				config = { ...config, [key]: next } as OmaPiConfig;
				saveConfig(config);
				applyAll(ctx);
				ctx.ui.notify(`${key}: ${next ? "on" : "off"}`, "info");
				return;
			}

			const lines = [
				`omaPi v${VERSION}`,
				`theme        ${config.theme ?? (config.followOmarchy ? `follow omarchy (${currentOmarchyTheme() ?? "n/a"})` : "pi default")}`,
				`template     ${isTemplateInstalled() ? "installed" : "not installed"}`,
				...TOGGLES.map((key) => `${key.padEnd(13)}${config[key] ? "on" : "off"}`),
			];
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}

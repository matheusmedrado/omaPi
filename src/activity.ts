/**
 * Activity rows for bridged tool calls.
 *
 * Providers that execute tools outside pi — the Claude Code CLI bridge, for
 * one — cannot use pi's tool rendering, so they announce activity as plain
 * assistant text markers instead:
 *
 *   [Claude Code · <Tool>]
 *   [Claude Code · <Tool> <argsJson>]
 *   [Claude Code · <Tool> #<toolUseId> <argsJson>]
 *   [Claude Code · result #<toolUseId> <payloadJson>]
 *
 * Rendered as markdown that is a wall of escaped JSON. This rewrites each
 * marker into a one-line quoted row, which pi draws with a colored gutter.
 *
 * The args JSON is truncated by the bridge at 120 characters and is therefore
 * frequently invalid — it is scraped with a regex, never parsed. The result
 * payload is documented as complete JSON and is parsed.
 */

const MARKER = /^\[([A-Za-z][\w .-]*) · ([^\s\]]+)(?:\s+([\s\S]*))?\]$/;
const ID_TAG = /^#(\S+)\s*/;

/** Argument that identifies what a tool actually did, per tool. */
const KEY_ARGUMENTS: Record<string, string[]> = {
	bash: ["command"],
	read: ["file_path", "path", "notebook_path"],
	write: ["file_path", "path"],
	edit: ["file_path", "path"],
	notebookedit: ["notebook_path"],
	glob: ["pattern"],
	grep: ["pattern"],
	webfetch: ["url"],
	websearch: ["query"],
	task: ["description", "prompt"],
	skill: ["skill", "command"],
	todowrite: ["todos"],
};

const FALLBACK_KEYS = ["command", "file_path", "path", "pattern", "url", "query", "description", "prompt", "name"];

/** Pull one string value out of possibly-truncated, possibly-invalid JSON. */
function scrapeValue(json: string, keys: string[]): string | undefined {
	for (const key of keys) {
		const match = json.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`));
		if (!match) continue;
		try {
			// Close the string ourselves: the bridge may have cut it mid-value.
			return JSON.parse(`"${match[1]}"`) as string;
		} catch {
			return match[1];
		}
	}
	return undefined;
}

function oneLine(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function clamp(text: string, width: number): string {
	if (width <= 1 || text.length <= width) return text;
	return `${text.slice(0, Math.max(1, width - 1))}…`;
}

function bytes(count: number): string {
	return count < 1024 ? `${count} chars` : `${(count / 1024).toFixed(1)} kB`;
}

function renderCall(tool: string, argsJson: string, width: number): string {
	const keys = KEY_ARGUMENTS[tool.toLowerCase()] ?? FALLBACK_KEYS;
	const value = argsJson ? (scrapeValue(argsJson, keys) ?? scrapeValue(argsJson, FALLBACK_KEYS)) : undefined;
	const label = `**${tool}**`;
	if (!value) return `> ${label}`;
	// Backticks inside the value would close the code span early.
	const detail = clamp(oneLine(value).replaceAll("`", "'"), Math.max(20, width - tool.length - 8));
	return `> ${label} \`${detail}\``;
}

function renderResult(payloadJson: string, width: number): string {
	let status = "ok";
	let preview = "";
	let length = 0;
	let truncated = false;
	try {
		const payload = JSON.parse(payloadJson) as {
			status?: string;
			preview?: string;
			length?: number;
			truncated?: boolean;
		};
		status = payload.status ?? "ok";
		preview = payload.preview ?? "";
		length = payload.length ?? 0;
		truncated = payload.truncated === true;
	} catch {
		return `> └ ${payloadJson ? "result" : "done"}`;
	}

	if (status === "error") {
		const first = oneLine(preview).slice(0, Math.max(20, width - 12));
		return `> └ **error** ${first ? `\`${first.replaceAll("`", "'")}\`` : ""}`.trimEnd();
	}
	const size = length > 0 ? `${bytes(length)}${truncated ? ", truncated" : ""}` : "no output";
	return `> └ ok · ${size}`;
}

/**
 * Rewrite bridge markers into activity rows. Every other line is returned
 * untouched, so this is safe to run over all assistant markdown.
 */
export function renderActivityRows(markdown: string, width: number): string {
	if (!markdown.includes(" · ")) return markdown;

	return markdown
		.split("\n")
		.map((line) => {
			const match = line.trim().match(MARKER);
			if (!match) return line;

			const [, , name, rest = ""] = match;
			const body = rest.replace(ID_TAG, "");
			return name === "result" ? renderResult(body, width) : renderCall(name, body, width);
		})
		.join("\n");
}

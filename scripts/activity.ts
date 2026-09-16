/**
 * Check the activity-row rewriting against real bridge markers.
 *
 *   bun scripts/activity.ts [width]
 *
 * Samples are verbatim shapes from @saccolabs/pi-claude-cli: a plain call, a
 * call with an id tag, a truncated args preview (invalid JSON on purpose), an
 * argument-less call, and both result payloads.
 */

import { renderActivityRows } from "../src/activity.ts";

const width = Number(process.argv[2]) || 80;

const samples = [
	'[Claude Code · Bash {"command":"cd ~/omaPi && git branch -D backup-pre-author-fix && rm -rf .git/refs/original"}]',
	'[Claude Code · Bash #toolu_01abc {"command":"curl -sS \\"https://registry.npmjs.org/-/v1/search?text=keywords:pi-package&size=100\\" | python3 -c \'\\nimport…]',
	'[Claude Code · Read {"file_path":"/home/matheus/omaPi/src/logo.ts","limit":40}]',
	'[Claude Code · Grep {"pattern":"registerMarkdownTransformer","path":"docs"}]',
	"[Claude Code · TodoWrite]",
	'[Claude Code · result #toolu_01abc {"status":"ok","preview":"Deleted branch","length":1840}]',
	'[Claude Code · result #toolu_01def {"status":"error","preview":"fatal: not a git repository","length":27}]',
	"Regular prose is left alone, including a stray · separator.",
];

for (const sample of samples) {
	console.log(`in  ${sample.length > width ? `${sample.slice(0, width - 5)}…` : sample}`);
	console.log(`out ${renderActivityRows(sample, width)}`);
	console.log();
}

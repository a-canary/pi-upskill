/**
 * pi-upskill — Learn from failures, reduce token waste
 *
 * Tools:
 *   upskill-log — Log a correction during conversation
 *
 * Commands:
 *   /upskill-status — Show corrections count and threshold progress
 *   /upskill-analyze — Trigger pattern analysis (runs in background)
 *
 * Configuration (.pi/settings.json):
 *   {
 *     "upskill": {
 *       "threshold": 20,
 *       "autoAnalyze": false
 *     }
 *   }
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";

// ── Types ────────────────────────────────────────

interface Correction {
	timestamp: string;
	failure: string;
	correction: string;
	context?: string;
	tokens_wasted?: number;
	source: "user" | "self";
	strength: "strong" | "pattern";
}

interface UpskillSettings {
	threshold: number;
	autoAnalyze: boolean;
}

const DEFAULT_SETTINGS: UpskillSettings = {
	threshold: 20,
	autoAnalyze: false,
};

// ── Helpers ──────────────────────────────────────

function getCorrectionsPath(cwd: string): string {
	return path.join(cwd, ".pi", "corrections.jsonl");
}

function loadCorrections(filepath: string): Correction[] {
	if (!fs.existsSync(filepath)) return [];
	const content = fs.readFileSync(filepath, "utf-8");
	return content
		.trim()
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line));
}

function appendCorrection(filepath: string, correction: Correction): void {
	const dir = path.dirname(filepath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	fs.appendFileSync(filepath, JSON.stringify(correction) + "\n", "utf-8");
}

function getSettings(ctx: any): UpskillSettings {
	const projectSettings = ctx.projectSettings?.upskill || {};
	return { ...DEFAULT_SETTINGS, ...projectSettings };
}

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Extension ────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── upskill-log Tool ───────────────────────────

	pi.registerTool({
		name: "upskill-log",
		label: "Log Correction",
		description: `Log a failure → correction to .pi/corrections.jsonl. Use when:
1. User corrects you with "always", "never", or "remember" (strength: strong)
2. You self-correct after multiple failed attempts (strength: pattern, needs 3x)

After logging, check if threshold reached (default 20 entries). If so, suggest running /upskill-analyze.

Each field must be 30 words or less. Estimate tokens_wasted based on conversation length from mistake to correction.`,

		parameters: Type.Object({
			failure: Type.String({
				description: "What went wrong (max 30 words)",
				maxLength: 300,
			}),
			correction: Type.String({
				description: "How it was fixed / what to do instead (max 30 words)",
				maxLength: 300,
			}),
			context: Type.Optional(
				Type.String({
					description: "Relevant context (max 30 words)",
					maxLength: 300,
				}),
			),
			tokens_wasted: Type.Optional(
				Type.Number({
					description: "Estimated tokens wasted (in + out) from mistake to correction",
				}),
			),
			strength: Type.Optional(
				Type.String({
					description: "strong = always/never/remember (single occurrence sufficient), pattern = needs 3x",
					enum: ["strong", "pattern"],
				}),
			),
		}),

		async execute(toolCallId, params, _signal, _onUpdate, ctx) {
			const { failure, correction, context, tokens_wasted, strength = "pattern" } = params;

			// Validate word counts
			const failureWords = countWords(failure);
			const correctionWords = countWords(correction);
			const contextWords = context ? countWords(context) : 0;

			if (failureWords > 30 || correctionWords > 30 || contextWords > 30) {
				return {
					content: [
						{
							type: "text",
							text: `Error: Fields must be 30 words or less. Got: failure=${failureWords}, correction=${correctionWords}, context=${contextWords}`,
						},
					],
					isError: true,
				};
			}

			const entry: Correction = {
				timestamp: new Date().toISOString(),
				failure,
				correction,
				context,
				tokens_wasted,
				source: "user", // Could be inferred from context
				strength: strength as "strong" | "pattern",
			};

			const correctionsPath = getCorrectionsPath(ctx.cwd);
			appendCorrection(correctionsPath, entry);

			const corrections = loadCorrections(correctionsPath);
			const settings = getSettings(ctx);
			const count = corrections.length;

			let message = `Logged correction #${count} to .pi/corrections.jsonl`;

			if (count >= settings.threshold) {
				message += `\n\n**Threshold reached!** (${count}/${settings.threshold})\nRun /upskill-analyze to generate skills from patterns.`;
			} else {
				message += `\n\nProgress: ${count}/${settings.threshold} corrections`;
			}

			return {
				content: [{ type: "text", text: message }],
				details: { count, threshold: settings.threshold },
			};
		},

		renderCall(args, theme) {
			const strength = args.strength || "pattern";
			const strengthColor = strength === "strong" ? "warning" : "muted";
			return theme.fg("toolTitle", "upskill-log ") + theme.fg(strengthColor, `[${strength}]`);
		},

		renderResult(result, _options, theme) {
			const details = result.details as { count: number; threshold: number } | undefined;
			if (!details) {
				const text = result.content[0];
				return theme.fg("success", text?.type === "text" ? text.text : "Logged");
			}
			const pct = Math.round((details.count / details.threshold) * 100);
			const bar = "█".repeat(Math.min(10, Math.floor(pct / 10))) + "░".repeat(10 - Math.min(10, Math.floor(pct / 10)));
			return theme.fg("success", `✓ Logged #${details.count} `) + theme.fg("dim", `[${bar}] ${details.count}/${details.threshold}`);
		},
	});

	// ── /upskill-status Command ───────────────────

	pi.registerCommand("upskill-status", {
		description: "Show corrections count and threshold progress",
		handler: async (_args, ctx) => {
			const correctionsPath = getCorrectionsPath(ctx.cwd);
			const corrections = loadCorrections(correctionsPath);
			const settings = getSettings(ctx);
			const count = corrections.length;

			const strong = corrections.filter((c) => c.strength === "strong").length;
			const pattern = corrections.filter((c) => c.strength === "pattern").length;
			const totalTokens = corrections.reduce((sum, c) => sum + (c.tokens_wasted || 0), 0);

			const status =
				count >= settings.threshold
					? "🟢 Ready to analyze"
					: `🟡 ${settings.threshold - count} more needed`;

			ctx.ui.notify(
				`**Upskill Status**\n\n` +
					`Corrections: ${count}/${settings.threshold}\n` +
					`Strong: ${strong} | Pattern: ${pattern}\n` +
					`Tokens wasted (est): ${totalTokens.toLocaleString()}\n` +
					`Status: ${status}\n\n` +
					`File: ${correctionsPath}`,
				"info",
			);
		},
	});

	// ── /upskill-analyze Command ──────────────────

	pi.registerCommand("upskill-analyze", {
		description: "Analyze corrections and generate skills (runs in background)",
		handler: async (_args, ctx) => {
			const correctionsPath = getCorrectionsPath(ctx.cwd);
			const corrections = loadCorrections(correctionsPath);

			if (corrections.length === 0) {
				ctx.ui.notify("No corrections logged. Use upskill-log tool or /upskill-backfill first.", "warning");
				return;
			}

			const settings = getSettings(ctx);

			if (corrections.length < settings.threshold) {
				const proceed = await ctx.ui.confirm(
					"Below threshold",
					`Only ${corrections.length} corrections (threshold: ${settings.threshold}). Analyze anyway?`,
				);
				if (!proceed) return;
			}

			// Read the analyze skill prompt
			const skillPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "skills", "analyze", "SKILL.md");

			let analyzePrompt = "";
			try {
				const skillContent = fs.readFileSync(skillPath, "utf-8");
				// Extract content after frontmatter
				const match = skillContent.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
				if (match) analyzePrompt = match[1].trim();
			} catch {
				analyzePrompt = "Analyze the corrections and propose one high-impact edit.";
			}

			// Build the prompt with corrections
			const correctionsBlock = corrections.map((c, i) => {
				const strength = c.strength === "strong" ? "⬤" : "○";
				const tokens = c.tokens_wasted ? ` [${c.tokens_wasted} tokens]` : "";
				return `${strength} [${i + 1}] ${c.failure} → ${c.correction}${tokens}\n    Context: ${c.context || "none"}`;
			});

			const fullPrompt =
				`${analyzePrompt}\n\n` +
				`## Corrections to Analyze (${corrections.length} entries)\n\n` +
				`Legend: ⬤ = strong (single occurrence), ○ = pattern (needs 3x)\n\n` +
				correctionsBlock.join("\n") +
				`\n\n## Instructions\n\n` +
				`1. Identify patterns in the corrections\n` +
				`2. Select ONE edit with the largest impact on token usage\n` +
				`3. Apply the surgical edit to the appropriate file\n` +
				`4. Report what was changed and which corrections it addresses\n` +
				`5. DO NOT remove the corrections file — user will review`;

			// Spawn background process
			const logPath = path.join(ctx.cwd, ".pi", "upskill-analysis.log");
			const args = [
				"-p",
				"--no-session",
				"--model",
				ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "anthropic/claude-sonnet-4-5",
				fullPrompt,
			];

			ctx.ui.notify(`Spawning background analysis...\nLog: ${logPath}`, "info");

			const proc = spawn("pi", args, {
				detached: true,
				stdio: ["ignore", fs.openSync(logPath, "w"), fs.openSync(logPath, "a")],
			});

			proc.unref();

			ctx.ui.notify(
				`Background analysis started.\n` +
					`- Corrections: ${corrections.length}\n` +
					`- Log: ${logPath}\n\n` +
					`Check log for results. Use /upskill-status to see progress.`,
				"info",
			);
		},
	});
}

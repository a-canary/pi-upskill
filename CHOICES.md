# CHOICES.md — pi-upskill

All project choices in priority order. Higher choices constrain lower ones.

---

## Mission

### M-0001: Learn from failures to reduce token waste and improve behavior
Supports: (none — top-level)

Agents make repeated mistakes that waste tokens and user time. This project provides systematic learning from corrections, turning failures into skills/rules that prevent future waste.

### M-0002: Serve both end users and developers
Supports: M-0001

Primary users: Pi users wanting their agent to improve over time. Secondary: Pi developers building self-improving agent patterns.

### M-0003: Measure success by token savings
Supports: M-0001

The goal is measurable improvement: fewer wasted tokens, fewer repeated corrections, faster convergence to correct behavior.

---

## User Experiences

### UX-0001: Prioritize explicit user corrections
Supports: M-0001

When user says "always", "never", or "remember" — these are strong candidates for immediate skill/rule generation. Single occurrence is sufficient.

### UX-0002: Require pattern threshold for self-corrections
Supports: M-0001

When LLM makes multiple attempts before finding the right solution (self-correction), require 3+ occurrences before generating a skill. This filters noise from genuine patterns.

### UX-0003: Multiple input channels
Supports: M-0001

Corrections flow in through:
- Automatic: scan past sessions from pi, claude, opencode, codex
- Manual: explicit user reporting via tool
- Inline: agent suggests logging after detected corrections

### UX-0004: Non-blocking background improvement
Supports: M-0001

When threshold reached, spawn independent pi session to analyze and edit. User continues work uninterrupted.

---

## Features

### F-0001: One-time historical analysis
Supports: UX-0003

Scan existing session files:
- `~/.pi/agent/sessions/` (pi)
- `~/.claude/sessions/` or equivalent (claude)
- `~/.opencode/sessions/` (opencode)
- `~/.codex/sessions/` (codex)

Extract failures and corrections, log to `.pi/corrections.jsonl`.

### F-0002: Inline correction logging
Supports: UX-0003

Tool `upskill-log` allows agent or user to report a correction during conversation. Entry appended to `.pi/corrections.jsonl`.

### F-0003: Automatic analysis at threshold
Supports: UX-0004

When `.pi/corrections.jsonl` reaches 20+ entries, trigger background analysis:
1. Spawn new pi session (independent)
2. LLM reviews all corrections
3. LLM selects ONE edit with largest token impact
4. Apply surgical edit (skill/AGENTS.md/MEMORY.md)
5. Remove processed corrections from file

### F-0004: User-triggered analysis
Supports: UX-0003

Command `/upskill-analyze` forces immediate analysis regardless of threshold.

### F-0005: Surgical edits to any behavioral file
Supports: M-0001

Upskilling can:
- Add new skills to `.pi/skills/`
- Strengthen existing skills
- Edit `AGENTS.md` rules
- Update `MEMORY.md` facts

---

## Operations

### O-0001: Background process as independent session
Supports: UX-0004

Spawn `pi -p --no-session` with upskill prompt. Runs independently, does not block current work.

### O-0002: LLM estimates token waste
Supports: M-0003

When logging corrections, LLM provides rough estimate of tokens wasted (in + out) from mistake to correction point.

---

## Data

### D-0001: Corrections stored in .pi/corrections.jsonl
Supports: M-0001

Project-local storage. Each project tracks its own corrections independently.

### D-0002: Minimal JSONL format
Supports: D-0001

Required fields (max 30 words each):

```json
{
  "timestamp": "2025-03-13T01:30:00Z",
  "failure": "What went wrong",
  "correction": "How it was fixed",
  "context": "Relevant context",
  "tokens_wasted": 5000,
  "source": "user|self",
  "strength": "strong|pattern"
}
```

- `source`: "user" = explicit correction, "self" = LLM self-corrected
- `strength`: "strong" = always/never/remember, "pattern" = needs 3x

### D-0003: Processed corrections removed after edit
Supports: F-0003

After successful edit applied, remove the corrections that contributed to that pattern. File stays manageable.

---

## Architecture

### A-0001: Hybrid skill + tool interface
Supports: M-0001, UX-0003

- **Skills**: User-facing workflows (`/upskill-analyze`, `/upskill-backfill`)
- **Tool**: `upskill-log` for inline reporting during conversation
- **Prefix**: All commands/tools use `upskill-*`

### A-0002: LLM-driven pattern analysis
Supports: F-0003

Send all corrections to LLM with prompt:
- Find patterns
- Select ONE edit with largest token impact
- Return surgical edit specification

### A-0003: Multi-harness session parsing
Supports: F-0001

Abstract session parsing to support:
- pi JSONL format
- claude session format
- opencode format
- codex format

---

## Technology

### T-0001: Extension for tool and background spawning
Supports: A-0001

TypeScript extension provides:
- `upskill-log` tool
- Background session spawning logic
- Session file parsing

### T-0002: Skills for user commands
Supports: A-0001

Markdown skills provide:
- `/upskill-analyze` — trigger analysis
- `/upskill-backfill` — historical scan

---

## Implementation

### I-0001: Start with extension, add skills
Supports: A-0001

1. Build extension with `upskill-log` tool
2. Add session parsing for pi format
3. Add backfill skill
4. Add analyze skill
5. Extend parsing to other harnesses

### I-0002: Minimal viable corrections format
Supports: D-0002

First version: JSONL with required fields only. Add optional fields later if needed.

### I-0003: Threshold configurable
Supports: F-0003

Default 20 corrections, configurable via settings:

```json
{
  "upskill": {
    "threshold": 20,
    "autoAnalyze": true
  }
}
```

# pi-upskill

Learn from failures. Reduce token waste. Improve automatically.

## Overview

pi-upskill tracks corrections (failures → fixes) and generates skills/rules to prevent future mistakes.

**Core flow:**
1. Log corrections during conversation (`upskill-log` tool)
2. Backfill from past sessions (`/upskill-backfill`)
3. At threshold, analyze and generate ONE high-impact edit (`/upskill-analyze`)

## Installation

```bash
# Link extension globally
ln -s ~/pi-upskill/extension/index.ts ~/.pi/agent/extensions/upskill.ts

# Or add to .pi/settings.json
{
  "extensions": ["~/pi-upskill/extension"],
  "skills": ["~/pi-upskill/skills/backfill", "~/pi-upskill/skills/analyze"]
}
```

## Usage

### During conversation: log corrections

The agent uses the `upskill-log` tool:

```
Agent: [uses upskill-log tool]
  failure: "Committed without running tests"
  correction: "Always run tests before commit"
  strength: "strong"
  tokens_wasted: 3000

Result: Logged correction #5 to .pi/corrections.jsonl
        Progress: 5/20 corrections
```

**Strength levels:**
- `strong` — User said "always/never/remember" → single occurrence = skill
- `pattern` — Self-correction or repeated issue → needs 3x occurrences

### One-time: scan past sessions

```
/upskill-backfill
```

Scans session files from pi, claude, opencode, codex. Extracts corrections for review.

### At threshold: analyze and improve

```
/upskill-analyze
```

When 20+ corrections logged, triggers background analysis:
1. LLM reviews all corrections
2. Selects ONE edit for maximum token impact
3. Applies surgical edit (skill/AGENTS.md/MEMORY.md)
4. Removes addressed corrections

### Check progress

```
/upskill-status
```

Shows: count, threshold, strong vs pattern, total tokens wasted.

## Data Format

`.pi/corrections.jsonl` — one JSON object per line:

```json
{"timestamp":"2025-03-13T01:30:00Z","failure":"Committed without tests","correction":"Always run tests first","context":"User reminder after broken CI","tokens_wasted":3000,"source":"user","strength":"strong"}
```

**Required fields (max 30 words each):**
- `timestamp` — ISO 8601
- `failure` — What went wrong
- `correction` — How to fix / what to do instead
- `source` — "user" or "self"
- `strength` — "strong" or "pattern"

**Optional:**
- `context` — Relevant context
- `tokens_wasted` — Estimated tokens

## Configuration

`.pi/settings.json`:

```json
{
  "upskill": {
    "threshold": 20,
    "autoAnalyze": false,
    "lookbackDays": 7
  }
}
```

## Architecture

```
~/pi-upskill/
├── CHOICES.md           # Decision record
├── PLAN.md              # Implementation phases
├── README.md            # This file
├── extension/
│   └── index.ts         # upskill-log tool, commands
└── skills/
    ├── analyze/SKILL.md # Pattern analysis workflow
    └── backfill/SKILL.md # Historical scan workflow
```

**Hybrid interface:**
- Extension provides `upskill-log` tool (inline during conversation)
- Skills provide `/upskill-backfill` and `/upskill-analyze` commands

## Key Decisions

See [CHOICES.md](CHOICES.md) for full decision record.

| ID | Decision |
|----|----------|
| UX-0001 | User corrections with "always/never/remember" → immediate skill |
| UX-0002 | Self-corrections → need 3x pattern before skill |
| F-0003 | At 20 corrections → background analysis, ONE edit for max impact |
| D-0003 | Processed corrections removed after edit applied |

## Inspiration

- [upskill.md](https://github.com/claude-admin/cc-plugins) — Pattern extraction from memory
- [pi-reflect](https://github.com/jo-inc/pi-reflect) — Iterative self-improvement

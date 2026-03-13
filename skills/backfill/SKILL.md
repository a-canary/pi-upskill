---
name: backfill
description: Scan past sessions and extract corrections to .pi/corrections.jsonl. Use for one-time historical analysis of failures.
---

# /upskill-backfill — Historical Correction Extraction

Scan past conversation sessions to identify and log failures → corrections.

## When to Use

- First-time setup: extract patterns from past sessions
- After realizing a pattern of mistakes
- User requests historical analysis

## Process

### Step 1: Locate Session Files

Search for session files in common locations:

```bash
# Pi sessions
ls ~/.pi/agent/sessions/**/*.jsonl

# Claude sessions (if available)
ls ~/.claude/sessions/**/*.jsonl 2>/dev/null

# OpenCode sessions
ls ~/.opencode/sessions/**/* 2>/dev/null

# Codex sessions
ls ~/.codex/sessions/**/* 2>/dev/null
```

### Step 2: Filter by Date

Default lookback: 7 days. Ask user to confirm or adjust.

```bash
# Find files from last N days
find ~/.pi/agent/sessions -name "*.jsonl" -mtime -7
```

### Step 3: Extract Corrections

For each session file, look for:

**Explicit user corrections:**
- "no", "not that", "wrong", "actually", "I meant"
- "stop", "don't", "never", "always"
- "remember", "make sure to", "from now on"

**Strong signals (always/never/remember):**
- Mark as `strength: "strong"` — single occurrence sufficient for skill

**Self-corrections:**
- Multiple tool calls attempting the same thing
- Agent says "let me try again" or "that didn't work"
- Mark as `strength: "pattern"` — needs 3x for skill

### Step 4: Estimate Token Waste

For each correction:
1. Find where the mistake started
2. Find where correction was applied
3. Count messages/turns between
4. Rough estimate: ~500-2000 tokens per turn (varies by model)

### Step 5: Present Candidates

Show extracted corrections for review:

```
Found 12 potential corrections:

[1] STRONG: "Always run tests before committing"
    Context: User reminded after broken commit
    Tokens: ~3000

[2] PATTERN: "Don't use deprecated API"
    Context: Self-corrected after error
    Tokens: ~1500

...

Review? [y/n/select]
```

### Step 6: Log Approved Corrections

For each approved correction, use the `upskill-log` tool or write directly:

```json
{"timestamp":"2025-03-13T00:00:00Z","failure":"Committed without tests","correction":"Always run tests first","context":"User reminder after broken CI","tokens_wasted":3000,"source":"user","strength":"strong"}
```

### Step 7: Report Summary

```
Backfill complete:
- Sessions scanned: 47
- Corrections found: 12
- Logged: 8 (4 skipped)
- Total tokens wasted: ~15,000

Run /upskill-status to see progress.
```

## Output

Appends to `.pi/corrections.jsonl`.

## Verification

```bash
cat .pi/corrections.jsonl | wc -l
```

## Session Parsing Details

### Pi JSONL Format

Each line is a JSON object. Look for:

```json
{"type":"message","message":{"role":"user","content":[{"type":"text","text":"no, that's wrong"}]}}
{"type":"message","message":{"role":"assistant","content":[{"type":"text","text":"Let me try again..."}]}}
```

User messages with corrections → extract failure/correction pair.

### Other Formats

Claude/OpenCode/Codex: Parse similarly, looking for user correction signals and agent self-corrections.

## Options

User can specify:
- `--lookback N` — Days to look back (default: 7)
- `--source pi|claude|all` — Which session sources to scan
- `--auto` — Skip review, log all found corrections

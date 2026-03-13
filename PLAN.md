# PLAN.md — pi-upskill Implementation

**Goal**: Learn from failures to reduce token waste through automatic skill/rule generation.

**Choices implemented**: M-0001, M-0003, UX-0001, UX-0002, F-0001, F-0002, F-0003, A-0001

---

## Phase 1: Core Extension

**Deliverable**: Extension with `upskill-log` tool and corrections storage.

### Step 1: Project Structure

```
~/pi-upskill/
├── CHOICES.md
├── PLAN.md
├── README.md
├── extension/
│   └── index.ts         # Main extension
└── skills/
    ├── analyze/SKILL.md # /upskill-analyze
    └── backfill/SKILL.md # /upskill-backfill
```

### Step 2: `upskill-log` Tool

Registers tool for logging corrections during conversation.

**Parameters:**
- `failure` (required, max 30 words): What went wrong
- `correction` (required, max 30 words): How it was fixed
- `context` (optional, max 30 words): Relevant context
- `tokens_wasted` (optional, number): Estimated tokens
- `strength` (optional, default "pattern"): "strong" or "pattern"

**Behavior:**
- Append JSONL entry to `.pi/corrections.jsonl`
- Check threshold (default 20)
- If threshold met, notify user that analysis ready

### Step 3: Corrections Storage

File: `.pi/corrections.jsonl`

```json
{"timestamp":"2025-03-13T01:30:00Z","failure":"...","correction":"...","context":"...","tokens_wasted":5000,"source":"user","strength":"strong"}
```

---

## Phase 2: Historical Backfill

**Deliverable**: Skill to scan past sessions and extract corrections.

### Step 1: Pi Session Parser

Parse `~/.pi/agent/sessions/` JSONL files.

Extract:
- User corrections (contains "no", "wrong", "not that", "actually")
- "always/never/remember" patterns
- Self-corrections (multiple attempts before success)

### Step 2: `/upskill-backfill` Skill

Interactive flow:
1. Scan specified lookback period (default 7 days)
2. Present candidates for review
3. User confirms which to log
4. Append to `.pi/corrections.jsonl`

---

## Phase 3: Automatic Analysis

**Deliverable**: Background analysis when threshold reached.

### Step 1: Threshold Detection

After each `upskill-log`, check entry count.

If >= threshold:
- Notify user: "20 corrections logged. Run /upskill-analyze to improve."
- Optional: auto-trigger if configured

### Step 2: `/upskill-analyze` Skill

Flow:
1. Read `.pi/corrections.jsonl`
2. Spawn background pi session
3. LLM reviews all corrections
4. LLM selects ONE edit for maximum impact
5. Apply surgical edit
6. Remove processed corrections
7. Report results

### Step 3: Background Session

Spawn independent process:

```bash
pi -p --no-session --model anthropic/claude-sonnet-4-5 \
  "Analyze corrections and propose edit..." \
  > .pi/upskill-analysis.log
```

---

## Phase 4: Multi-Harness Support

**Deliverable**: Parse sessions from claude, opencode, codex.

### Step 1: Abstract Session Parser

Interface:
```typescript
interface SessionParser {
  findSessions(dir: string, lookback: number): string[];
  extractCorrections(filepath: string): Correction[];
}
```

### Step 2: Implement Parsers

- `PiSessionParser` (Phase 2)
- `ClaudeSessionParser`
- `OpenCodeSessionParser`
- `CodexSessionParser`

---

## Verification

### Phase 1
```bash
# Tool registered
pi -e ~/pi-upskill/extension/index.ts -p "list tools" | grep upskill-log

# Corrections logged
cat .pi/corrections.jsonl | wc -l
```

### Phase 2
```bash
# Backfill runs
pi --skill ~/pi-upskill/skills/backfill -p "scan last 3 days"
```

### Phase 3
```bash
# Analysis triggers
# After 20+ corrections logged
pi --skill ~/pi-upskill/skills/analyze
```

---

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

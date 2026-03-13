---
name: analyze
description: Analyze logged corrections and generate one high-impact skill or rule edit. Use when threshold reached or user requests improvement.
---

# /upskill-analyze — Pattern Analysis & Skill Generation

Review corrections, find patterns, apply ONE surgical edit for maximum token savings.

## When to Use

- Threshold reached (default: 20 corrections)
- User explicitly requests analysis
- After backfill to process historical corrections

## Process

### Step 1: Read Corrections

Load all entries from `.pi/corrections.jsonl`:

```bash
cat .pi/corrections.jsonl
```

### Step 2: Identify Patterns

Group corrections by:

**Type:**
- Same failure, same correction → strong pattern
- Same failure, different correction → needs synthesis
- Related failures → cluster by keyword/theme

**Priority:**
1. `strength: "strong"` entries — single occurrence sufficient
2. High `tokens_wasted` — prioritize for impact
3. Frequency — 3+ pattern entries = solid pattern

### Step 3: Select ONE Edit

Ask: "Which single edit would have the largest impact on token usage?"

Consider:
- How many corrections would this prevent?
- What's the total tokens wasted across those corrections?
- Is this a new skill or an edit to existing file?

**Edit targets (in order):**
1. `.pi/skills/` — Add new skill for workflow/pattern
2. `AGENTS.md` — Strengthen or add rule
3. `MEMORY.md` — Add durable fact
4. Existing skill — Strengthen wording

### Step 4: Generate Edit

For new skills, create `.pi/skills/{name}/SKILL.md`:

```markdown
---
name: {name}
description: {when to use}
---

# /{name} — {purpose}

## Pattern Source

{why this skill exists}

## Process

1. {step}
2. {step}

## Verification

{testable gate}
```

For existing files, propose surgical edit:
- Add bullet point to existing section
- Strengthen wording with "ALWAYS" / "NEVER"
- Add concrete example

### Step 5: Apply Edit

Use `edit` tool to apply the change. Record:
- File edited
- Lines changed
- Corrections addressed

### Step 6: Clean Up Corrections

Remove the corrections that contributed to this edit:

```bash
# Keep only unprocessed corrections
# (those not matching the pattern we just addressed)
```

Leave a marker comment for traceability:

```json
{"timestamp":"2025-03-13T02:00:00Z","event":"upskill","action":"added_skill","name":"run-tests-first","corrections_addressed":3,"tokens_saved":9000}
```

### Step 7: Report Results

```
Analysis complete.

**Edit Applied:**
- File: .pi/skills/run-tests-first/SKILL.md (created)
- Action: Added new skill

**Impact:**
- Corrections addressed: 3
- Tokens to save: ~9,000 per occurrence

**Removed from corrections.jsonl:**
- #4 "Committed without tests"
- #7 "Forgot to run tests"
- #12 "Skipped test step"

Remaining: 17 corrections
```

## Example Analysis Prompt

```
You are analyzing logged corrections to improve agent behavior.

## Corrections (12 entries)

⬤ [1] Committed without running tests → Always run tests first
    Context: User reminder after broken CI
    [3000 tokens]

○ [2] Used deprecated API → Check docs for current method
    Context: Self-corrected after error
    [1500 tokens]

○ [5] Used deprecated API → Check docs for current method
    Context: Same pattern as #2
    [2000 tokens]

...

Legend: ⬤ = strong (single = skill), ○ = pattern (needs 3x)

## Task

1. Find patterns in these corrections
2. Select ONE edit with largest token impact
3. Apply surgical edit to appropriate file
4. Report what was changed
5. List which corrections this addresses

Constraints:
- Only ONE edit
- Maximum impact on future token usage
- Prefer adding skills for workflows
- Prefer strengthening AGENTS.md for behavioral rules
```

## Verification

After edit:
```bash
# Skill exists and loads
pi --skill .pi/skills/{name} -p "help"

# Corrections reduced
cat .pi/corrections.jsonl | wc -l
```

## Configuration

```json
{
  "upskill": {
    "maxEditsPerAnalysis": 1,
    "removeAddressedCorrections": true
  }
}
```

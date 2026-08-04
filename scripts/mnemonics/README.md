# Mnemonic generation

Batch-generates `meaningMnemonic` / `readingMnemonic` for `Subject` rows via
an LLM. Nothing else in the DB is touched — see "What it writes" below.

No open, licensed mnemonic dataset exists for Japanese kanji/vocab/radicals
(WaniKani's are copyrighted, Heisig's keywords are copyrighted, Kanji Alive
explicitly excludes mnemonics from its CC BY data). This script exists to
generate original starting-point mnemonics instead.

**Generated mnemonics are a first draft, not a finished product.** Read them,
fix the ones that are weak or wrong, and edit them through the app's
mnemonic editor. Anything you edit there is marked `"authored"` and this
script will never touch it again, even with `--regenerate`.

## Authored vs. generated

`Subject.mnemonicSource` tracks where a mnemonic came from:

- `null` — never touched, no mnemonic yet.
- `"generated"` — written by this script. Safe to regenerate.
- `"authored"` — hand-edited by you through the mnemonic editor. Never
  regenerated, never overwritten, no matter what flags this script is run
  with.

Saving an edit through the editor (`src/server/actions/mnemonics.ts`'s
`saveMnemonic`) flips `mnemonicSource` to `"authored"` automatically.

## Running it

```
npm run mnemonics:generate -- --type=RADICAL --level=1 --limit=5
```

The script prints an item count and a rough token estimate, then asks for
confirmation before making any real API calls (skip the prompt with
`--yes`).

### Flags

| Flag | Effect |
|---|---|
| `--type=KANJI\|RADICAL\|VOCAB\|GRAMMAR\|KANA` | Scope to one subject type. Omit to run across all five. |
| `--level=N` | Scope to one curriculum level (1-60). |
| `--limit=N` | Cap the number of subjects processed in this run. |
| `--dry-run` | Print prompts and parsed responses, write nothing. Implies the mock client. |
| `--regenerate` | Also select subjects where `mnemonicSource = "generated"` (redo them). Rows with `mnemonicSource = "authored"` are still never selected. Without this flag, only `mnemonicSource IS NULL` rows are selected. |
| `--yes` | Skip the cost-estimate confirmation prompt. |
| `--mock` | Use the deterministic mock client instead of the real Anthropic API. Useful for a dry run against the real DB without spending credits. |

### Resumability

The script always selects `mnemonicSource IS NULL` (or `= "generated"` with
`--regenerate`). If you interrupt a run partway through, just re-run the same
command — already-written rows won't be reselected, so it picks up where it
left off.

### Batching

Subjects are processed in batches of 5 with a 1 second delay between
batches, to avoid hammering the API. Each batch's calls run concurrently.

## Setup

Set `ANTHROPIC_API_KEY` in `.env` (see `.env.example`). Not required for
`--dry-run` or `--mock` runs.

## Cost

Rough estimate only — the script's own pre-run printout is the actual number
for whatever scope you're running, but as a ballpark: a Sonnet-class model at
current pricing, ~400-600 input tokens and ~100-150 output tokens per
subject, puts a full run across all ~47,000 seeded subjects in the
low-to-mid tens of dollars. Scope a run with `--type`/`--level`/`--limit`
rather than running the whole curriculum at once, especially at first.

## Prompt construction

Prompts are pure functions in `prompts.ts`, one per subject type, unit
tested in `prompts.test.ts`. Tune wording there without touching the runner.

- **RADICAL** — name and character; asks for a shape-to-name image.
- **KANJI** — character, meanings, on/kun readings, and its radical
  components' names (from `SubjectComponent`); asks for a meaning mnemonic
  built out of the component names, and a separate reading mnemonic for the
  primary on'yomi.
- **VOCAB** — word, reading, meanings, and its kanji components' meanings;
  asks how the kanji meanings combine, plus a reading mnemonic when the
  script detects the reading isn't a straightforward assembly of the kanji's
  recorded on/kun readings.
- **GRAMMAR** — pattern, formation, English gloss; asks for a memorable hook
  for what the pattern means and when it's used.
- **KANA** — character, romaji, script; asks for a shape-based mnemonic.

Every prompt explicitly instructs the model not to reproduce WaniKani,
Heisig, or any other existing mnemonic system, and to respond with JSON only.
Responses are validated against the expected shape before writing; anything
malformed is logged and skipped rather than stored.

## What it writes

Only `Subject.meaningMnemonic`, `Subject.readingMnemonic`, and
`Subject.mnemonicSource`. Nothing else — no `UserSubject`, `Session`,
`XpEvent`, `DailyActivity`, or `TutorialCompletion` row is ever read or
written by this script.

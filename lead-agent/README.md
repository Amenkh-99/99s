# Lead Agent: zero-cost, source-backed B2B lead research (MVP)

A local-first pipeline that finds and researches small US staffing and recruiting firms. The niche can be changed in `config/niche.json`.

- It verifies every important claim against the company's own web pages.
- It deduplicates, scores and stores leads, and exports CSVs for **you** to review.
- It never contacts anyone, never spends credits and never needs an API key.

```
 scripts\run-research.ps1  (manual)                      scripts\run-pipeline.ps1  (manual)
 ┌──────────────────────────────────────────┐          ┌───────────────────────────────────────────────┐
 │ Claude Code, headless, your subscription │          │ n8n (local, 127.0.0.1 only)                   │
 │ 1 discovery: WebSearch (+ free Apollo     │  JSON    │ 3 parse + dedupe (domain / company name)      │
 │   people search via Firecrawl, if present)│ ───────► │ 4 re-download every source page and check     │
 │ 2 research: WebSearch + WebFetch only,    │ data\    │   each phone/email/name/quote is really there │
 │   facts with source URL + exact quote     │ inbox\   │ 5 score (rules) + Ollama llama3.2:3b advisory │
 │ guard hook blocks every other tool        │          │ 6 do-not-contact + your status updates        │
 └──────────────────────────────────────────┘          │ 7 save data\db\leads.json, export CSVs, logs  │
                                                       └───────────────────────────────────────────────┘
```

Nothing runs on a schedule. The n8n workflow is inactive, uses a manual trigger, and no Windows Task Scheduler entry is created.

---

## 1. Get the files onto your PC

In **Windows PowerShell**, pick a folder that is not synced by OneDrive and has no spaces in its path:

```powershell
cd $HOME
git clone --branch claude/epic-albattani-t2jt4k https://github.com/Amenkh-99/99s.git
cd 99s\lead-agent
```

If you already cloned the repo:

```powershell
cd $HOME\99s
git fetch origin
git checkout claude/epic-albattani-t2jt4k
git pull
cd lead-agent
```

Without git, open the branch on GitHub, choose **Code → Download ZIP**, and extract it.

Allow this project's scripts to run **in the current window only**. This doesn't change system settings, and you repeat it in each new window:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

## 2. Check your environment (read-only)

```powershell
.\scripts\check-env.ps1
```

What it checks:
- Node 24 or newer.
- Claude Code is installed and supports the needed flags.
- **`ANTHROPIC_API_KEY` is not set.** If it were, Claude Code would bill that key instead of your subscription.
- Whether Firecrawl is visible to Claude Code.
- That Ollama answers with `llama3.2:3b`.
- That n8n is installed and port 5678 is free.

Then prove that headless Claude Code works with your login, and that WebSearch and WebFetch work behind the guard. This makes two tiny calls and uses a small amount of subscription usage:

```powershell
.\scripts\check-env.ps1 -Live
```

**Expected:** `0 failures`. Before n8n is installed, you'll see a warning that n8n is missing; that's expected. If Firecrawl isn't visible, that's also only a warning: use `-NoApollo` in step 6.

## 3. Install n8n (the only install)

n8n Community Edition is free and self-hosted. The version is pinned so it matches what was tested:

```powershell
npm install -g n8n@2.43.4
```

This takes a few minutes and about 1 GB of disk. Close and reopen PowerShell afterwards so `n8n` is on your PATH. Then repeat the `Set-ExecutionPolicy` line and `cd $HOME\99s\lead-agent`.

## 4. Set up the project (non-destructive)

```powershell
.\scripts\setup.ps1
```

This step:
- creates the `data\` folders, an empty lead database and your two editable lists (`config\do_not_contact.csv`, `config\lead_updates.csv`);
- generates the workflow for your folder;
- imports it into n8n as **inactive** with a manual trigger.

It never overwrites existing files.

## 5. Offline test (no Claude usage, no credits)

```powershell
.\scripts\test-offline.ps1
```

This step:
1. Runs the 21 unit tests: normalization, verification, scoring, deduplication, CSV export and the guard hook.
2. Drops a research file with **deliberately fabricated** facts into the inbox.
3. Runs the n8n pipeline.

Expected lines:
- `all fabricated phone/email/name/count/industry claims were rejected`
- `the one real quote on example.com was verified`
- in the summary, `ollama_answers` greater than 0 (this shows Ollama was used)

The test leaves a fake lead called "Example Domain Staffing LLC". Clear it before real use. Clearing **moves** the data folder to `archive\`; it deletes nothing:

```powershell
.\scripts\archive-data.ps1
```

## 6. First live run (small)

```powershell
.\scripts\run-research.ps1 -Companies 2
.\scripts\run-pipeline.ps1
```

`run-research` takes about 2–5 minutes and uses some of your Claude subscription usage. Add `-NoApollo` if step 2 said Firecrawl isn't visible. `run-pipeline` prints a summary like this:

```
new_leads : 2   qualified : 0   needs_review : 1   rejected : 1
pages_checked : 7   pages_ok : 7   claims_total : 9   claims_verified : 9   errors : 0
```

Open the results in Excel:

| File | What it is |
|---|---|
| `data\exports\qualified_ready_for_review.csv` | Qualified leads, not on the do-not-contact list, not yet contacted. **Start here.** |
| `data\exports\leads_master.csv` | Every lead in the database, best score first |
| `data\exports\new_leads_<run>.csv` | Leads added in that run |
| `data\exports\evidence_<run>.csv` | Every claim, with its source URL, exact quote and verification result |
| `data\logs\run_<run>.json`, `run_history.csv`, `errors_<run>.csv` | Run summaries and errors |
| `data\logs\guard.log` | Every tool call Claude tried, and whether the guard allowed it |
| `data\logs\claude_runs.csv`, `research_<run>.log` | Claude Code run log: turns, duration, failures |

To inspect the workflow visually (optional):
1. Run `.\scripts\start-n8n.ps1`.
2. Open http://localhost:5678 and create the local owner account. It's stored only on your PC.
3. Open **Lead Agent - verify, score and save (manual)** and click **Execute workflow**.

## 7. Day-to-day (manual)

```powershell
.\scripts\run-research.ps1 -Companies 10     # default with no flag: 20 (4 batches of 5)
.\scripts\run-pipeline.ps1
```

- **Mark progress:** add rows to `config\lead_updates.csv`, then run `run-pipeline.ps1` to apply them. For example:
  ```
  domain,outreach_status,notes
  acmestaffing.com,contacted_manually,Called 10/14; asked for info by email
  ```
  Allowed statuses: `not_contacted, ready_for_review, contacted_manually, replied, meeting_booked, not_interested, do_not_contact`.
- **Never contact:** add a row to `config\do_not_contact.csv` (`domain,company_name,reason`). It wins over everything else, on every run.
- **Change the niche:** edit `config\niche.json` (keywords, titles, states in `locations`, size range, opportunity signals, offer). Then run `.\scripts\setup.ps1` again so the workflow picks up the new limits.

---

## What a lead contains

| Column | Rule |
|---|---|
| `company_name`, `website`, `domain` | `domain` is normalized (no scheme, no `www.`, no path) and is the main duplicate key |
| `location`, `employee_estimate`, `phone`, `email`, `decision_maker_name`/`_role`, `process_evidence`, `job_volume_evidence` | **Filled only if verified** on the page in the matching `*_source_url` column |
| `unverified_claims` | Anything Claude reported that the verifier could not confirm, with the reason and URL. Check these by hand; never treat them as facts. |
| `automation_opportunity_hypothesis`, `outreach_angle_hypothesis` | Claude's **hypotheses**, labelled as such |
| `fit_score` (0–100), `score_breakdown` | Rule-based score; see below |
| `confidence`, `confidence_label` | Share of core fields that were verified |
| `qualification` | `qualified`, `needs_review`, `low_fit` or `rejected` |
| `llm_fit_label`, `llm_fit_reason` | Advisory label from local `llama3.2:3b` (does not change the score; see notes) |
| `discovery_source`, `discovered_at`, `last_researched_at`, `run_id` | Where and when the lead came from |
| `outreach_status`, `do_not_contact`, `dnc_reason`, `notes` | Owned by you; runs never overwrite them |

**Scoring:**

| Signal | Points |
|---|---|
| Verified site | +5 |
| Verified industry quote | +5 |
| Verified size within 10–100 employees | +20 (unknown: +5; outside range: 0 and **rejected**) |
| Verified process evidence | +20 (+25 if 2 or more) |
| Verified job volume | +10 |
| Decision-maker with verified name and role | +15 (+10 if the role is unconfirmed) |
| Verified phone | +8 |
| Verified email | +7 |
| Verified location | +5 |

**Qualification:**
- `qualified`: score ≥ 55, plus a verified website, a verified industry, and at least one verified contact channel. The thresholds are in `config/niche.json`.
- `needs_review`: score ≥ 35.
- `rejected`: Claude found the company isn't in the niche, or its verified size is out of range.

**Duplicates:** a lead counts as a duplicate when its normalized domain matches, or its normalized company name matches (with Inc/LLC/punctuation removed). Duplicates are skipped and listed in the run log. The research runner also gives Claude the list of known companies so it doesn't re-research them.

## Safety guarantees and how they are enforced

| Guarantee | Enforcement |
|---|---|
| No paid calls or credits | Research batches run with `--strict-mcp-config` (no connectors at all) and only the WebSearch and WebFetch tools. Discovery may also use the Firecrawl connector, but `claude/guard-hook.js`, a PreToolUse hook, allows **only** the free `apollo/people/search` capability with ≤ 25 results. It denies Firecrawl URL scraping and search, every paid Apollo call, and every other tool. Unit-tested and logged in `data\logs\guard.log`. |
| Subscription, not API key | The runner refuses to start when `ANTHROPIC_API_KEY` is set. |
| No outreach | Gmail and every other connector are denied by the guard. No code sends email or makes calls. Only you change `outreach_status`. |
| No invented data | Every fact needs a source URL and an exact quote. n8n re-downloads the page and checks phone numbers by digits, emails as exact text, decision-makers by full name (and role), and other facts by quote. Anything not found stays out of the fact columns. |
| Nothing exposed publicly | n8n listens on 127.0.0.1 only. The verifier refuses localhost and private-network URLs. n8n file access is limited to this project's `data` and `config` folders. |
| Non-destructive | `leads.json` is backed up to `data\db\backups\` before every write. Inbox files are never deleted (they're tracked as processed). `archive-data.ps1` moves files instead of deleting them. |
| No unattended runs | No schedule exists; you start every run. |

**Rate limits, retries and logging:**

| Step | Behaviour |
|---|---|
| Claude runs | Limited by `run_limits` in `config/niche.json`: batch size, batches per run, `max_turns`, a 20 s pause between runs and a 25-minute timeout. A failed run is retried once. The run stops early if a usage limit is reported. |
| Page verification | 1 request every 1.5 s, at most 150 pages per run, a 20 s timeout and 3 tries. A failed fetch leaves that claim unverified and is written to the error log. |
| Ollama | One request at a time, 2 tries. If Ollama is down, the run continues without it. |

## Measured results and honest limits

- **Live test in a cloud container:** discovery found 4 candidates and 2 were researched in 43 s. All 9 claims were verified against the live pages. Horizontal Talent was **rejected** (its own site says 2100+ employees). Accurate Staffing came out as **needs_review**: it has real intake evidence, but no phone or email appears in its HTML, so none was recorded.
- **Volume:** 20 qualified leads a day isn't guaranteed. Many small agency sites don't publish a named owner, an employee count, or a phone/email in their HTML. Run a pilot week and read `run_history.csv` for the real yield.
- **JavaScript-only pages:** some sites only show content after JavaScript runs. Facts there can't be machine-verified and appear under `unverified_claims`.
- **Ollama (`llama3.2:3b`)** works on a CPU at roughly 15 s per lead. In testing it gave a fake company a "strong_fit" label, so it is **advisory by default** (`ollama.affects_score: false`).
- **Apollo free search** shows masked surnames. It's used only to discover company names, never for decision-makers.
- **Name-based duplicate matching** ignores state on purpose, to be safe. Two different firms with identical names would be treated as one; check the run log's `duplicates` list if that seems wrong.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `running scripts is disabled on this system` | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that window. |
| `n8n` is not recognized after install | Close and reopen PowerShell, or check `npm config get prefix` is on your PATH. |
| `Access to the file is not allowed` in n8n | Start n8n only through the scripts; they set `N8N_RESTRICT_FILE_ACCESS_TO` to this project. |
| `The file or directory does not exist` when writing | Run `.\scripts\setup.ps1` again; it recreates missing folders. |
| Research says usage limit reached | Wait for your Claude limit to reset. Results already saved are kept. Lower `-Companies` next time. |
| Firecrawl not visible / guard denies it | Use `-NoApollo`; web search alone works. |
| Wrong Claude found / `claude` not found | Set `$env:LEAD_AGENT_CLAUDE` to the full path shown by `where.exe claude`. |

## Project layout

```
config/niche.json          niche, limits, scoring thresholds, Claude model, Ollama, verification limits
config/*.example.csv       templates for your do-not-contact list and status updates
claude/*.prompt.md         discovery and research instructions for Claude Code
claude/*.schema.json       structured output schemas (enforced with --json-schema)
claude/guard-hook.js       zero-cost / no-outreach tool guard (PreToolUse hook)
scripts/research.js        research runner (discovery, dedupe, batches, retries, logs)
scripts/*.ps1              Windows entry points (check, setup, run, test, archive)
src/core.js                normalization, verification, scoring, dedupe, CSV (embedded in n8n)
n8n/build-workflow.js      generates the n8n workflow for your folder
test/                      unit tests and the fabricated-data fixture
data/  (git-ignored)       inbox, database, exports, logs, generated workflow
```

## Not done yet (waiting for your approval)

- Scheduled daily runs through Windows Task Scheduler. It would call `run-research.ps1` and then `run-pipeline.ps1`; nothing is configured yet.
- Any use of credit-consuming Firecrawl or Apollo capabilities. These stay blocked by the guard.

# Strategy

This document provides an overview of the Tasker5000 system, including its objectives and guiding principles.
Use it as the canonical place to capture major updates, goals, and the files that keep this project running.
tasker5000/
├── STRATEGY.md              # Overview of system + major updates/goals log
├── PROMPTS.md               # Codex/GPT prompt history
├── PROGRESS_LOG.md          # What’s working, what’s not
├── VERSIONS/                # Snapshots of key components
└── (optional) README.md     # You can auto-generate this later


# TASKER 5000 — STRATEGY LOG

## Objective
Tasker 5000 is a neuroadaptive task execution system that dynamically selects and prioritizes administrative, clinical, and academic work based on cognitive/physical state and backlog pressure.

## Current Phase
Hybrid Execution — Sprint 0

## Build Strategy
- Mobile-first interaction
- Codex for generation
- GitHub + VS Code for code commits
- System logic split into two engines: Capacity Engine (ηH) + FMCA Loop


## Major Updates Log
- **2024-06-30** — Added explicit major updates/goals tracking to STRATEGY.md so it can serve as the single source of truth for system direction and history.


## Goals
- Finalize ηH output integration with FMCA thresholds to enable mode-aware execution.
- Define escalation criteria and success metrics for Swap-3 and Accelerator timers.
- Draft user-facing README that summarizes interaction model and provides quickstart steps.


## Sprint 1 — FMCA Execution Engine

🧠 Purpose:
- Automates task execution flow per chart using FMCA rules
- Integrates timers: Micro-Unstick (5), Accelerator (12), Swap-3 (mode-specific)
- Handles escalation, return caps, and friction tracking

📂 File: `fmca_engine.py`
🔁 Functions:
- `run_fmca_loop()`: main executor
- `micro_unstick()`, `accelerator()`, `swap_3()`, `escalate()`: action handlers
✅ Next: bind with `etaH` output to select correct mode threshold


Sprint 2

Connect /compute_etaH output to run_fmca_loop()

Accept live state input + batch → return FMCA execution plan

Deploy that as /start_fmca_session POST endpoint

You’ll hit it like:

POST /start_fmca_session
{
  "capacity_input": { ... },
  "chart_batch": [ { id, type, age_days, required_today }, ... ]
}

SPRINT 3 — State Memory + Parked Chart Queue
🎯 Objective:

Persist decisions across sessions.
This means charts that were Parked or Escalated stay remembered — so next time you hit /compute_etaH, they’re:

Excluded from top-priority batch (unless forced by age)

Tracked for how many times they’ve been swapped

Eventually escalated if they keep stalling


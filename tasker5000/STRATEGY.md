# Strategy

This document provides an overview of the Tasker5000 system, including its objectives and guiding principles.
tasker5000/
├── STRATEGY.md              # Overview of system
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


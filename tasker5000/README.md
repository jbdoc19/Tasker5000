# Tasker5000

Tasker5000 is a neuroadaptive task execution system that dynamically manages task execution based on cognitive and physical capacity.

## Overview

The system consists of two main engines:

1. **Capacity Engine (ηH)**: Computes human capacity score based on physical/mental state, backlog pressure, and other factors
2. **FMCA Loop**: Executes tasks with adaptive interventions (Focus, Micro-unstick, Accelerator, Swap-3, Escalation)

## Features

- **Adaptive Mode Selection**: Automatically selects execution mode (Recovery/Turtle/Cruise/Unicorn) based on capacity
- **Smart Interventions**: Applies timely interventions to maintain productivity:
  - Micro-Unstick at 5 minutes
  - Accelerator at 12 minutes
  - Swap-3 at mode-specific time
  - Escalation for critical tasks
- **REST API**: FastAPI-based endpoints for easy integration
- **Comprehensive Testing**: 14 test cases covering all functionality

## Installation

```bash
pip install -r requirements.txt
```

## Quick Start

```bash
# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000

# Access API docs
open http://localhost:8000/docs
```

## API Endpoints

### 1. Compute Capacity (`POST /compute_etaH`)

Computes human capacity (etaH) and determines execution mode.

### 2. Run Workflow (`POST /run_workflow`)

Complete workflow: computes capacity, determines mode, and executes FMCA loop on task batch.

See [API_EXAMPLES.md](API_EXAMPLES.md) for detailed usage examples.

## Execution Modes

- **Recovery** (etaH < 0.30): Minimal workload, 10-minute swap time
- **Turtle** (0.30 ≤ etaH < 0.60): Moderate pace, 12-minute swap time
- **Cruise** (0.60 ≤ etaH < 0.85): Optimal flow, 15-minute swap time
- **Unicorn** (etaH ≥ 0.85): Peak performance, 16-minute swap time

## Testing

```bash
pytest test_tasker5000.py -v
```

All 14 tests passing ✅

## Documentation

- [API Examples](API_EXAMPLES.md) - Complete API usage guide
- [Strategy](STRATEGY.md) - System architecture and design
- [Progress Log](PROGRESS_LOG.md) - Development milestones

## Security

- ✅ No vulnerabilities in dependencies
- ✅ CodeQL security scan passed
- ✅ Code review passed

## License

Repository for personal task application.

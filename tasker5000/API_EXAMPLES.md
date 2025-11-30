# Tasker5000 API Examples

## Overview
Tasker5000 is a neuroadaptive task execution system that dynamically manages task execution based on cognitive/physical capacity.

## Installation

```bash
pip install -r requirements.txt
```

## Running the Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The API documentation will be available at `http://localhost:8000/docs`

## API Endpoints

### 1. Compute Capacity (etaH)

**Endpoint:** `POST /compute_etaH`

Computes the human capacity score (etaH) and determines the execution mode.

**Example Request:**

```json
{
  "R_phys": 0.8,
  "R_ment": 0.7,
  "L": 50,
  "dplan": 0.9,
  "Csocial": 0.5,
  "Gguilt": 0.3,
  "Aanxiety": 0.4,
  "N_vis": 4,
  "Hhero": 0.6,
  "Rnow": 0.7,
  "Dtask": 0.5,
  "Ssteps": 0.4,
  "Uunfamiliar": 0.3,
  "EHR_clunk": 0.2,
  "availability_hours": 8.0
}
```

**Example Response:**

```json
{
  "etaH": 0.095,
  "mode": "Recovery",
  "controls": {
    "sprints": 2,
    "batch_size": 5,
    "N_vis": 2,
    "swap_time": 10,
    "deep_fix": false
  }
}
```

### 2. Run Complete Workflow

**Endpoint:** `POST /run_workflow`

Runs the complete Tasker5000 workflow: computes capacity, determines mode, and executes FMCA loop on tasks.

**Example Request:**

```json
{
  "capacity": {
    "R_phys": 0.9,
    "R_ment": 0.9,
    "L": 30,
    "dplan": 0.95,
    "Csocial": 0.7,
    "Gguilt": 0.1,
    "Aanxiety": 0.2,
    "N_vis": 2,
    "Hhero": 0.5,
    "Rnow": 0.9,
    "Dtask": 0.3,
    "Ssteps": 0.2,
    "Uunfamiliar": 0.2,
    "EHR_clunk": 0.1,
    "availability_hours": 8.0
  },
  "tasks": [
    {
      "id": "chart001",
      "type": "full",
      "age_days": 85,
      "required_today": true,
      "swap_count": 2
    },
    {
      "id": "chart002",
      "type": "attest",
      "age_days": 15,
      "required_today": false,
      "swap_count": 0
    }
  ]
}
```

**Example Response:**

```json
{
  "capacity_analysis": {
    "etaH": 0.365,
    "mode": "Turtle",
    "controls": {
      "sprints": 4,
      "batch_size": 6,
      "N_vis": 3,
      "swap_time": 12,
      "deep_fix": "maybe"
    }
  },
  "execution_timeline": [
    {
      "action": "working",
      "chart_id": "chart001",
      "message": "Working on chart chart001 at minute 0"
    },
    {
      "action": "micro_unstick",
      "chart_id": "chart001",
      "message": "Define 1-line finish. Take smallest next step."
    },
    {
      "action": "accelerator",
      "chart_id": "chart001",
      "message": "Use snippet/template. Drop TODO if info missing."
    },
    {
      "action": "escalate",
      "chart_id": "chart001",
      "message": "Chart escalated for Deep Fix block later."
    }
  ],
  "summary": {
    "total_tasks": 2,
    "total_actions": 14,
    "mode": "Turtle"
  }
}
```

## Capacity Input Parameters

- **R_phys** (0-1): Physical readiness score
- **R_ment** (0-1): Mental readiness score
- **L** (integer): Backlog count
- **dplan** (0-1): Daily plan quality
- **Csocial** (0-1): Social commitment factor
- **Gguilt** (0-1): Guilt pressure
- **Aanxiety** (0-1): Anxiety level
- **N_vis** (integer): Number of visible tasks
- **Hhero** (0-1): Hero mode tendency
- **Rnow** (0-1): Current readiness
- **Dtask** (0-1): Task difficulty perception
- **Ssteps** (0-1): Steps complexity
- **Uunfamiliar** (0-1): Unfamiliarity factor
- **EHR_clunk** (0-1): System friction factor
- **availability_hours** (float): Available work hours

## Execution Modes

### Recovery Mode (etaH < 0.30)
- Sprints: 2
- Batch size: 5
- Visible tasks: 2
- Swap time: 10 minutes
- Deep fix: Disabled

### Turtle Mode (0.30 ≤ etaH < 0.60)
- Sprints: 4
- Batch size: 6
- Visible tasks: 3
- Swap time: 12 minutes
- Deep fix: Maybe

### Cruise Mode (0.60 ≤ etaH < 0.85)
- Sprints: 5
- Batch size: 8
- Visible tasks: 5
- Swap time: 15 minutes
- Deep fix: Enabled

### Unicorn Mode (etaH ≥ 0.85)
- Sprints: 5
- Batch size: 8
- Visible tasks: 7
- Swap time: 16 minutes
- Deep fix: Enabled

## FMCA Loop Actions

The FMCA (Focus, Micro-unstick, Accelerator) loop monitors task progress and applies interventions:

1. **Micro-Unstick** (5 minutes): "Define 1-line finish. Take smallest next step."
2. **Accelerator** (12 minutes): "Use snippet/template. Drop TODO if info missing."
3. **Swap-3** (mode-specific): Parks current chart and pulls 3 attest-only tasks
4. **Escalate**: For critical tasks (required_today or age ≥ 80 days) after swap-3 has been tried

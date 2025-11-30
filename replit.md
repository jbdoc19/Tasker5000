# Tasker5000

## Overview

Tasker5000 is a neuroadaptive task execution system designed to help clinicians manage administrative work (primarily clinical chart documentation) based on real-time cognitive and physical capacity. The system uses a dual-engine architecture:

1. **Capacity Engine (ηH)**: Calculates a normalized capacity score (0-1) from physiological, mental, and contextual inputs, then maps this to operational modes (Recovery, Turtle, Cruise, Unicorn)
2. **FMCA Loop (Friction-Minimizing Chart Algorithm)**: Executes timed work sprints with built-in intervention protocols to prevent time blindness and task-switching friction

The application targets healthcare providers managing electronic health record (EHR) documentation backlogs, using sprint-based workflows with automatic friction detection and remediation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: Vanilla JavaScript + HTML + CSS (no frameworks)

**Design Philosophy**: Mobile-first, minimal dependencies, optimized for quick interactions during clinical workflows

**Key Components**:
- **HUD (Heads-Up Display)**: Sticky header showing real-time sprint state, timers, and mode indicators
- **Timer System**: Three concurrent timers (Sprint: 25min, Micro: 5min, Swap-3: mode-dependent) implemented in client-side JavaScript
- **Card-based UI**: Modular sections for controls, charts, and timeline visualization
- **Live Status Updates**: ARIA live regions for accessibility during active sprints

**State Management**: Client-side state tracked via DOM updates and timer intervals; no persistent client storage

### Backend Architecture

**Framework**: FastAPI (Python async web framework)

**Core Engines**:

1. **Capacity Engine** (`main.py`):
   - Computes ηH (eta-H) score from 14+ input parameters including physical readiness, mental state, task difficulty, guilt/anxiety levels, and availability
   - Uses exponential decay functions and soft normalization to compute overload factor
   - Maps ηH to four operational modes with distinct control parameters (sprint count, batch size, swap thresholds)

2. **FMCA Execution Engine** (`fmca_engine.py`):
   - State machine implementing the friction-minimizing algorithm
   - Intervention cascade: Micro-Unstick (5min) → Accelerator (12min) → Swap-3 (mode-specific) → Escalate
   - Tracks chart state transitions: active → parked → escalated
   - Generates timeline of decisions and actions taken during sprint execution

**Chart Management** (`chart_state.py`):
- In-memory chart database (no persistence layer in current implementation)
- Smart batching algorithm that prioritizes: same-day required > 80+ days old > attest-only > lowest friction count
- Mode-aware constraints (e.g., Recovery mode limited to 3 attest-only charts)

**Task Scoring** (`task_display.py`):
- Priority scoring system combining urgency (required_today), age, chart type, and parking history
- Used by batch builder to optimize chart selection for cognitive load

**API Design**:
- RESTful endpoints: `/compute_etaH` (POST), `/update_chart` (POST), `/lanes` (GET)
- JSON request/response format
- CORS enabled for local development

### Data Model

**ChartTask Entity**:
```python
{
  id: string
  type: 'attest' | 'full'
  age_days: integer
  required_today: boolean
  swap_count: integer
  status: 'active' | 'parked' | 'escalated'
  blocker_note: string
  next_steps: string[]
}
```

**Capacity Input Schema** (14 parameters):
- Physical/mental readiness (R_phys, R_ment)
- Task difficulty factors (L, Dtask, Ssteps, Uunfamiliar, EHR_clunk)
- Psychological factors (Gguilt, Aanxiety, Hhero)
- Context (dplan, Csocial, Rnow, N_vis, availability_hours)

**Mode Control Output**:
```python
{
  mode: string,
  etaH: float,
  sprints: int,
  batch_size: int,
  N_vis: int,
  swap_time: int,
  deep_fix: boolean | "maybe"
}
```

### Design Patterns

**Strategy Pattern**: Mode-based controls encapsulate different execution strategies (Recovery vs Unicorn have vastly different sprint parameters)

**State Machine**: Chart lifecycle managed through explicit state transitions with guard conditions

**Builder Pattern**: `build_smart_batch()` constructs optimal chart queues based on multiple constraints

**Observer Pattern**: Frontend timer system observes sprint progress and triggers UI alerts at intervention thresholds

### Key Architectural Decisions

**No Database Persistence**:
- **Rationale**: Pilot phase focuses on algorithm validation; in-memory storage reduces deployment complexity
- **Trade-off**: Data lost on server restart, but enables rapid iteration
- **Future**: Will likely add PostgreSQL + Drizzle ORM when moving to production

**Client-Side Timers**:
- **Rationale**: Reduces server load and network latency for time-critical UX
- **Trade-off**: Timer drift possible, but acceptable for 5-25 minute intervals
- **Alternative Considered**: WebSocket-based server timers (rejected due to complexity)

**Synchronous FMCA Loop**:
- **Rationale**: Sprint execution is inherently sequential; async complexity not needed
- **Trade-off**: Single-threaded execution, but matches single-user workflow

**Mode Thresholds as Hard-Coded Constants**:
- **Rationale**: Clinical validation needed before making these configurable
- **Future**: Will expose as user preferences after establishing evidence base

## External Dependencies

### Backend Dependencies
- **FastAPI**: Web framework for async API endpoints
- **Uvicorn**: ASGI server for FastAPI deployment
- **Pydantic**: Data validation and settings management

### Frontend Dependencies
- **None**: Pure vanilla JavaScript/HTML/CSS implementation
- No build tools, bundlers, or package managers required

### Planned Integrations
- **Database**: PostgreSQL (likely via Drizzle ORM) for chart persistence
- **Authentication**: Not yet implemented (single-user pilot phase)
- **EHR Integration**: Placeholder for future EMR/EHR API connections to pull real chart data

### Development Tools
- **Python 3.8+**: Backend runtime
- **Node.js/npm**: Not currently used (frontend has no build step)
- Local development server: `http://localhost:3000`

### API Contracts
All endpoints accept/return JSON. No external third-party APIs currently integrated. System designed to eventually consume EHR FHIR APIs for chart metadata.
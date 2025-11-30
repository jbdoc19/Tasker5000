import math
from typing import List

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from chart_state import build_smart_batch, get_all_charts, seed_chart, update_chart_state
from fmca_engine import ChartTask, run_fmca_loop


def clamp(val, min_val, max_val):
    return max(min_val, min(val, max_val))


def norm(x):  # Soft normalization (can customize)
    return min(max(x, 0), 1)


def Qoverload(N_vis):
    if N_vis <= 3:
        return 0
    else:
        return 1 - math.exp(-0.9 * (N_vis - 3))


def get_mode_band(etaH):
    if etaH < 0.30:
        return "Recovery"
    elif etaH < 0.60:
        return "Turtle"
    elif etaH < 0.85:
        return "Cruise"
    else:
        return "Unicorn"


def get_mode_controls(mode, availability_hours):
    if mode == "Recovery":
        return {"sprints": 2, "batch_size": 5, "N_vis": 2, "swap_time": 10, "deep_fix": False}
    elif mode == "Turtle":
        return {"sprints": 4, "batch_size": 6, "N_vis": 3, "swap_time": 12, "deep_fix": "maybe"}
    elif mode == "Cruise":
        return {"sprints": 5, "batch_size": 8, "N_vis": 5, "swap_time": 15, "deep_fix": True}
    elif mode == "Unicorn":
        return {"sprints": 5, "batch_size": 8, "N_vis": 7, "swap_time": 16, "deep_fix": True}


class CapacityInput(BaseModel):
    R_phys: float
    R_ment: float
    L: int
    dplan: float
    Csocial: float
    Gguilt: float
    Aanxiety: float
    N_vis: int
    Hhero: float
    Rnow: float
    Dtask: float
    Ssteps: float
    Uunfamiliar: float
    EHR_clunk: float
    availability_hours: float


class ChartInput(BaseModel):
    id: str
    type: str
    age_days: int
    required_today: bool = False
    swap_count: int = 0


class FMCARequest(BaseModel):
    capacity: CapacityInput
    charts: List[ChartInput] = Field(default_factory=list)


class ChartUpdateRequest(BaseModel):
    chart_id: str
    status: str
    blocker_note: str | None = None
    next_steps: List[str] | None = None


app = FastAPI()


@app.get("/", response_class=HTMLResponse)
def read_root():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tasker5000 - Productivity Capacity Engine</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        .container {
            text-align: center;
            padding: 40px;
            max-width: 600px;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #e94560, #0f3460);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle {
            font-size: 1.2rem;
            color: #a0a0a0;
            margin-bottom: 30px;
        }
        .description {
            font-size: 1rem;
            line-height: 1.6;
            color: #ccc;
            margin-bottom: 40px;
        }
        .btn {
            display: inline-block;
            padding: 15px 30px;
            background: #e94560;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            transition: transform 0.2s, box-shadow 0.2s;
            margin: 10px;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(233, 69, 96, 0.3);
        }
        .btn-secondary {
            background: #16213e;
            border: 2px solid #e94560;
        }
        .endpoints {
            margin-top: 40px;
            text-align: left;
            background: rgba(255,255,255,0.05);
            padding: 20px;
            border-radius: 10px;
        }
        .endpoints h3 {
            color: #e94560;
            margin-bottom: 15px;
        }
        .endpoint {
            margin: 10px 0;
            padding: 8px;
            background: rgba(255,255,255,0.05);
            border-radius: 5px;
            font-family: monospace;
        }
        .method {
            color: #4ade80;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Tasker5000</h1>
        <p class="subtitle">Productivity Capacity Engine</p>
        <p class="description">
            An intelligent system that calculates your effective work capacity (etaH) 
            based on physical energy, mental state, workload, and environmental factors. 
            Get personalized productivity recommendations and task management controls.
        </p>
        <a href="/docs" class="btn">API Documentation</a>
        <a href="/lanes" class="btn btn-secondary">View Chart Lanes</a>
        <div class="endpoints">
            <h3>Available Endpoints</h3>
            <div class="endpoint"><span class="method">POST</span> /compute_etaH - Calculate capacity</div>
            <div class="endpoint"><span class="method">POST</span> /fmca_demo - Run FMCA demo</div>
            <div class="endpoint"><span class="method">POST</span> /update_chart - Update chart status</div>
            <div class="endpoint"><span class="method">GET</span> /lanes - Get chart lanes</div>
        </div>
    </div>
</body>
</html>
"""


def calculate_etaH(payload: CapacityInput):
    Esustain = payload.R_phys * payload.R_ment
    Bbacklog = min(1, payload.L / 80)

    Scommit = clamp(0.85 - 0.35 * Bbacklog - 0.15 * payload.Gguilt - 0.10 * payload.Aanxiety + 0.15 * payload.Csocial, 0, 1)
    Sopen = clamp(0.90 - 0.25 * Bbacklog - 0.10 * payload.Gguilt, 0, 1)

    Qov = Qoverload(payload.N_vis)

    Fstart = norm(
        0.25 * payload.Dtask +
        0.25 * Qov +
        0.15 * payload.Aanxiety +
        0.10 * payload.Gguilt +
        0.05 * payload.Hhero -
        0.10 * payload.Csocial +
        0.10 * (1 - payload.Rnow)
    )

    Sstart = 1 - Fstart

    Ftask = norm(
        0.45 * payload.Ssteps +
        0.35 * payload.Uunfamiliar +
        0.20 * payload.EHR_clunk
    )

    etaH = Scommit * Sopen * payload.dplan * Sstart * Esustain * (1 - Ftask)
    mode = get_mode_band(etaH)
    controls = get_mode_controls(mode, payload.availability_hours)
    controls["mode"] = mode
    return etaH, mode, controls


def build_chart_batch(chart_inputs: List[ChartInput]):
    batch = []
    for chart in chart_inputs:
        seeded_chart = seed_chart(
            ChartTask(
                id=chart.id,
                type=chart.type,
                age_days=chart.age_days,
                required_today=chart.required_today,
                swap_count=chart.swap_count,
            )
        )
        seeded_chart.type = chart.type
        seeded_chart.age_days = chart.age_days
        seeded_chart.required_today = chart.required_today
        seeded_chart.swap_count = max(seeded_chart.swap_count, chart.swap_count)
        batch.append(seeded_chart)
    return batch


def default_chart_inputs():
    return [
        ChartInput(id="chart1", type="full", age_days=10, required_today=False),
        ChartInput(id="chart2", type="attest", age_days=85, required_today=True),
        ChartInput(id="chart3", type="full", age_days=20, required_today=False),
    ]


# Chart seeding
seed_chart(ChartTask(id="chart1", type="full", age_days=10, required_today=False))
seed_chart(ChartTask(id="chart2", type="attest", age_days=85, required_today=True))
seed_chart(ChartTask(id="chart3", type="attest", age_days=5, required_today=False))
seed_chart(ChartTask(id="chart4", type="full", age_days=90, required_today=True))
seed_chart(ChartTask(id="chart5", type="full", age_days=15, required_today=False))
seed_chart(ChartTask(id="chart6", type="attest", age_days=3, required_today=False))


def build_stateful_batch():
    batch = []
    for chart in get_all_charts():
        if chart.status == "parked":
            if chart.required_today or chart.age_days >= 80:
                chart.status = "active"
                chart.parked = False
            else:
                continue
        batch.append(chart)
    return batch


@app.post("/compute_etaH")
def compute_etaH_endpoint(input: CapacityInput):
    etaH, mode, controls = calculate_etaH(input)

    batch = build_smart_batch(controls)
    fmca_timeline = run_fmca_loop(batch, controls)

    for chart in batch:
        update_chart_state(chart)

    return {
        "etaH": round(etaH, 3),
        "mode": mode,
        "controls": controls,
        "selected_charts": [chart.__dict__ for chart in batch],
        "charts": [chart.__dict__ for chart in get_all_charts()],
        "timeline": fmca_timeline,
    }


@app.post("/update_chart")
def update_chart_endpoint(update: ChartUpdateRequest):
    chart = next((c for c in get_all_charts() if c.id == update.chart_id), None)

    if chart is None:
        raise HTTPException(status_code=404, detail="Chart not found")

    chart.status = update.status
    chart.blocker_note = update.blocker_note or ""
    if update.next_steps is not None:
        chart.next_steps = update.next_steps

    chart.parked = chart.status == "parked"

    update_chart_state(chart)

    return {
        "message": "Chart updated successfully",
        "chart": chart.__dict__,
        "charts": [c.__dict__ for c in get_all_charts()],
    }


@app.get("/lanes")
def get_chart_lanes():
    charts = get_all_charts()

    lanes = {
        "attest_only": [],
        "deep_fix_queue": [],
        "parked": [],
        "same_day_required": [],
        "high_friction": [],
    }

    for chart in charts:
        chart_lanes = []

        if chart.type == "attest" and chart.status == "active":
            lanes["attest_only"].append(chart)
            chart_lanes.append("attest_only")

        if chart.status == "escalated":
            lanes["deep_fix_queue"].append(chart)
            chart_lanes.append("deep_fix_queue")

        if chart.status == "parked":
            lanes["parked"].append(chart)
            chart_lanes.append("parked")

        if chart.required_today and chart.status == "active":
            lanes["same_day_required"].append(chart)
            chart_lanes.append("same_day_required")

        if chart.swap_count >= 2 or chart.age_days >= 90:
            lanes["high_friction"].append(chart)
            chart_lanes.append("high_friction")

        if chart_lanes:
            chart.lanes = chart_lanes

    return {lane: [c.__dict__.copy() for c in lane_charts] for lane, lane_charts in lanes.items()}


@app.post("/fmca_demo")
def fmca_demo(request: FMCARequest):
    etaH, mode, controls = calculate_etaH(request.capacity)
    charts = request.charts or default_chart_inputs()

    chart_batch = build_chart_batch(charts)
    fmca_timeline = run_fmca_loop(chart_batch, controls)

    for chart in chart_batch:
        update_chart_state(chart)

    return {
        "etaH": round(etaH, 3),
        "mode": mode,
        "controls": controls,
        "charts": [chart.dict() for chart in charts],
        "timeline": fmca_timeline,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)

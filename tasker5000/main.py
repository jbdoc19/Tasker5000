import math
from typing import List

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

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


app = FastAPI()


@app.get("/")
def read_root():
    return {"message": "Hello World", "status": "FastAPI is running!"}


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
    return etaH, mode, controls


def build_chart_batch(chart_inputs: List[ChartInput]):
    return [
        ChartTask(
            id=chart.id,
            type=chart.type,
            age_days=chart.age_days,
            required_today=chart.required_today,
            swap_count=chart.swap_count,
        )
        for chart in chart_inputs
    ]


def default_chart_inputs():
    return [
        ChartInput(id="chart1", type="full", age_days=10, required_today=False),
        ChartInput(id="chart2", type="attest", age_days=85, required_today=True),
        ChartInput(id="chart3", type="full", age_days=20, required_today=False),
    ]


@app.post("/compute_etaH")
def compute_etaH_endpoint(input: CapacityInput):
    etaH, mode, controls = calculate_etaH(input)

    return {
        "etaH": round(etaH, 3),
        "mode": mode,
        "controls": controls
    }


@app.post("/fmca_demo")
def fmca_demo(request: FMCARequest):
    etaH, mode, controls = calculate_etaH(request.capacity)
    charts = request.charts or default_chart_inputs()

    chart_batch = build_chart_batch(charts)
    fmca_timeline = run_fmca_loop(chart_batch, controls)

    return {
        "etaH": round(etaH, 3),
        "mode": mode,
        "controls": controls,
        "charts": [chart.dict() for chart in charts],
        "timeline": fmca_timeline,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)

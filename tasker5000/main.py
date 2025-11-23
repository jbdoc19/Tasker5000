from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import math
from fmca_engine import ChartTask, run_fmca_loop

mode = get_mode_band(etaH)
controls = get_mode_controls(mode, input.availability_hours)

# Simulate a test batch of 3 charts
chart_batch = [
    ChartTask(id="chart1", type="full", age_days=10, required_today=False),
    ChartTask(id="chart2", type="attest", age_days=85, required_today=True),
    ChartTask(id="chart3", type="full", age_days=20, required_today=False),
]

fmca_timeline = run_fmca_loop(chart_batch, controls)


app = FastAPI()

def read_root():
    return {"message": "Hello World", "status": "FastAPI is running!"}

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

@app.post("/compute_etaH")
def compute_etaH(input: CapacityInput):
    Esustain = input.R_phys * input.R_ment
    Bbacklog = min(1, input.L / 80)

    Scommit = clamp(0.85 - 0.35 * Bbacklog - 0.15 * input.Gguilt - 0.10 * input.Aanxiety + 0.15 * input.Csocial, 0, 1)
    Sopen = clamp(0.90 - 0.25 * Bbacklog - 0.10 * input.Gguilt, 0, 1)

    Qov = Qoverload(input.N_vis)

    Fstart = norm(
        0.25 * input.Dtask +
        0.25 * Qov +
        0.15 * input.Aanxiety +
        0.10 * input.Gguilt +
        0.05 * input.Hhero -
        0.10 * input.Csocial +
        0.10 * (1 - input.Rnow)
    )

    Sstart = 1 - Fstart

    Ftask = norm(
        0.45 * input.Ssteps +
        0.35 * input.Uunfamiliar +
        0.20 * input.EHR_clunk
    )

    etaH = Scommit * Sopen * input.dplan * Sstart * Esustain * (1 - Ftask)
    mode = get_mode_band(etaH)
    controls = get_mode_controls(mode, input.availability_hours)

    return {
        "etaH": round(etaH, 3),
        "mode": mode,
        "controls": controls
    }
# IMPORTANT: this must be OUTSIDE any function
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)

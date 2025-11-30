from fmca_engine import ChartTask
from typing import List

def score_chart(chart: ChartTask):
    score = 0

    if chart.required_today:
        score += 50
    if chart.age_days >= 80:
        score += 40
    elif chart.age_days >= 30:
        score += 20
    elif chart.age_days >= 7:
        score += 10

    if chart.type == "attest":
        score += 10

    if chart.parked:
        score -= 20  # Slight penalty for charts you’ve already parked

    return score

def get_top_batch(charts: List[ChartTask], mode: str, batch_size: int) -> List[ChartTask]:
    # Score all charts
    scored = sorted(charts, key=lambda c: score_chart(c), reverse=True)

    if mode in ["Recovery", "Turtle"]:
        # Bias toward attest-only in lower energy modes
        scored = sorted(scored, key=lambda c: c.type != "attest")

    return scored[:batch_size]

from typing import Dict, List

from fmca_engine import ChartTask

# In-memory chart "database"
chart_db: Dict[str, ChartTask] = {}

def seed_chart(chart: ChartTask):
    if chart.id not in chart_db:
        chart_db[chart.id] = chart
    return chart_db[chart.id]

def update_chart_state(chart: ChartTask):
    chart_db[chart.id] = chart

def get_all_charts():
    return list(chart_db.values())

def get_parked_charts():
    return [c for c in chart_db.values() if c.status == 'parked']

def get_active_charts():
    return [c for c in chart_db.values() if c.status == 'active']


def build_smart_batch(mode_controls: Dict) -> List[ChartTask]:
    """Select charts for the upcoming FMCA sprint based on capacity-aware rules.

    Selection priority (highest first):
    1) Same-day required charts
    2) Charts aged 80 days or more
    3) Attest-only charts
    4) Full charts with the lowest swap_count

    Recovery mode constraints:
    - Only attest-only charts are eligible
    - Limit selection to a maximum of 3 charts regardless of batch_size

    Parked charts are skipped unless they are required today or 80+ days old.
    The resulting queue attempts to cluster similar chart types to reduce
    context switching when priorities are otherwise equal.
    """

    mode = mode_controls.get("mode")
    batch_size = mode_controls.get("batch_size", 0) or len(chart_db)
    max_visits = mode_controls.get("N_vis", batch_size)

    # Cap selection size by batch_size, N_vis, and Recovery limits
    selection_limit = min(batch_size, max_visits)
    if mode == "Recovery":
        selection_limit = min(selection_limit, 3)

    candidates: List[ChartTask] = []
    for chart in get_all_charts():
        # Skip parked charts unless they are time-sensitive
        if chart.status == "parked" and not (chart.required_today or chart.age_days >= 80):
            continue

        # Recovery mode only works on attest-only charts
        if mode == "Recovery" and chart.type != "attest":
            continue

        candidates.append(chart)

    def priority_key(chart: ChartTask):
        if chart.required_today:
            priority = 0
        elif chart.age_days >= 80:
            priority = 1
        elif chart.type == "attest":
            priority = 2
        else:
            priority = 3

        # Lower swap_count is better for full charts to minimize churn.
        swap_penalty = chart.swap_count if chart.type == "full" else 0

        # Negative age prefers slightly older charts inside the same bucket.
        return (priority, swap_penalty, -chart.age_days, chart.type)

    prioritized = sorted(candidates, key=priority_key)

    # Keep similar chart types together after priority sorting to reduce context switches.
    selected: List[ChartTask] = []
    if prioritized:
        anchor_type = prioritized[0].type
        for chart in prioritized:
            type_switch_penalty = 0 if chart.type == anchor_type else 1
            chart._context_key = (type_switch_penalty, ) + priority_key(chart)  # type: ignore[attr-defined]
        prioritized = sorted(prioritized, key=lambda c: c._context_key)  # type: ignore[attr-defined]

    for chart in prioritized:
        if len(selected) >= selection_limit:
            break
        chart.status = "in_progress"
        chart.parked = False
        selected.append(chart)

    # Cleanup temporary sort keys if they were applied
    for chart in selected:
        if hasattr(chart, "_context_key"):
            delattr(chart, "_context_key")

    return selected

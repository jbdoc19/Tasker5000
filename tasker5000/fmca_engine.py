from typing import List, Dict
from datetime import datetime, timedelta

class ChartTask:
    def __init__(self, id, type, age_days, required_today, swap_count=0):
        self.id = id
        self.type = type  # 'attest', 'full'
        self.age_days = age_days
        self.required_today = required_today
        self.swap_count = swap_count
        self.parked = False
        self.status = 'active'
        self.blocker_note = ""
        self.next_steps = []

def is_stuck(chart, minutes_no_progress):
    return minutes_no_progress >= 5

def micro_unstick(chart):
    return {
        "action": "micro_unstick",
        "chart_id": chart.id,
        "message": "Define 1-line finish. Take smallest next step."
    }

def accelerator(chart):
    return {
        "action": "accelerator",
        "chart_id": chart.id,
        "message": "Use snippet/template. Drop TODO if info missing."
    }

def swap_3(chart, attest_charts: List[ChartTask]):
    chart.parked = True
    chart.status = 'parked'
    chart.swap_count += 1
    chart.blocker_note = "Chart parked due to friction."
    chart.next_steps = ["Step 1", "Step 2", "Step 3"]
    return {
        "action": "swap_3",
        "message": "Parked current chart. Pulled 3 attest-only.",
        "chart_parked": chart.id,
        "attest_charts": [c.id for c in attest_charts[:3]]
    }

def escalate(chart):
    chart.parked = True
    chart.status = 'escalated'
    return {
        "action": "escalate",
        "chart_id": chart.id,
        "message": "Chart escalated for Deep Fix block later."
    }

def run_fmca_loop(batch: List[ChartTask], mode_controls: Dict):
    timeline = []
    for chart in batch:
        minutes_no_progress = 0

        # Charts can be freshly marked as in_progress when added to the batch.
        while chart.status in ('active', 'in_progress'):
            if minutes_no_progress == 5:
                timeline.append(micro_unstick(chart))
            elif minutes_no_progress == 12:
                timeline.append(accelerator(chart))
            elif minutes_no_progress >= mode_controls["swap_time"]:
                if chart.required_today or chart.age_days >= 80:
                    if chart.swap_count >= 1:
                        timeline.append(escalate(chart))
                        break
                timeline.append(swap_3(chart, batch))
                break  # After swap-3, move to next chart
            else:
                timeline.append({
                    "action": "working",
                    "chart_id": chart.id,
                    "message": f"Working on chart {chart.id} at minute {minutes_no_progress}"
                })
            minutes_no_progress += 1
    return timeline

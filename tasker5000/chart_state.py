from fmca_engine import ChartTask
from typing import Dict

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

// Sample payload you can tweak later
const samplePayload = {
  R_phys: 0.8,
  R_ment: 0.9,
  L: 5,
  dplan: 0.4,
  Csocial: 0.2,
  Gguilt: 0.1,
  Aanxiety: 0.05,
  N_vis: 3,
  Hhero: 0.3,
  Rnow: 0.7,
  Dtask: 0.5,
  Ssteps: 0.6,
  Uunfamiliar: 0.2,
  EHR_clunk: 0.1,
  availability_hours: 6,
};

const apiBase = 'http://localhost:3000';
const apiUrl = `${apiBase}/compute_etaH`;
const updateUrl = `${apiBase}/update_chart`;

const startButton = document.getElementById('startButton');
const modeValue = document.getElementById('modeValue');
const etaValue = document.getElementById('etaValue');
const controlsJson = document.getElementById('controlsJson');
const chartsList = document.getElementById('chartsList');
const timelineList = document.getElementById('timelineList');
const statusMessage = document.getElementById('statusMessage');

let currentTimeline = [];
let lastRequestPayload = { ...samplePayload };

startButton.addEventListener('click', () => {
  computeAndRender(samplePayload);
});

async function computeAndRender(payload) {
  statusMessage.textContent = 'Sending request...';
  startButton.disabled = true;
  lastRequestPayload = { ...payload };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    renderResponse(data);
    statusMessage.textContent = 'Sprint computed successfully.';
  } catch (error) {
    statusMessage.textContent = `Error: ${error.message}`;
  } finally {
    startButton.disabled = false;
  }
}

function renderResponse(data) {
  // Update simple values
  modeValue.textContent = data.mode ?? '—';
  etaValue.textContent = data.etaH ?? '—';

  // Pretty-print controls
  controlsJson.textContent = JSON.stringify(data.controls ?? {}, null, 2);

  renderCharts(data.charts);
  renderTimeline(data.timeline);
}

function renderCharts(charts) {
  chartsList.innerHTML = '';

  if (Array.isArray(charts) && charts.length) {
    charts.forEach((chart, index) => {
      const li = document.createElement('li');
      const chartId = chart.chart_id ?? chart.id ?? `chart-${index + 1}`;
      const status = (chart.status ?? 'unknown').toString();
      const swaps = chart.swap_count ?? chart.swaps ?? '—';

      li.classList.add('chart-item');

      const statusBadge = document.createElement('span');
      statusBadge.classList.add('chart-item__status');

      const normalizedStatus = status.toLowerCase();

      if (normalizedStatus === 'parked') {
        li.classList.add('chart-item--parked');
        statusBadge.classList.add('chart-item__status--muted');
        statusBadge.textContent = 'Parked';
      } else if (normalizedStatus === 'escalated') {
        statusBadge.classList.add('chart-item__status--escalated');
        statusBadge.textContent = 'Escalated';
      } else if (normalizedStatus === 'resolved') {
        statusBadge.classList.add('chart-item__status--resolved');
        statusBadge.textContent = 'Resolved ✓';
      } else {
        statusBadge.textContent = status;
      }

      const row = document.createElement('div');
      row.classList.add('chart-item__row');

      const idLabel = document.createElement('span');
      idLabel.classList.add('chart-item__id');
      idLabel.textContent = chartId;

      row.appendChild(idLabel);
      row.appendChild(statusBadge);

      const swapLabel = document.createElement('p');
      swapLabel.classList.add('chart-item__meta');
      swapLabel.textContent = `Swaps: ${swaps}`;

      li.appendChild(row);
      li.appendChild(swapLabel);

      chartsList.appendChild(li);
    });
  } else {
    chartsList.textContent = 'No charts returned yet.';
  }
}

function renderTimeline(timeline) {
  timelineList.innerHTML = '';
  currentTimeline = Array.isArray(timeline) ? [...timeline] : [];

  if (currentTimeline.length === 0) {
    timelineList.textContent = 'No timeline steps yet.';
    return;
  }

  currentTimeline.forEach((step, index) => {
    const li = document.createElement('li');
    li.classList.add('timeline-item');

    const actionLabel = step.action ?? `Step ${index + 1}`;
    const message = step.message && step.message !== actionLabel ? `: ${step.message}` : '';
    const chartRef = step.chart_id ? ` (chart ${step.chart_id})` : '';
    const userNote = step.user_state ? ` — ${step.user_state}` : '';

    const text = document.createElement('p');
    text.classList.add('timeline-item__text');
    text.textContent = `${actionLabel}${chartRef}${message}${userNote}`;

    li.appendChild(text);

    const actionButton = buildActionButton(step, index);
    if (actionButton) {
      li.appendChild(actionButton);
    }

    timelineList.appendChild(li);
  });
}

function buildActionButton(step, index) {
  if (!step || !step.action) return null;

  const normalized = step.action.toLowerCase();
  let label = '';
  let nextPayload = null;

  if (normalized === 'working') {
    label = 'Park';
    nextPayload = {
      status: 'parked',
      blocker_note: 'Parked by user',
      next_steps: ['Step 1', 'Step 2', 'Step 3'],
    };
  } else if (normalized === 'swap_3') {
    label = 'Escalate';
    nextPayload = {
      status: 'escalated',
      blocker_note: 'Escalated by user',
    };
  } else if (normalized === 'micro_unstick' || normalized === 'accelerator') {
    label = 'Resolve';
    nextPayload = {
      status: 'resolved',
    };
  }

  if (!label || !nextPayload) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('pill-button');
  button.textContent = label;

  button.addEventListener('click', () => {
    const chartId = step.chart_id || 'chart1';
    triggerChartUpdate(chartId, nextPayload, index);
  });

  return button;
}

async function triggerChartUpdate(chartId, updatePayload, index) {
  const step = currentTimeline[index];
  if (step) {
    step.user_state = updatePayload.blocker_note || updatePayload.status;
    renderTimeline(currentTimeline);
  }

  statusMessage.textContent = 'Updating chart state...';

  try {
    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chart_id: chartId, ...updatePayload }),
    });

    if (!response.ok) {
      throw new Error(`Update failed: ${response.status}`);
    }

    await response.json();
    await computeAndRender(lastRequestPayload);
  } catch (error) {
    statusMessage.textContent = `Error updating chart: ${error.message}`;
  }
}

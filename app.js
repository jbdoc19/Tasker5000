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

const apiUrl = 'http://localhost:3000/compute_etaH';
const updateUrl = 'http://localhost:3000/update_chart';

const startButton = document.getElementById('startButton');
const modeValue = document.getElementById('modeValue');
const etaValue = document.getElementById('etaValue');
const controlsJson = document.getElementById('controlsJson');
const chartBatch = document.getElementById('chart-batch');
const timelineList = document.getElementById('timelineList');
const statusMessage = document.getElementById('statusMessage');

const chartStatusMap = new Map();

const STATUS_CLASSES = [
  'chart-card--parked',
  'chart-card--escalated',
  'chart-card--resolved',
];

startButton.addEventListener('click', async () => {
  statusMessage.textContent = 'Sending request...';
  startButton.disabled = true;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload),
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
});

function renderResponse(data) {
  // Update simple values
  modeValue.textContent = data.mode ?? '—';
  etaValue.textContent = data.etaH ?? '—';

  // Pretty-print controls
  controlsJson.textContent = JSON.stringify(data.controls ?? {}, null, 2);

  renderCharts(data.charts);

  // Render timeline as bullet points
  timelineList.innerHTML = '';
  if (Array.isArray(data.timeline) && data.timeline.length) {
    data.timeline.forEach((step, index) => {
      const li = document.createElement('li');
      const action = step.action ?? step.message ?? `Step ${index + 1}`;
      const message = step.message && step.message !== action ? `: ${step.message}` : '';
      const chartRef = step.chart_id ? ` (chart ${step.chart_id})` : '';
      li.textContent = `${action}${chartRef}${message}`;
      timelineList.appendChild(li);
    });
  } else {
    timelineList.textContent = 'No timeline steps yet.';
  }
}

function renderCharts(charts) {
  chartBatch.innerHTML = '';

  if (!Array.isArray(charts) || charts.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'muted';
    emptyMessage.textContent = 'No charts to display right now.';
    chartBatch.appendChild(emptyMessage);
    return;
  }

  charts.forEach((chart, index) => {
    const card = document.createElement('div');
    card.className = 'chart-card';

    const chartId = chart.chart_id ?? chart.id ?? `chart-${index + 1}`;
    const type = chart.type ?? 'unknown';
    const status = chartStatusMap.get(chartId) ?? chart.status ?? 'unknown';
    const ageDays = chart.age_days ?? chart.age ?? null;
    const requiredToday = chart.required_today ?? chart.requiredToday;

    chartStatusMap.set(chartId, status);
    card.id = chartId;
    card.dataset.chartId = chartId;

    const title = document.createElement('h4');
    title.textContent = `Chart ID: ${chartId}`;

    const meta = document.createElement('div');
    meta.className = 'chart-meta';

    const typeEl = document.createElement('span');
    typeEl.textContent = `Type: ${type}`;

    const statusEl = document.createElement('span');
    statusEl.className = 'chart-card__pill status-text';
    statusEl.textContent = `Status: ${status}`;

    meta.append(typeEl, statusEl);

    if (ageDays !== null && ageDays !== undefined) {
      const ageEl = document.createElement('span');
      ageEl.textContent = `Age: ${ageDays}d`;
      meta.appendChild(ageEl);
    }

    if (requiredToday !== undefined) {
      const requiredEl = document.createElement('span');
      requiredEl.textContent = `Required today: ${requiredToday ? 'Yes' : 'No'}`;
      meta.appendChild(requiredEl);
    }

    const actions = document.createElement('div');
    actions.className = 'chart-actions';

    const parkBtn = document.createElement('button');
    parkBtn.className = 'chart-action btn-park';
    parkBtn.textContent = 'Park';

    const escalateBtn = document.createElement('button');
    escalateBtn.className = 'chart-action btn-escalate';
    escalateBtn.textContent = 'Escalate';

    const resolveBtn = document.createElement('button');
    resolveBtn.className = 'chart-action btn-resolve';
    resolveBtn.textContent = 'Resolve';

    actions.append(parkBtn, escalateBtn, resolveBtn);

    card.append(title, meta, actions);
    chartBatch.appendChild(card);

    applyStatusToCard(card, statusEl, chartId, status);

    parkBtn.addEventListener('click', () => updateChartStatus(card, statusEl, chartId, 'parked'));
    escalateBtn.addEventListener('click', () =>
      updateChartStatus(card, statusEl, chartId, 'escalated')
    );
    resolveBtn.addEventListener('click', () => updateChartStatus(card, statusEl, chartId, 'resolved'));
  });
}

function applyStatusToCard(card, statusEl, chartId, newStatus) {
  chartStatusMap.set(chartId, newStatus);
  if (statusEl) {
    statusEl.textContent = `Status: ${newStatus}`;
  }

  STATUS_CLASSES.forEach((className) => card.classList.remove(className));
  const statusClass = `chart-card--${newStatus}`;

  if (newStatus === 'resolved') {
    card.classList.add(statusClass);
    chartStatusMap.delete(chartId);
    card.remove();
    return;
  }

  if (STATUS_CLASSES.includes(statusClass)) {
    card.classList.add(statusClass);
  }
}

async function updateChartStatus(card, statusEl, chartId, newStatus) {
  applyStatusToCard(card, statusEl, chartId, newStatus);

  try {
    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: chartId, status: newStatus }),
    });

    if (!response.ok) {
      throw new Error(`Failed to persist status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error updating chart status:', error);
  }
}

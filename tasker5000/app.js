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

const startButton = document.getElementById('startButton');
const modeValue = document.getElementById('modeValue');
const etaValue = document.getElementById('etaValue');
const controlsJson = document.getElementById('controlsJson');
const chartsList = document.getElementById('chartsList');
const timelineList = document.getElementById('timelineList');
const statusMessage = document.getElementById('statusMessage');

let currentTimeline = [];

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

      // This class makes it easy to customize parked styling later.
      if (status.toLowerCase() === 'parked') {
        li.classList.add('chart-item--parked');
      }

      li.innerHTML = `
        <div class="chart-item__row">
          <span class="chart-item__id">${chartId}</span>
          <span class="chart-item__status">${status}</span>
        </div>
        <p class="chart-item__meta">Swaps: ${swaps}</p>
      `;

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

    const actionButton = buildActionButton(step.action, index);
    if (actionButton) {
      li.appendChild(actionButton);
    }

    timelineList.appendChild(li);
  });
}

function buildActionButton(actionName, index) {
  if (!actionName) return null;

  const normalized = actionName.toLowerCase();
  let label = '';
  let nextState = '';

  if (normalized === 'working') {
    label = 'Park';
    nextState = 'user parked';
  } else if (normalized === 'swap_3') {
    label = 'Escalate';
    nextState = 'manual escalate';
  } else if (normalized === 'micro_unstick' || normalized === 'accelerator') {
    label = 'Resolve';
    nextState = 'user resolved';
  }

  if (!label) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('pill-button');
  button.textContent = label;

  // To customize button behavior later, adjust the update string below
  // or swap the handler for your own implementation.
  button.addEventListener('click', () => updateTimelineItem(index, nextState));

  return button;
}

function updateTimelineItem(index, note) {
  const step = currentTimeline[index];
  if (!step) return;

  // Store the user-driven note so future renders preserve the change.
  step.user_state = note;
  renderTimeline(currentTimeline);
}

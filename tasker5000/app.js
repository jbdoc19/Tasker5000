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

  // Render charts list
  chartsList.innerHTML = '';
  if (Array.isArray(data.charts) && data.charts.length) {
    data.charts.forEach((chart, index) => {
      const li = document.createElement('li');
      const chartId = chart.chart_id ?? chart.id ?? `chart-${index + 1}`;
      const status = chart.status ?? 'unknown';
      const swaps = chart.swap_count ?? chart.swaps ?? '—';
      li.textContent = `${chartId} — status: ${status}, swaps: ${swaps}`;
      chartsList.appendChild(li);
    });
  } else {
    chartsList.textContent = 'No charts returned yet.';
  }

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

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
const lanesUrl = `${apiBase}/lanes`;

// Timer baselines (in seconds). Adjust here to customize sprint rhythm.
const SPRINT_DURATION = 25 * 60; // 25 minutes
const MICRO_DURATION = 5 * 60; // 5 minutes
const defaultSwapDuration = 12 * 60; // fallback swap-3 threshold
const swapThresholds = {
  recovery: 20 * 60,
  turtle: 18 * 60,
  cruise: 15 * 60,
  unicorn: 12 * 60,
};

const startButton = document.getElementById('startButton');
const modeValue = document.getElementById('modeValue');
const etaValue = document.getElementById('etaValue');
const modeBanner = document.getElementById('modeBanner');
const etaValueHud = document.getElementById('etaValueHud');
const sprintTimerDisplay = document.getElementById('sprintTimer');
const microTimerDisplay = document.getElementById('microTimer');
const swapTimerDisplay = document.getElementById('swapTimer');
const sprintTimerCardDisplay = document.getElementById('sprintTimerCard');
const microTimerCardDisplay = document.getElementById('microTimerCard');
const swapTimerCardDisplay = document.getElementById('swapTimerCard');
const microAlert = document.getElementById('microAlert');
const swapAlert = document.getElementById('swapAlert');
const attestCount = document.getElementById('attestCount');
const deepFixCount = document.getElementById('deepFixCount');
const parkedCount = document.getElementById('parkedCount');
const sameDayCount = document.getElementById('sameDayCount');
const controlsJson = document.getElementById('controlsJson');
const chartsList = document.getElementById('chartsList');
const timelineList = document.getElementById('timelineList');
const statusMessage = document.getElementById('statusMessage');

let currentTimeline = [];
let lastRequestPayload = { ...samplePayload };
let currentMode = '';

const timerDisplays = {
  sprint: [sprintTimerDisplay, sprintTimerCardDisplay],
  micro: [microTimerDisplay, microTimerCardDisplay],
  swap: [swapTimerDisplay, swapTimerCardDisplay],
};

const timerState = {
  sprint: { interval: null, duration: SPRINT_DURATION, remaining: SPRINT_DURATION },
  micro: { interval: null, duration: MICRO_DURATION, remaining: MICRO_DURATION },
  swap: { interval: null, duration: defaultSwapDuration, remaining: defaultSwapDuration },
};

startButton.addEventListener('click', () => {
  startAllTimers(currentMode);
  computeAndRender(samplePayload);
  fetchLaneCounts();
});

document.addEventListener('DOMContentLoaded', () => {
  syncTimerDisplays();
  computeAndRender(samplePayload);
  fetchLaneCounts();
});

function syncTimerDisplays() {
  updateTimerDisplays('sprint', formatTime(timerState.sprint.remaining));
  updateTimerDisplays('micro', formatTime(timerState.micro.remaining));
  updateTimerDisplays('swap', formatTime(timerState.swap.remaining));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.max(totalSeconds % 60, 0)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateTimerDisplays(key, label) {
  const displays = timerDisplays[key];
  if (!displays) return;

  displays.forEach((display) => {
    if (display) display.textContent = label;
  });
}

function resetInterval(key) {
  if (timerState[key]?.interval) {
    clearInterval(timerState[key].interval);
    timerState[key].interval = null;
  }
}

function flashAlert(target, message) {
  if (!target) return;
  target.textContent = message;
  target.classList.add('is-alert');
  setTimeout(() => target.classList.remove('is-alert'), 2000);
}

function getSwapDurationForMode(mode) {
  const normalized = (mode || '').toLowerCase();
  return swapThresholds[normalized] ?? defaultSwapDuration;
}

function setSwapDurationFromMode(mode) {
  timerState.swap.duration = getSwapDurationForMode(mode);
  timerState.swap.remaining = timerState.swap.duration;
  updateTimerDisplays('swap', formatTime(timerState.swap.duration));
}

function startCountdown(key, onZero) {
  const timer = timerState[key];
  if (!timer) return;

  resetInterval(key);
  updateTimerDisplays(key, formatTime(timer.duration));
  timer.remaining = timer.duration;

  timer.interval = setInterval(() => {
    timer.remaining -= 1;

    if (timer.remaining <= 0) {
      onZero?.();
      timer.remaining = timer.duration;
    }

    updateTimerDisplays(key, formatTime(timer.remaining));
  }, 1000);
}

function startAllTimers(mode) {
  setSwapDurationFromMode(mode);

  if (microAlert) {
    microAlert.textContent = '';
    microAlert.classList.remove('is-alert');
  }

  if (swapAlert) {
    swapAlert.textContent = '';
    swapAlert.classList.remove('is-alert');
  }

  startCountdown('sprint', () => {
    flashAlert(statusMessage, 'Sprint complete — restarting timer.');
  });

  startCountdown('micro', () => {
    flashAlert(microAlert, 'Micro-Unstick!');
  });

  startCountdown('swap', () => {
    flashAlert(swapAlert, 'Trigger Swap-3!');
  });
}

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
  // Update simple values and HUD
  updateModeDisplay(data.mode);
  updateEtaDisplay(data.etaH);

  // Pretty-print controls
  controlsJson.textContent = JSON.stringify(data.controls ?? {}, null, 2);

  renderCharts(data.charts);
  renderTimeline(data.timeline);
}

function updateModeDisplay(mode) {
  const safeMode = mode ?? '—';
  currentMode = safeMode;

  modeValue.textContent = safeMode;
  if (modeBanner) {
    modeBanner.textContent = `Mode: ${safeMode}`;
  }

  setSwapDurationFromMode(safeMode);

  if (timerState.swap.interval) {
    startCountdown('swap', () => {
      flashAlert(swapAlert, 'Trigger Swap-3!');
    });
  }
}

function updateEtaDisplay(eta) {
  const label = eta ?? '—';
  etaValue.textContent = label;
  if (etaValueHud) {
    etaValueHud.textContent = label;
  }
}

function updateLaneBadges(lanes) {
  const counts = lanes || {};

  setBadgeText(attestCount, 'Attest-Only', counts.attest_only ?? counts.attestOnly);
  setBadgeText(deepFixCount, 'Deep Fix', counts.deep_fix ?? counts.deepFix);
  setBadgeText(parkedCount, 'Parked', counts.parked);
  setBadgeText(sameDayCount, 'Same-Day Required', counts.same_day_required ?? counts.sameDayRequired);
}

function setBadgeText(element, label, value) {
  if (!element) return;
  const displayValue = typeof value === 'number' ? value : value ?? '—';
  element.textContent = `${label}: ${displayValue}`;
}

async function fetchLaneCounts() {
  statusMessage.textContent = 'Refreshing lane counts...';

  try {
    const response = await fetch(lanesUrl);

    if (!response.ok) {
      throw new Error(`Lane request failed: ${response.status}`);
    }

    const data = await response.json();
    updateLaneBadges(data);
    statusMessage.textContent = 'Lane counts updated.';
  } catch (error) {
    statusMessage.textContent = `Lane fetch error: ${error.message}`;
  }
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

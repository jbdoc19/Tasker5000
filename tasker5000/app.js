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

const apiBase = '';
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
const fetchLanesButton = document.getElementById('fetchLanesButton');
const capacityForm = document.getElementById('capacityForm');
const energyInput = document.getElementById('energyInput');
const mentalInput = document.getElementById('mentalInput');
const difficultyInput = document.getElementById('difficultyInput');
const backlogInput = document.getElementById('backlogInput');
const anxietyInput = document.getElementById('anxietyInput');
const availabilityInput = document.getElementById('availabilityInput');
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
const lanesBoard = document.getElementById('lanesBoard');
const chartsList = document.getElementById('chartsList');
const timelineList = document.getElementById('timelineList');
const statusMessage = document.getElementById('statusMessage');
const chartCard = document.getElementById('chartCard');
const chartMeta = document.getElementById('chartMeta');
const fmcaAction = document.getElementById('fmcaAction');
const nextChartButton = document.getElementById('nextChartButton');
const reinitButton = document.getElementById('reinitButton');
const carouselStatus = document.getElementById('carouselStatus');
const fmcaTimelineList = document.getElementById('fmcaTimelineList');
const fmcaTimelinePanel = document.getElementById('fmcaTimelinePanel');
const chartControlButtons = document.querySelectorAll('[data-chart-action]');

const inputValueLabels = {
  energy: document.getElementById('energyValue'),
  mental: document.getElementById('mentalValue'),
  difficulty: document.getElementById('difficultyValue'),
  anxiety: document.getElementById('anxietyValue'),
};

let currentTimeline = [];
let lastRequestPayload = { ...samplePayload };
let currentMode = '';
let chartBatch = [];
let currentChartIndex = 0;

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

async function handleStartSprint(event) {
  event?.preventDefault();
  startAllTimers(currentMode);
  await computeAndRender(getPayloadFromForm());
  await fetchLaneData();
}

function attachInputListeners() {
  const pairs = [
    { input: energyInput, key: 'energy' },
    { input: mentalInput, key: 'mental' },
    { input: difficultyInput, key: 'difficulty' },
    { input: anxietyInput, key: 'anxiety' },
  ];

  pairs.forEach(({ input, key }) => {
    input?.addEventListener('input', () => updateInputLabel(input, key));
  });
}

function hydrateFormInputs(payload) {
  if (energyInput) energyInput.value = payload.R_phys ?? 0.8;
  if (mentalInput) mentalInput.value = payload.R_ment ?? 0.9;
  if (difficultyInput) difficultyInput.value = payload.Dtask ?? 0.5;
  if (backlogInput) backlogInput.value = payload.L ?? 5;
  if (anxietyInput) anxietyInput.value = payload.Aanxiety ?? 0.05;
  if (availabilityInput) availabilityInput.value = payload.availability_hours ?? 6;

  updateInputLabel(energyInput, 'energy');
  updateInputLabel(mentalInput, 'mental');
  updateInputLabel(difficultyInput, 'difficulty');
  updateInputLabel(anxietyInput, 'anxiety');
}

function getPayloadFromForm() {
  const payload = { ...samplePayload };

  payload.R_phys = safeNumber(energyInput?.value, payload.R_phys);
  payload.R_ment = safeNumber(mentalInput?.value, payload.R_ment);
  payload.Dtask = safeNumber(difficultyInput?.value, payload.Dtask);
  payload.L = safeInteger(backlogInput?.value, payload.L);

  const anxiety = safeNumber(anxietyInput?.value, payload.Aanxiety);
  payload.Aanxiety = anxiety;
  payload.Gguilt = anxiety;

  payload.availability_hours = safeNumber(availabilityInput?.value, payload.availability_hours);

  lastRequestPayload = { ...payload };
  return payload;
}

function updateInputLabel(input, key) {
  if (!input || !key || !inputValueLabels[key]) return;
  inputValueLabels[key].textContent = Number.parseFloat(input.value).toFixed(2);
}

function safeNumber(value, fallback) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeInteger(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isInteger(num) ? num : fallback;
}

startButton?.addEventListener('click', handleStartSprint);
capacityForm?.addEventListener('submit', handleStartSprint);
fetchLanesButton?.addEventListener('click', () => fetchLaneData());

nextChartButton?.addEventListener('click', () => {
  handleNextChart();
});

reinitButton?.addEventListener('click', async () => {
  statusMessage.textContent = 'Re-initializing sprint...';
  await computeAndRender(lastRequestPayload);
  await fetchLaneData();
});

chartControlButtons?.forEach((button) => {
  button.addEventListener('click', () => handleChartControl(button.dataset.chartAction));
});

document.addEventListener('DOMContentLoaded', () => {
  hydrateFormInputs(samplePayload);
  attachInputListeners();
  syncTimerDisplays();
  computeAndRender(getPayloadFromForm());
  fetchLaneData();
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
  if (startButton) startButton.disabled = true;
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
    if (startButton) startButton.disabled = false;
  }
}

function renderResponse(data) {
  // Update simple values and HUD
  updateModeDisplay(data.mode);
  updateEtaDisplay(data.etaH);

  // Pretty-print controls
  controlsJson.textContent = JSON.stringify(data.controls ?? {}, null, 2);

  renderTimeline(data.timeline);
  hydrateBatch(data.charts);
  renderCharts(data.charts);
  renderFmcaTimeline(data.timeline);
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
  const counts = {
    attest_only: getLaneCount(lanes, 'attest_only', 'attestOnly'),
    deep_fix_queue: getLaneCount(lanes, 'deep_fix_queue', 'deepFix'),
    parked: getLaneCount(lanes, 'parked'),
    same_day_required: getLaneCount(lanes, 'same_day_required', 'sameDayRequired'),
  };

  setBadgeText(attestCount, 'Attest-Only', counts.attest_only);
  setBadgeText(deepFixCount, 'Deep Fix', counts.deep_fix_queue);
  setBadgeText(parkedCount, 'Parked', counts.parked);
  setBadgeText(sameDayCount, 'Same-Day Required', counts.same_day_required);
}

function setBadgeText(element, label, value) {
  if (!element) return;
  const displayValue = typeof value === 'number' ? value : value ?? '—';
  element.textContent = `${label}: ${displayValue}`;
}

function getLaneCount(data, key, altKey) {
  const value = data?.[key] ?? (altKey ? data?.[altKey] : undefined);
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number') return value;
  return null;
}

function formatLaneLabel(label) {
  if (!label) return 'Unknown lane';
  return label
    .toString()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildMetaPill(label, extraClasses = []) {
  const pill = document.createElement('span');
  pill.classList.add('chart-card__pill', ...extraClasses);
  pill.textContent = label;
  return pill;
}

function buildChartCard(chart, laneLabel = '') {
  const chartId = chart?.chart_id ?? chart?.id ?? 'Unknown chart';
  const status = formatActionLabel(chart?.status ?? 'unknown');
  const age = chart?.age_days ?? chart?.ageDays ?? '—';
  const requiredToday = chart?.required_today ?? chart?.requiredToday ?? false;
  const lanes = Array.isArray(chart?.lanes) ? chart.lanes : laneLabel ? [laneLabel] : [];

  const card = document.createElement('div');
  card.classList.add('chart-card');

  const header = document.createElement('div');
  header.classList.add('chart-card__header');

  const idSpan = document.createElement('span');
  idSpan.classList.add('chart-card__id');
  idSpan.textContent = chartId;

  const statusPill = buildMetaPill(status, ['pill--muted']);

  header.appendChild(idSpan);
  header.appendChild(statusPill);
  card.appendChild(header);

  const meta = document.createElement('div');
  meta.classList.add('chart-card__meta');

  const laneLabelText = lanes.length ? lanes.map(formatLaneLabel).join(', ') : 'None';
  meta.appendChild(buildMetaPill(`Lane: ${laneLabelText}`));
  meta.appendChild(buildMetaPill(`Age: ${age} days`));

  const requiredClass = requiredToday ? ['pill--accent'] : ['pill--muted'];
  meta.appendChild(buildMetaPill(`Today: ${requiredToday ? 'Yes' : 'No'}`, requiredClass));

  card.appendChild(meta);

  return card;
}

function getActionHighlightClass(action) {
  const normalized = (action || '').toString().toLowerCase();

  if (normalized === 'micro_unstick') return 'pill--warning';
  if (normalized === 'accelerator') return 'pill--success';
  if (normalized === 'swap_3') return 'pill--accent';
  if (normalized === 'escalate' || normalized === 'escalated') return 'pill--danger';
  return null;
}

function createActionBadge(action) {
  const badge = document.createElement('span');
  badge.classList.add('chart-card__pill');
  badge.textContent = formatActionLabel(action ?? 'Action');

  const highlight = getActionHighlightClass(action);
  if (highlight) {
    badge.classList.add(highlight);
  }

  return badge;
}

function renderLaneSections(lanes) {
  if (!lanesBoard) return;

  lanesBoard.innerHTML = '';
  const laneEntries = lanes && typeof lanes === 'object' ? Object.entries(lanes) : [];

  if (!laneEntries.length) {
    lanesBoard.textContent = 'No lane data available yet.';
    return;
  }

  laneEntries.forEach(([laneKey, charts]) => {
    const laneBlock = document.createElement('details');
    laneBlock.classList.add('timeline-log');
    laneBlock.open = true;

    const summary = document.createElement('summary');
    summary.classList.add('timeline-log__summary');
    const chartCount = Array.isArray(charts) ? charts.length : 0;
    summary.textContent = `${formatLaneLabel(laneKey)} (${chartCount})`;

    const laneList = document.createElement('div');
    laneList.classList.add('list', 'list--stacked', 'timeline-log__list');

    if (Array.isArray(charts) && charts.length) {
      charts.forEach((chart) => {
        const card = buildChartCard(chart, formatLaneLabel(laneKey));
        laneList.appendChild(card);
      });
    } else {
      const emptyState = document.createElement('p');
      emptyState.classList.add('status', 'status--inline');
      emptyState.textContent = 'No charts in this lane yet.';
      laneList.appendChild(emptyState);
    }

    laneBlock.appendChild(summary);
    laneBlock.appendChild(laneList);
    lanesBoard.appendChild(laneBlock);
  });
}

async function fetchLaneData() {
  statusMessage.textContent = 'Refreshing lane counts...';

  try {
    const response = await fetch(lanesUrl);

    if (!response.ok) {
      throw new Error(`Lane request failed: ${response.status}`);
    }

    const data = await response.json();
    updateLaneBadges(data);
    renderLaneSections(data);
    statusMessage.textContent = 'Lane boards updated.';
  } catch (error) {
    statusMessage.textContent = `Lane fetch error: ${error.message}`;
  }
}

function renderCharts(charts) {
  chartsList.innerHTML = '';

  if (Array.isArray(charts) && charts.length) {
    charts.forEach((chart, index) => {
      const li = document.createElement('li');
      const card = buildChartCard(chart);
      const swaps = chart.swap_count ?? chart.swaps;

      if (swaps !== undefined) {
        const swapPill = buildMetaPill(`Swaps: ${swaps}`, ['pill--muted']);
        const meta = card.querySelector('.chart-card__meta');
        if (meta) meta.appendChild(swapPill);
      }

      li.appendChild(card);
      chartsList.appendChild(li);
    });
  } else {
    chartsList.textContent = 'No charts returned yet.';
  }
}

function renderTimeline(timeline) {
  if (!timelineList) return;
  timelineList.innerHTML = '';
  currentTimeline = Array.isArray(timeline) ? [...timeline] : [];

  if (currentTimeline.length === 0) {
    timelineList.textContent = 'No timeline steps yet.';
    return;
  }

  currentTimeline.forEach((step, index) => {
    const li = document.createElement('li');
    li.classList.add('chart-card');

    const header = document.createElement('div');
    header.classList.add('chart-card__header');

    const actionLabel = step.action ?? `Step ${index + 1}`;
    const actionBadge = createActionBadge(actionLabel);
    header.appendChild(actionBadge);

    if (step.chart_id) {
      header.appendChild(buildMetaPill(`Chart: ${step.chart_id}`, ['pill--muted']));
    }

    li.appendChild(header);

    const meta = document.createElement('div');
    meta.classList.add('chart-card__meta');

    if (step.message) {
      meta.appendChild(buildMetaPill(step.message));
    }

    if (step.user_state) {
      meta.appendChild(buildMetaPill(step.user_state, ['pill--muted']));
    }

    if (meta.children.length) {
      li.appendChild(meta);
    }

    const details = document.createElement('p');
    details.classList.add('chart-card__action');
    const fallback = step.note || step.description || '';
    details.textContent = fallback || formatActionLabel(actionLabel);
    li.appendChild(details);

    const actionButton = buildActionButton(step, index);
    if (actionButton) {
      const controlBar = document.createElement('div');
      controlBar.classList.add('chart-controls');
      controlBar.appendChild(actionButton);
      li.appendChild(controlBar);
    }

    timelineList.appendChild(li);
  });
}

function renderFmcaTimeline(timeline) {
  if (!fmcaTimelineList) return;
  fmcaTimelineList.innerHTML = '';

  const steps = Array.isArray(timeline) ? timeline.slice(-5).reverse() : [];

  if (steps.length === 0) {
    fmcaTimelineList.textContent = 'No FMCA events yet.';
    return;
  }

  steps.forEach((step, index) => {
    const li = document.createElement('li');
    li.classList.add('chart-card');

    const header = document.createElement('div');
    header.classList.add('chart-card__header');

    const actionLabel = step.action ?? `Event ${index + 1}`;
    header.appendChild(createActionBadge(actionLabel));

    if (step.chart_id) {
      header.appendChild(buildMetaPill(`Chart: ${step.chart_id}`, ['pill--muted']));
    }

    li.appendChild(header);
    fmcaTimelineList.appendChild(li);
  });

  if (fmcaTimelinePanel) {
    fmcaTimelinePanel.open = true;
  }
}

function hydrateBatch(charts) {
  chartBatch = Array.isArray(charts) ? charts : [];
  currentChartIndex = 0;
  updateCarousel();
}

function getCurrentChart() {
  return chartBatch[currentChartIndex] || chartBatch[0];
}

function handleChartControl(action) {
  if (!action) return;
  if (!chartBatch.length) {
    carouselStatus.textContent = 'Load a sprint before managing charts.';
    return;
  }

  const chart = getCurrentChart();
  const chartId = chart?.chart_id ?? chart?.id ?? 'chart1';

  let updatePayload = null;

  if (action === 'park') {
    updatePayload = {
      status: 'parked',
      blocker_note: 'Parked from HUD controls',
      next_steps: ['Re-prioritize later today', 'Add labs if missing', 'Prep summary'],
    };
  } else if (action === 'escalate') {
    updatePayload = {
      status: 'escalated',
      blocker_note: 'Escalated from HUD controls',
    };
  } else if (action === 'resolve') {
    updatePayload = { status: 'resolved' };
  }

  if (!updatePayload) return;

  triggerChartUpdate(chartId, updatePayload);
}

function toggleChartControlAvailability(enabled) {
  chartControlButtons?.forEach((button) => {
    button.disabled = !enabled;
    button.classList.toggle('pill-button--disabled', !enabled);
  });
}

function updateCarousel() {
  if (!chartCard || !carouselStatus) return;

  if (!chartBatch.length) {
    chartCard.innerHTML = '<p class="label">Current Chart</p><p class="value">No charts loaded yet.</p>';
    chartMeta.textContent = '';
    fmcaAction.textContent = 'FMCA action: —';
    carouselStatus.textContent = 'Load a sprint to begin.';
    toggleChartControlAvailability(false);
    updateNextButtonState();
    return;
  }

  const chart = chartBatch[currentChartIndex] || {};
  const chartId = chart.chart_id ?? chart.id ?? `chart-${currentChartIndex + 1}`;
  const status = (chart.status ?? 'unknown').toString();
  const swaps = chart.swap_count ?? chart.swaps ?? '—';

  const normalizedStatus = status.toLowerCase();
  const statusClass =
    normalizedStatus === 'escalated'
      ? 'chart-item__status chart-item__status--escalated'
      : normalizedStatus === 'resolved'
      ? 'chart-item__status chart-item__status--resolved'
      : 'chart-item__status';

  const typeLabel = chart.type ?? chart.chart_type ?? 'unknown';
  const age = chart.age_days ?? chart.age ?? '—';
  const requiresToday = chart.required_today ?? chart.requiredToday;
  const requiredLabel =
    typeof requiresToday === 'boolean' ? (requiresToday ? 'Yes' : 'No') : requiresToday ?? '—';

  chartCard.innerHTML = `
    <div class="chart-card__header">
      <span class="chart-card__id">${chartId}</span>
      <span class="${statusClass}">${status}</span>
    </div>
    <p class="chart-item__meta">Swaps: ${swaps}</p>
  `;

  if (chartMeta) {
    chartMeta.innerHTML = `
      <span class="chart-card__pill">Type: ${typeLabel}</span>
      <span class="chart-card__pill">Age: ${age} days</span>
      <span class="chart-card__pill">Required Today: ${requiredLabel}</span>
    `;
  }

  if (fmcaAction) {
    fmcaAction.textContent = `FMCA action: ${getChartActionLabel(chart)}`;
  }

  carouselStatus.textContent = `Chart ${currentChartIndex + 1} of ${chartBatch.length}`;
  toggleChartControlAvailability(true);
  updateNextButtonState();
}

function getChartActionLabel(chart) {
  if (!chart) return '—';
  const directAction = chart.fmca_action ?? chart.action;

  if (directAction) {
    return formatActionLabel(directAction);
  }

  const chartId = chart.chart_id ?? chart.id;
  const fromTimeline = findActionFromTimeline(chartId);
  return fromTimeline ? formatActionLabel(fromTimeline) : '—';
}

function findActionFromTimeline(chartId) {
  if (!chartId || !currentTimeline.length) return null;
  const reversed = [...currentTimeline].reverse();
  const match = reversed.find((step) => step.chart_id === chartId && step.action);
  return match?.action ?? null;
}

function formatActionLabel(action) {
  return action.toString().replace(/_/g, ' ');
}

function handleNextChart() {
  if (!chartBatch.length) {
    carouselStatus.textContent = 'No batch loaded. Re-init to fetch charts.';
    return;
  }

  if (currentChartIndex < chartBatch.length - 1) {
    currentChartIndex += 1;
    updateCarousel();
  } else {
    carouselStatus.textContent = 'End of batch reached. Re-init for a new plan.';
    updateNextButtonState();
  }
}

function updateNextButtonState() {
  if (!nextChartButton) return;

  const atEnd = currentChartIndex >= chartBatch.length - 1;
  nextChartButton.disabled = !chartBatch.length || atEnd;
  nextChartButton.textContent = atEnd && chartBatch.length ? 'Batch Complete' : 'Next Step →';
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
  const timelineIndex = typeof index === 'number' ? index : null;
  const step = typeof timelineIndex === 'number' ? currentTimeline[timelineIndex] : null;

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
    await fetchLaneData();
  } catch (error) {
    statusMessage.textContent = `Error updating chart: ${error.message}`;
  }
}

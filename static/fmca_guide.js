const flow = {
  start: { label: 'Start', description: 'Kick off the FMCA sprint.', next: 'pull' },
  pull: { label: 'Pull 8 batched charts', description: 'Load the fresh batch for this sprint.', next: 'timer' },
  timer: { label: 'Begin Sprint timer', description: 'Start the sprint timer and micro-timer.', next: 'check5' },
  check5: {
    label: '5 min elapsed without progress?',
    description: 'Decide whether to micro-unstick or keep flowing.',
    decision: true,
    options: { yes: 'micro', no: 'continue' },
  },
  micro: {
    label: 'Micro-Unstick',
    description: 'Define finish-line, smallest step, resume.',
    next: 'stuck',
  },
  continue: {
    label: 'Continue',
    description: 'Stay in flow and keep moving.',
    next: 'stuck',
  },
  stuck: {
    label: 'Still stuck?',
    description: 'If stuck, invoke Swap-3; otherwise close the sprint.',
    decision: true,
    options: { yes: 'swap3', no: 'sprintEnd' },
  },
  swap3: {
    label: 'Swap-3 Protocol',
    description: 'Park current chart, log blockers, pull 3, finish them.',
    next: 'sprintEnd',
  },
  sprintEnd: {
    label: 'Sprint End',
    description: 'Log wins, reset timers, preload next batch.',
    next: 'escalate',
  },
  escalate: {
    label: 'Escalate',
    description: 'Park chart with blockers/next steps.',
    next: 'finalSprintEnd',
  },
  finalSprintEnd: {
    label: 'Final Sprint End',
    description: 'Review log and close the sprint.',
  },
};

const nodes = [...document.querySelectorAll('[data-step-id]')];
const logList = document.getElementById('logList');
const summaryCard = document.getElementById('summaryCard');
const summaryList = document.getElementById('summaryList');
const currentStepLabel = document.getElementById('currentStepLabel');
const currentStepDetail = document.getElementById('currentStepDetail');
const progressBar = document.getElementById('progressBar');
const resetButton = document.getElementById('resetFlow');

let currentStep = 'start';
const completedSteps = new Set();

function setCurrentStep(stepId) {
  currentStep = stepId;
  nodes.forEach((node) => node.classList.toggle('active', node.dataset.stepId === stepId));
  const step = flow[stepId];
  currentStepLabel.textContent = step?.label ?? '—';
  currentStepDetail.textContent = step?.description ?? '';
  updateProgress();
}

function addLogEntry(stepId, detail) {
  if (completedSteps.has(stepId)) return;
  completedSteps.add(stepId);

  const step = flow[stepId];
  const item = document.createElement('li');
  const badge = document.createElement('span');
  badge.className = 'badge-inline';
  badge.textContent = `${completedSteps.size}/${Object.keys(flow).length}`;
  item.textContent = step?.label ?? stepId;
  if (detail) {
    const detailSpan = document.createElement('span');
    detailSpan.className = 'muted';
    detailSpan.textContent = ` — ${detail}`;
    item.append(' ', detailSpan);
  }
  item.append(' ', badge);
  logList.appendChild(item);
}

function handleStepCompletion(stepId, detail) {
  const node = nodes.find((n) => n.dataset.stepId === stepId);
  if (node) {
    node.classList.add('completed');
  }
  addLogEntry(stepId, detail);
  if (stepId === 'sprintEnd') {
    renderSummary();
  }
}

function moveTo(stepId, detail) {
  handleStepCompletion(currentStep, detail);
  if (stepId) {
    setCurrentStep(stepId);
  }
}

function attachEventListeners() {
  nodes.forEach((node) => {
    const stepId = node.dataset.stepId;
    if (flow[stepId]?.decision) return;

    node.addEventListener('click', () => {
      if (currentStep !== stepId) {
        setCurrentStep(stepId);
      }
      const next = flow[stepId]?.next;
      moveTo(next, undefined);
    });
  });

  document.querySelectorAll('.decision .pill').forEach((button) => {
    button.addEventListener('click', (event) => {
      const target = event.currentTarget.dataset.target;
      const parent = event.currentTarget.closest('.decision');
      const stepId = parent?.dataset.stepId;
      if (!stepId) return;
      const choiceLabel = event.currentTarget.textContent.trim();
      moveTo(target, choiceLabel);
    });
  });

  resetButton.addEventListener('click', resetFlow);
}

function resetFlow() {
  completedSteps.clear();
  nodes.forEach((node) => node.classList.remove('completed', 'active'));
  logList.innerHTML = '';
  summaryList.innerHTML = '';
  summaryCard.hidden = true;
  setCurrentStep('start');
}

function renderSummary() {
  summaryList.innerHTML = '';
  completedSteps.forEach((stepId) => {
    const li = document.createElement('li');
    li.textContent = flow[stepId]?.label ?? stepId;
    summaryList.appendChild(li);
  });
  summaryCard.hidden = false;
}

function updateProgress() {
  const total = Object.keys(flow).length;
  const percent = Math.max((completedSteps.size / total) * 100, 8);
  progressBar.style.width = `${percent}%`;
}

attachEventListeners();
setCurrentStep('start');

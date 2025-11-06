export const MORNING_LAUNCH = [
  "Open Adaptive Planner",
  "Review patient roster",
  "Confirm resident assignments",
  "Check inbox (≤15 min)",
  "Set energy slider and hit Launch",
];

const STORAGE_KEY = "ui.morningLaunch.state";

const getTodayStamp = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const loadState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored);
  } catch (error) {
    return null;
  }
};

const saveState = state => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Ignore storage failures (private browsing, quota, etc.).
  }
};

const sanitizeCompletedIndexes = indexes => {
  if (!Array.isArray(indexes)) {
    return [];
  }
  return Array.from(
    new Set(
      indexes
        .map(value => {
          const parsed = Number.parseInt(value, 10);
          return Number.isFinite(parsed) ? parsed : null;
        })
        .filter(index => index !== null && index >= 0 && index < MORNING_LAUNCH.length),
    ),
  ).sort((a, b) => a - b);
};

const ensureState = (existingState, options = {}) => {
  const { startCollapsed = false } = options;
  const today = getTodayStamp();
  if (!existingState || existingState.date !== today) {
    return {
      date: today,
      completed: false,
      completedAt: null,
      collapsed: Boolean(startCollapsed),
      completedItems: [],
    };
  }

  const state = { ...existingState };
  state.completedItems = sanitizeCompletedIndexes(existingState.completedItems);
  state.collapsed = typeof existingState.collapsed === "boolean" ? existingState.collapsed : Boolean(startCollapsed);
  state.completed = Boolean(existingState.completed) && state.completedItems.length === MORNING_LAUNCH.length;
  state.completedAt = state.completed ? existingState.completedAt || new Date().toISOString() : null;
  state.date = today;
  return state;
};

document.addEventListener("DOMContentLoaded", () => {
  const card = document.querySelector("[data-morning-launch]");
  if (!card) {
    return;
  }

  const toggleButton = card.querySelector("[data-ml-toggle]");
  const toggleIcon = card.querySelector("[data-ml-toggle-icon]");
  const panel = card.querySelector("[data-ml-panel]");
  const list = card.querySelector("[data-ml-list]");
  const progress = card.querySelector("[data-ml-progress]");

  if (!toggleButton || !panel || !list || !progress || !toggleIcon) {
    return;
  }

  const now = new Date();
  const beforeEight = now.getHours() < 8;
  let state = ensureState(loadState(), { startCollapsed: !beforeEight });

  const totalSteps = MORNING_LAUNCH.length;

  const updateProgressText = () => {
    if (state.completed) {
      progress.textContent = "Morning Launch complete";
    } else {
      const count = state.completedItems.length;
      progress.textContent = `${count} / ${totalSteps} steps ready`;
    }
  };

  const setCollapsed = collapsed => {
    state.collapsed = Boolean(collapsed);
    card.dataset.collapsed = state.collapsed ? "true" : "false";
    panel.hidden = state.collapsed;
    toggleButton.setAttribute("aria-expanded", state.collapsed ? "false" : "true");
    toggleIcon.textContent = state.collapsed ? "▸" : "▾";
  };

  const setCompletedState = completed => {
    state.completed = completed;
    if (completed) {
      state.completedAt = new Date().toISOString();
      setCollapsed(true);
      toggleButton.disabled = true;
      card.dataset.collapsed = "true";
      saveState(state);
      updateProgressText();
      card.dataset.complete = "true";
      card.classList.add("hidden");
    } else {
      state.completedAt = null;
      card.dataset.complete = "false";
      card.classList.remove("hidden");
      toggleButton.disabled = false;
      updateProgressText();
      saveState(state);
    }
  };

  const handleCheckboxToggle = (index, checked) => {
    const items = new Set(state.completedItems);
    if (checked) {
      items.add(index);
    } else {
      items.delete(index);
    }
    state.completedItems = Array.from(items).sort((a, b) => a - b);
    const allComplete = state.completedItems.length === totalSteps;
    if (allComplete) {
      setCompletedState(true);
    } else {
      if (state.completed) {
        card.dataset.complete = "false";
      }
      state.completed = false;
      updateProgressText();
      saveState(state);
    }
  };

  if (state.completed) {
    card.dataset.complete = "true";
    card.dataset.collapsed = "true";
    card.classList.add("hidden");
    toggleButton.disabled = true;
    return;
  }

  card.dataset.complete = "false";
  card.classList.remove("hidden");
  toggleButton.disabled = false;

  list.innerHTML = "";
  MORNING_LAUNCH.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "morning-launch-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "morning-launch-checkbox";
    checkbox.id = `morningLaunchStep-${index}`;
    checkbox.dataset.stepIndex = String(index);
    checkbox.checked = state.completedItems.includes(index);

    const label = document.createElement("label");
    label.className = "morning-launch-step";
    label.setAttribute("for", checkbox.id);
    label.textContent = step;

    item.append(checkbox, label);
    list.appendChild(item);
  });

  list.addEventListener("change", event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.type !== "checkbox" || !target.dataset.stepIndex) {
      return;
    }
    const index = Number.parseInt(target.dataset.stepIndex, 10);
    if (!Number.isInteger(index)) {
      return;
    }
    handleCheckboxToggle(index, target.checked);
  });

  toggleButton.addEventListener("click", () => {
    if (state.completed) {
      return;
    }
    setCollapsed(!state.collapsed);
    saveState(state);
  });

  updateProgressText();
  setCollapsed(state.collapsed);
  saveState(state);
});

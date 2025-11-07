import {
  setDay,
  setClinicSelection,
  getClinicSelection,
  setResidentPresence,
  getResidentPresence,
  setBlockResidentPresence,
  getBlockResidentPresence,
} from "./dayState.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SLOT_BLOCKS = ["AM", "PM"];
const SLOT_TIMES = {
  AM: ["08:00", "09:00", "10:00", "11:00"],
  PM: ["13:00", "14:00", "15:00", "16:00"]
};
const CLINIC_OPTIONS = ["Faculty", "Continuity", "St. PJs", "Admin Time", "Academics"];

const CLINIC_BASKET_ITEMS = [
  { id: "patientCalls", label: "Patient Calls" },
  { id: "resultsFollowUp", label: "Results Follow up" },
  { id: "results", label: "Results" },
  { id: "chartCompletion", label: "Chart Completion" },
  { id: "patientAdvice", label: "Patient Advice" },
  { id: "pendingOrders", label: "Pending Orders" },
  { id: "hospitalAdmits", label: "Hospital Admits" },
  { id: "ccdCharts", label: "CC'd charts" },
  { id: "staffMessages", label: "Staff Messages" }
];

const CLINIC_BASKET_STORAGE_KEY = "clinicBasketState";
const DEFAULT_BASKET_VALUES = CLINIC_BASKET_ITEMS.reduce((acc, item) => {
  acc[item.id] = 0;
  return acc;
}, {});

let grid = null;
let overlay = null;
let overlayTitle = null;
let overlaySubtitle = null;
let overlaySlots = null;
let closeButton = null;
let confirmButton = null;
let toastHost = null;
let overlaySlotsState = [];
let activeCell = null;
let activeCellDay = null;
let activeCellBlock = null;
let scheduleSummaryEl = null;
let clinicBasketForm = null;
let clinicBasketUpdatedEl = null;
let clinicBasketState = createDefaultBasketState();
let clinicBasketHighlightTimeout = null;

function todayName() {
  const name = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return typeof name === "string" ? name : "";
}

function clampToClinicDay(name) {
  if (DAYS.includes(name)) {
    return name;
  }
  return DAYS[0];
}

function createDefaultBasketState() {
  return {
    values: { ...DEFAULT_BASKET_VALUES },
    updatedAt: null
  };
}

function loadClinicBasketState() {
  try {
    const raw = localStorage.getItem(CLINIC_BASKET_STORAGE_KEY);
    if (!raw) {
      return createDefaultBasketState();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.values !== "object") {
      return createDefaultBasketState();
    }
    const nextState = createDefaultBasketState();
    CLINIC_BASKET_ITEMS.forEach(item => {
      const storedValue = Number.parseInt(parsed.values[item.id], 10);
      nextState.values[item.id] = Number.isFinite(storedValue) && storedValue >= 0 ? storedValue : 0;
    });
    if (typeof parsed.updatedAt === "string") {
      nextState.updatedAt = parsed.updatedAt;
    }
    return nextState;
  } catch (error) {
    console.warn("Unable to load clinic basket state:", error);
    return createDefaultBasketState();
  }
}

function persistClinicBasketState() {
  try {
    localStorage.setItem(CLINIC_BASKET_STORAGE_KEY, JSON.stringify(clinicBasketState));
  } catch (error) {
    console.warn("Unable to save clinic basket state:", error);
  }
}

function sanitizeBasketValue(value) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

function formatLastUpdatedLabel(dateString) {
  if (!dateString) {
    return "last updated —";
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "last updated —";
  }
  const datePart = date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit"
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return `last updated ${datePart} ${timePart}`;
}

function updateClinicBasketTimestamp(dateString) {
  if (!clinicBasketUpdatedEl) return;
  clinicBasketUpdatedEl.textContent = formatLastUpdatedLabel(dateString);
  if (dateString) {
    const parsed = new Date(dateString);
    if (!Number.isNaN(parsed.getTime())) {
      clinicBasketUpdatedEl.setAttribute("datetime", parsed.toISOString());
      return;
    }
  }
  clinicBasketUpdatedEl.removeAttribute("datetime");
}

function animateClinicBasketTimestamp() {
  if (!clinicBasketUpdatedEl) return;
  clinicBasketUpdatedEl.classList.remove("clinic-basket__updated-highlight");
  // Force reflow so the animation retriggers even if the class is already applied.
  // eslint-disable-next-line no-unused-expressions
  clinicBasketUpdatedEl.offsetWidth;
  clinicBasketUpdatedEl.classList.add("clinic-basket__updated-highlight");
  if (clinicBasketHighlightTimeout) {
    clearTimeout(clinicBasketHighlightTimeout);
  }
  clinicBasketHighlightTimeout = setTimeout(() => {
    clinicBasketUpdatedEl?.classList.remove("clinic-basket__updated-highlight");
  }, 600);
}

function commitClinicBasketValue(input, { enforceDisplay = false } = {}) {
  if (!(input instanceof HTMLInputElement)) return;
  const key = input.dataset.basketInput;
  if (!key) return;

  const sanitized = sanitizeBasketValue(input.value);
  const previous = clinicBasketState.values[key];
  clinicBasketState.values[key] = sanitized;

  if (enforceDisplay) {
    input.value = String(sanitized);
  }

  if (previous !== sanitized || clinicBasketState.updatedAt == null) {
    const now = new Date().toISOString();
    clinicBasketState.updatedAt = now;
    updateClinicBasketTimestamp(now);
    animateClinicBasketTimestamp();
  } else {
    updateClinicBasketTimestamp(clinicBasketState.updatedAt);
  }

  persistClinicBasketState();
}

function handleClinicBasketInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.basketInput) {
    return;
  }
  commitClinicBasketValue(target);
}

function handleClinicBasketBlur(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.basketInput) {
    return;
  }
  commitClinicBasketValue(target, { enforceDisplay: true });
}

function initializeClinicBasket() {
  clinicBasketForm = document.querySelector("#weeklyScheduleCard [data-clinic-basket-form]");
  clinicBasketUpdatedEl = document.querySelector("#weeklyScheduleCard [data-clinic-basket-updated]");
  clinicBasketState = loadClinicBasketState();

  if (clinicBasketForm) {
    CLINIC_BASKET_ITEMS.forEach(item => {
      const input = clinicBasketForm.querySelector(`[data-basket-input="${item.id}"]`);
      if (input instanceof HTMLInputElement) {
        input.value = String(clinicBasketState.values[item.id] ?? 0);
      }
    });
    clinicBasketForm.addEventListener("input", handleClinicBasketInput);
    clinicBasketForm.addEventListener("blur", handleClinicBasketBlur, true);
  }

  updateClinicBasketTimestamp(clinicBasketState.updatedAt);
}

function updateScheduleSummary(mode) {
  if (!scheduleSummaryEl) return;
  if (mode === "week") {
    scheduleSummaryEl.textContent = "Week overview";
    return;
  }
  const now = new Date();
  const day = clampToClinicDay(todayName());
  const datePart = now.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric"
  });
  scheduleSummaryEl.textContent = `${day} — ${datePart}`;
}

export function setScheduleMode(mode = "today") {
  if (!grid) return;
  const resolvedMode = mode === "week" ? "week" : "today";
  grid.innerHTML = "";
  grid.classList.toggle("weekly-grid--single-day", resolvedMode === "today");
  updateScheduleSummary(resolvedMode);
  renderSchedule(resolvedMode);
}

function renderSchedule(mode) {
  if (!grid) return;
  const currentDay = clampToClinicDay(todayName());
  const cells = mode === "today"
    ? SLOT_BLOCKS.map(block => ({ day: currentDay, block }))
    : DAYS.flatMap(day => SLOT_BLOCKS.map(block => ({ day, block })));

  if (mode === "week") {
    grid.style.removeProperty("--weekly-grid-columns");
  }

  cells.forEach(({ day, block }) => {
    const cell = document.createElement("div");
    cell.className = "weekly-grid__cell";
    cell.dataset.day = day;
    cell.dataset.block = block;
    cell.setAttribute("role", "button");
    cell.tabIndex = 0;

    const dayLabel = document.createElement("div");
    dayLabel.className = "weekly-grid__day";
    dayLabel.textContent = day;

    const clinicWrapper = document.createElement("div");
    clinicWrapper.className = "weekly-grid__clinic-wrapper";

    const select = document.createElement("select");
    select.className = "weekly-grid__clinic-select";
    const storedClinic = getClinicSelection(day, block) ?? CLINIC_OPTIONS[0];
    if (!getClinicSelection(day, block)) {
      setClinicSelection(day, block, storedClinic);
    }
    CLINIC_OPTIONS.forEach(option => {
      const optionEl = document.createElement("option");
      optionEl.value = option;
      optionEl.textContent = option;
      select.appendChild(optionEl);
    });
    select.value = storedClinic;
    select.addEventListener("change", () => {
      setClinicSelection(day, block, select.value);
      if (day === activeCellDay && block === activeCellBlock) {
        setDay(day, block, select.value);
      }
    });
    select.addEventListener("click", event => {
      event.stopPropagation();
    });

    const residentIcon = document.createElement("span");
    residentIcon.className = "weekly-grid__resident-icon";
    residentIcon.textContent = "👥";
    residentIcon.setAttribute("aria-hidden", "true");

    clinicWrapper.append(select, residentIcon);

    const blockLabel = document.createElement("div");
    blockLabel.className = "weekly-grid__time";
    blockLabel.textContent = block;

    const hasStoredResidents = resolveResidentPresence(day, block);
    updateResidentIcon(residentIcon, hasStoredResidents);

    const handleCellClick = event => {
      if (event.target instanceof HTMLElement && event.target.closest(".weekly-grid__clinic-select")) {
        return;
      }
      openDayOverlay(day, block, cell);
    };

    cell.addEventListener("click", handleCellClick);
    cell.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && event.target === cell) {
        event.preventDefault();
        openDayOverlay(day, block, cell);
      }
    });

    cell.append(dayLabel, clinicWrapper, blockLabel);
    grid.appendChild(cell);
  });
}

function resolveResidentPresence(day, block) {
  const storedBlockPresence = getBlockResidentPresence(day, block);
  if (typeof storedBlockPresence === "boolean") {
    return storedBlockPresence;
  }
  const times = SLOT_TIMES[block] || [];
  return times.some((_, index) => getResidentPresence(day, block, index));
}

function updateResidentIcon(iconEl, hasResident) {
  if (!iconEl) return;
  iconEl.classList.toggle("weekly-grid__resident-icon--visible", Boolean(hasResident));
  iconEl.setAttribute("aria-hidden", hasResident ? "false" : "true");
}

function openDayOverlay(day, block, cell) {
  if (!overlay || !overlayTitle || !overlaySubtitle || !overlaySlots) {
    return;
  }

  const clinicSelection = getClinicSelection(day, block) ?? CLINIC_OPTIONS[0];
  setDay(day, block, clinicSelection);
  activeCell = cell || null;
  activeCellDay = day;
  activeCellBlock = block;

  overlayTitle.textContent = `${day} — ${block}`;
  overlaySubtitle.textContent = "Tap 👩‍⚕️ to include a resident.";
  overlaySlots.innerHTML = "";

  const times = SLOT_TIMES[block] || [];
  overlaySlotsState = times.map((time, index) => ({
    time,
    resident: Boolean(getResidentPresence(day, block, index)),
  }));

  times.forEach((time, index) => {
    const slotRow = document.createElement("div");
    slotRow.className = "day-overlay__slot";

    const info = document.createElement("div");
    info.className = "day-overlay__slot-info";

    const timeEl = document.createElement("div");
    timeEl.className = "day-overlay__slot-time";
    timeEl.textContent = time;

    const labelEl = document.createElement("div");
    labelEl.className = "day-overlay__slot-label";
    labelEl.textContent = "Slot";

    info.append(timeEl, labelEl);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "resident-toggle";
    toggle.textContent = "🧑‍⚕️";
    const initiallyPresent = overlaySlotsState[index].resident;
    toggle.setAttribute("aria-pressed", initiallyPresent ? "true" : "false");

    toggle.addEventListener("click", () => {
      const pressed = toggle.getAttribute("aria-pressed") === "true";
      const next = !pressed;
      toggle.setAttribute("aria-pressed", next ? "true" : "false");
      overlaySlotsState[index].resident = next;
    });

    slotRow.append(info, toggle);
    overlaySlots.appendChild(slotRow);
  });

  overlay.removeAttribute("hidden");
}

function hideOverlay() {
  if (!overlay) return;
  overlay.setAttribute("hidden", "");
  overlaySlotsState = [];
  activeCell = null;
  activeCellDay = null;
  activeCellBlock = null;
}

function injectHeaderToggles() {
  const header = document.querySelector("#weeklyScheduleCard .schedule-card__header");
  if (!header) return;

  let todayButton = header.querySelector("[data-open-today]");
  if (!todayButton) {
    todayButton = document.createElement("button");
    todayButton.type = "button";
    todayButton.dataset.openToday = "";
    todayButton.textContent = "Today";
    header.appendChild(todayButton);
  } else {
    todayButton.type = "button";
  }

  let weekButton = header.querySelector("[data-open-week]");
  if (!weekButton) {
    weekButton = document.createElement("button");
    weekButton.type = "button";
    weekButton.dataset.openWeek = "";
    weekButton.textContent = "Week";
    header.appendChild(weekButton);
  } else {
    weekButton.type = "button";
  }

  todayButton.addEventListener("click", () => setScheduleMode("today"));
  weekButton.addEventListener("click", () => setScheduleMode("week"));
}

function attachOverlayControls() {
  if (!overlay) return;

  closeButton?.addEventListener("click", hideOverlay);

  confirmButton?.addEventListener("click", () => {
    const basePlan = [
      { time: "07:30", type: "task", label: "Morning Launch", source: "ritual" }
    ];
    const patientSlots = overlaySlotsState.map(slot => ({
      time: slot.time,
      type: "patient",
      label: `Visit (${slot.resident ? "with" : "no"} resident)`,
      source: "schedule"
    }));
    const plan = basePlan.concat(patientSlots);
    document.dispatchEvent(new CustomEvent("planReady", { detail: plan }));

    if (activeCellDay && activeCellBlock) {
      overlaySlotsState.forEach((slot, index) => {
        setResidentPresence(activeCellDay, activeCellBlock, index, slot.resident);
      });
      const hasResident = overlaySlotsState.some(slot => slot.resident);
      setBlockResidentPresence(activeCellDay, activeCellBlock, hasResident);
      const iconEl = activeCell?.querySelector(".weekly-grid__resident-icon");
      if (iconEl) {
        updateResidentIcon(iconEl, hasResident);
      }
    }

    const focusTarget = activeCell;
    hideOverlay();
    if (focusTarget) {
      focusTarget.focus();
    }
  });
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  Object.assign(toast.style, {
    position: "fixed",
    top: "1rem",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 12px",
    borderRadius: "10px",
    background: "#2dd4c3",
    color: "#022624",
    zIndex: 3000,
    transition: "opacity 0.4s"
  });
  toast.textContent = message;
  const host = toastHost || document.getElementById("toastContainer") || document.body;
  host.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2400);
  setTimeout(() => {
    toast.remove();
  }, 2800);
}

document.addEventListener("planReady", event => {
  showToast("✅ Plan built — View adaptive checklist");
  console.log("Plan:", event.detail);
});

document.addEventListener("DOMContentLoaded", () => {
  grid = document.getElementById("weeklyScheduleGrid");
  overlay = document.querySelector("#weeklyScheduleCard [data-day-overlay]");
  overlayTitle = overlay?.querySelector("[data-day-overlay-title]") || null;
  overlaySubtitle = overlay?.querySelector("[data-day-overlay-subtitle]") || null;
  overlaySlots = overlay?.querySelector("[data-day-overlay-slots]") || null;
  closeButton = overlay?.querySelector("[data-day-overlay-close]") || null;
  confirmButton = overlay?.querySelector("[data-day-overlay-confirm]") || null;
  toastHost = document.getElementById("toastContainer");
  scheduleSummaryEl = document.querySelector("#weeklyScheduleCard [data-schedule-summary]");

  initializeClinicBasket();

  if (!grid) {
    return;
  }

  injectHeaderToggles();
  attachOverlayControls();
  setScheduleMode("today");
});

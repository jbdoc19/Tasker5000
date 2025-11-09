import {
  dayState,
  setDay,
  setClinicSelection,
  getClinicSelection,
  getResidentPresence,
  getBlockResidentPresence,
  getPatientSlots,
  setPatientSlots,
} from "./dayState.js";
import {
  CLINIC_BASKET_ITEMS,
  CLINIC_DAYS as DAYS,
  CLINIC_OPTIONS,
  SLOT_BLOCKS,
  SLOT_TIMES,
} from "./scheduleData.js";

const CLINIC_BASKET_STORAGE_KEY = "clinicBasketState";
const DEFAULT_BASKET_VALUES = CLINIC_BASKET_ITEMS.reduce((acc, item) => {
  acc[item.id] = 0;
  return acc;
}, {});
const WEEKEND_AVAILABILITY_STORAGE_KEY = "taskerWeekendAvailability";
const DEFAULT_WEEKEND_AVAILABILITY = { sat: false, sun: true };
const WEEKEND_DAYS = [
  { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" },
];

let grid = null;
let overlay = null;
let overlayTitle = null;
let overlaySubtitle = null;
let overlaySlots = null;
let closeButton = null;
let confirmButton = null;
let addPatientButton = null;
let toastHost = null;
let overlaySlotsState = [];
let activeCell = null;
let activeTrigger = null;
let activeCellDay = null;
let activeCellBlock = null;
let scheduleSummaryEl = null;
let clinicBasketForm = null;
let clinicBasketUpdatedEl = null;
let clinicBasketState = createDefaultBasketState();
let clinicBasketHighlightTimeout = null;
let weekendAvailability = createDefaultWeekendAvailability();
const weekendCellRefs = new Map();

function clonePatientSlotsSnapshot() {
  const source = dayState.patientSlots || {};
  return Object.fromEntries(
    Object.entries(source).map(([key, slots]) => [
      key,
      Array.isArray(slots) ? slots.map(slot => ({ ...slot })) : [],
    ]),
  );
}

function cloneDayStateSnapshot() {
  return {
    currentDay: dayState.currentDay,
    currentBlock: dayState.currentBlock,
    clinicType: dayState.clinicType,
    clinicSelections: { ...dayState.clinicSelections },
    blockResidentPresence: { ...dayState.blockResidentPresence },
    residentMap: { ...dayState.residentMap },
    patientSlots: clonePatientSlotsSnapshot(),
  };
}

function cloneClinicBasketSnapshot() {
  return {
    values: { ...clinicBasketState.values },
    updatedAt: clinicBasketState.updatedAt,
  };
}

function parseTimeValue(timeString) {
  if (typeof timeString !== "string") {
    return Number.POSITIVE_INFINITY;
  }
  const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.POSITIVE_INFINITY;
  }
  return hours * 60 + minutes;
}

function sortSlots(slots) {
  if (!Array.isArray(slots)) {
    return [];
  }
  return slots
    .map((slot, index) => ({
      slot: { ...slot },
      index,
      minutes: parseTimeValue(slot?.time),
    }))
    .sort((a, b) => {
      if (a.minutes === b.minutes) {
        return a.index - b.index;
      }
      return a.minutes - b.minutes;
    })
    .map(entry => entry.slot);
}

function sortOverlaySlotsState() {
  overlaySlotsState = sortSlots(overlaySlotsState);
}

function emitScheduleStateUpdate(reason) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("scheduleStateUpdated", {
      detail: {
        reason,
        dayState: cloneDayStateSnapshot(),
        clinicBasket: cloneClinicBasketSnapshot(),
      },
    }),
  );
}

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

function createDefaultWeekendAvailability() {
  return { ...DEFAULT_WEEKEND_AVAILABILITY };
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

function loadWeekendAvailability() {
  try {
    const raw = localStorage.getItem(WEEKEND_AVAILABILITY_STORAGE_KEY);
    if (!raw) {
      return createDefaultWeekendAvailability();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return createDefaultWeekendAvailability();
    }
    const next = createDefaultWeekendAvailability();
    WEEKEND_DAYS.forEach(day => {
      next[day.id] = Boolean(parsed[day.id]);
    });
    return next;
  } catch (error) {
    console.warn("Unable to load weekend availability:", error);
    return createDefaultWeekendAvailability();
  }
}

function persistWeekendAvailability() {
  try {
    localStorage.setItem(WEEKEND_AVAILABILITY_STORAGE_KEY, JSON.stringify(weekendAvailability));
  } catch (error) {
    console.warn("Unable to save weekend availability:", error);
  }
}

function getWeekendAvailabilityValue(dayId) {
  if (Object.prototype.hasOwnProperty.call(weekendAvailability, dayId)) {
    return Boolean(weekendAvailability[dayId]);
  }
  return false;
}

function applyWeekendAvailabilityState(dayId) {
  const refs = weekendCellRefs.get(dayId);
  if (!refs) return;
  const isAvailable = getWeekendAvailabilityValue(dayId);
  refs.badge.textContent = isAvailable ? "Available" : "Off duty";
  refs.badge.classList.toggle("weekend-card__badge--on", isAvailable);
  refs.badge.classList.toggle("weekend-card__badge--off", !isAvailable);
  refs.toggle.setAttribute("aria-pressed", isAvailable ? "true" : "false");
  refs.toggle.textContent = isAvailable ? "Turn off" : "Turn on";
  refs.toggle.classList.toggle("weekend-card__toggle--active", isAvailable);
  if (refs.label) {
    const action = isAvailable ? "Mark unavailable" : "Mark available";
    refs.toggle.setAttribute("aria-label", `${action} for ${refs.label}`);
    refs.toggle.title = `${refs.label} — ${isAvailable ? "On" : "Off"}`;
  }
}

function handleWeekendToggle(dayId) {
  const next = !getWeekendAvailabilityValue(dayId);
  weekendAvailability[dayId] = next;
  applyWeekendAvailabilityState(dayId);
  persistWeekendAvailability();
  emitScheduleStateUpdate("weekend-availability:update");
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
  emitScheduleStateUpdate("clinic-basket:update");
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
  emitScheduleStateUpdate("clinic-basket:init");
}

function ensureScheduleSummaryParts() {
  if (!scheduleSummaryEl) {
    return null;
  }

  let icon = scheduleSummaryEl.querySelector(".schedule-summary__icon");
  let text = scheduleSummaryEl.querySelector(".schedule-summary__text");

  if (!icon || !text) {
    scheduleSummaryEl.innerHTML = "";
    icon = document.createElement("span");
    icon.className = "schedule-summary__icon";
    icon.setAttribute("aria-hidden", "true");
    scheduleSummaryEl.appendChild(icon);

    text = document.createElement("span");
    text.className = "schedule-summary__text";
    scheduleSummaryEl.appendChild(text);
  }

  return { icon, text };
}

function updateScheduleSummary(mode) {
  if (!scheduleSummaryEl) return;
  if (mode === "week") {
    scheduleSummaryEl.classList.remove("schedule-summary--with-icon");
    scheduleSummaryEl.textContent = "Week overview";
    return;
  }
  const now = new Date();
  const today = todayName();
  const day = today || clampToClinicDay(today);
  const datePart = now.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric"
  });
  const parts = ensureScheduleSummaryParts();
  if (!parts) {
    return;
  }
  scheduleSummaryEl.classList.add("schedule-summary--with-icon");
  parts.icon.textContent = "📅";
  parts.text.textContent = `${day} — ${datePart}`;
}

export function setScheduleMode(mode = "today") {
  if (!grid) return;
  const resolvedMode = mode === "week" ? "week" : "today";
  grid.innerHTML = "";
  grid.classList.toggle("weekly-grid--single-day", resolvedMode === "today");
  updateScheduleSummary(resolvedMode);
  renderSchedule(resolvedMode);
}

function appendClinicCell(day, block) {
  if (!grid) return;
  const cell = document.createElement("div");
  cell.className = "weekly-grid__cell";
  cell.dataset.day = day;
  cell.dataset.block = block;
  cell.setAttribute("role", "group");
  cell.tabIndex = -1;

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
    emitScheduleStateUpdate("clinic-selection");
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

  const manageButton = document.createElement("button");
  manageButton.type = "button";
  manageButton.className = "weekly-grid__manage";
  manageButton.textContent = "⚙️";
  manageButton.setAttribute("aria-label", `Open ${day} ${block} confirmation`);
  manageButton.title = `Open ${day} ${block} confirmation`;
  manageButton.addEventListener("click", () => {
    activeTrigger = manageButton;
    openDayOverlay(day, block, cell);
  });

  cell.append(dayLabel, clinicWrapper, blockLabel, manageButton);
  grid.appendChild(cell);
}

function renderWeekendCells(rowSpan) {
  if (!grid) return;
  WEEKEND_DAYS.forEach(({ id, label }) => {
    const cell = document.createElement("div");
    cell.className = "weekly-grid__cell weekly-grid__cell--weekend";
    cell.dataset.weekendDay = id;
    cell.setAttribute("role", "group");
    cell.tabIndex = -1;
    if (rowSpan > 1) {
      cell.style.gridRow = `span ${rowSpan}`;
    }

    const dayLabel = document.createElement("div");
    dayLabel.className = "weekly-grid__day";
    dayLabel.textContent = label;

    const card = document.createElement("div");
    card.className = "weekend-card";

    const title = document.createElement("div");
    title.className = "weekend-card__title";
    title.textContent = "Admin Day";

    const note = document.createElement("p");
    note.className = "weekend-card__note";
    note.textContent = "Dedicated space for inbox, planning, and catch-up.";

    const badge = document.createElement("span");
    badge.className = "weekend-card__badge";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "weekend-card__toggle";
    toggle.dataset.weekendToggle = id;
    toggle.setAttribute("aria-pressed", getWeekendAvailabilityValue(id) ? "true" : "false");
    toggle.addEventListener("click", () => {
      handleWeekendToggle(id);
    });

    card.append(title, note, badge, toggle);
    cell.append(dayLabel, card);
    grid.appendChild(cell);

    weekendCellRefs.set(id, { badge, toggle, cell, label });
    applyWeekendAvailabilityState(id);
  });
}

function renderSchedule(mode) {
  if (!grid) return;
  weekendCellRefs.clear();
  const currentDay = clampToClinicDay(todayName());

  if (mode === "today") {
    grid.classList.remove("weekly-grid--with-weekend");
    grid.style.removeProperty("--weekly-grid-columns");
    grid.style.removeProperty("--weekly-grid-rows");
    SLOT_BLOCKS.forEach(block => {
      appendClinicCell(currentDay, block);
    });
    return;
  }

  const columnCount = DAYS.length + WEEKEND_DAYS.length;
  const rowCount = Math.max(SLOT_BLOCKS.length, 1);
  grid.classList.add("weekly-grid--with-weekend");
  grid.style.setProperty("--weekly-grid-columns", String(columnCount));
  grid.style.setProperty("--weekly-grid-rows", String(rowCount));

  if (SLOT_BLOCKS.length > 0) {
    const [firstBlock, ...remainingBlocks] = SLOT_BLOCKS;
    DAYS.forEach(day => {
      appendClinicCell(day, firstBlock);
    });
    renderWeekendCells(rowCount);
    remainingBlocks.forEach(block => {
      DAYS.forEach(day => {
        appendClinicCell(day, block);
      });
    });
    return;
  }

  renderWeekendCells(rowCount);
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

function createDefaultSlot(day, block, time, index) {
  return {
    id: `default-${block}-${index}`,
    time,
    label: "Visit",
    resident: Boolean(getResidentPresence(day, block, index)),
    isCustom: false,
  };
}

function loadOverlaySlots(day, block) {
  const stored = getPatientSlots(day, block);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.map((slot, index) => ({
      id: typeof slot.id === "string" && slot.id.trim() ? slot.id : `slot-${index}`,
      time: typeof slot.time === "string" ? slot.time : "",
      label: typeof slot.label === "string" && slot.label.trim() ? slot.label.trim() : "Visit",
      resident: Boolean(slot.resident),
      isCustom: Boolean(slot.isCustom),
    }));
  }
  const times = SLOT_TIMES[block] || [];
  return times.map((time, index) => createDefaultSlot(day, block, time, index));
}

function buildOverlaySlotRow(slot, index) {
  const slotRow = document.createElement("div");
  slotRow.className = "day-overlay__slot";
  slotRow.dataset.slotId = slot.id;

  const info = document.createElement("div");
  info.className = "day-overlay__slot-info";

  if (slot.isCustom) {
    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.className = "day-overlay__custom-time";
    timeInput.value = slot.time || "";
    timeInput.addEventListener("input", () => {
      overlaySlotsState[index].time = timeInput.value;
      persistOverlayState("patient-slot:time");
    });

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "day-overlay__custom-label";
    labelInput.placeholder = "Patient details";
    labelInput.value = slot.label || "";
    labelInput.addEventListener("input", () => {
      overlaySlotsState[index].label = labelInput.value;
      persistOverlayState("patient-slot:label");
    });

    info.append(timeInput, labelInput);
  } else {
    const timeEl = document.createElement("div");
    timeEl.className = "day-overlay__slot-time";
    timeEl.textContent = slot.time || "—";

    const labelEl = document.createElement("div");
    labelEl.className = "day-overlay__slot-label";
    labelEl.textContent = slot.label || "Visit";

    info.append(timeEl, labelEl);
  }

  const actions = document.createElement("div");
  actions.className = "day-overlay__slot-actions";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "resident-toggle";
  toggle.textContent = "🧑‍⚕️";
  toggle.setAttribute("aria-pressed", slot.resident ? "true" : "false");
  toggle.addEventListener("click", () => {
    const pressed = toggle.getAttribute("aria-pressed") === "true";
    const next = !pressed;
    toggle.setAttribute("aria-pressed", next ? "true" : "false");
    overlaySlotsState[index].resident = next;
    persistOverlayState("patient-slot:resident");
  });

  actions.appendChild(toggle);

  if (slot.isCustom) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "day-overlay__remove-patient";
    removeButton.setAttribute("aria-label", "Remove patient");
    removeButton.textContent = "✕";
    removeButton.addEventListener("click", () => {
      overlaySlotsState.splice(index, 1);
      persistOverlayState("patient-slot:remove");
      renderOverlaySlots();
    });
    actions.appendChild(removeButton);
  }

  slotRow.append(info, actions);
  return slotRow;
}

function renderOverlaySlots() {
  if (!overlaySlots) return;
  overlaySlots.innerHTML = "";
  overlaySlotsState.forEach((slot, index) => {
    overlaySlots.appendChild(buildOverlaySlotRow(slot, index));
  });
}

function persistOverlayState(reason) {
  if (!activeCellDay || !activeCellBlock) {
    return;
  }
  setPatientSlots(activeCellDay, activeCellBlock, overlaySlotsState);
  overlaySlotsState = getPatientSlots(activeCellDay, activeCellBlock);
  const hasResident = overlaySlotsState.some(slot => slot.resident);
  const iconEl = activeCell?.querySelector(".weekly-grid__resident-icon");
  if (iconEl) {
    updateResidentIcon(iconEl, hasResident);
  }
  emitScheduleStateUpdate(reason || "patient-slots:update");
}

function handleAddPatientSlot() {
  if (!activeCellDay || !activeCellBlock) {
    return;
  }
  const customCount = overlaySlotsState.filter(slot => slot.isCustom).length + 1;
  overlaySlotsState.push({
    id: `custom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    time: "",
    label: `Added patient ${customCount}`,
    resident: false,
    isCustom: true,
  });
  persistOverlayState("patient-slot:add");
  renderOverlaySlots();
  const latestRow = overlaySlots?.querySelector(
    ".day-overlay__slot:last-of-type .day-overlay__custom-time",
  );
  latestRow?.focus();
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
  overlaySlotsState = loadOverlaySlots(day, block);
  renderOverlaySlots();

  overlay.removeAttribute("hidden");
}

function hideOverlay({ restoreFocus = false } = {}) {
  if (!overlay) return;
  const focusTarget = restoreFocus ? activeTrigger || activeCell : null;
  overlay.setAttribute("hidden", "");
  overlaySlotsState = [];
  activeCell = null;
  activeTrigger = null;
  activeCellDay = null;
  activeCellBlock = null;
  focusTarget?.focus();
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

  closeButton?.addEventListener("click", () => hideOverlay({ restoreFocus: true }));

  addPatientButton?.addEventListener("click", () => {
    handleAddPatientSlot();
  });

  addPatientButton?.addEventListener("click", () => {
    handleAddPatientSlot();
  });

  confirmButton?.addEventListener("click", () => {
    persistOverlayState("patient-slot:confirm");
    const basePlan = [
      { time: "07:30", type: "task", label: "Morning Launch", source: "ritual" }
    ];
    const patientSlots = overlaySlotsState.map(slot => ({
      time: slot.time || "",
      type: "patient",
      label: `${(slot.label || "Visit").trim()} (${slot.resident ? "with" : "no"} resident)`,
      source: "schedule"
    }));
    const plan = basePlan.concat(patientSlots);
    document.dispatchEvent(new CustomEvent("planReady", { detail: plan }));

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
  addPatientButton = overlay?.querySelector("[data-day-overlay-add-patient]") || null;
  toastHost = document.getElementById("toastContainer");
  scheduleSummaryEl = document.querySelector("#weeklyScheduleCard [data-schedule-summary]");

  initializeClinicBasket();
  weekendAvailability = loadWeekendAvailability();

  if (!grid) {
    return;
  }

  injectHeaderToggles();
  attachOverlayControls();
  setScheduleMode("today");
});

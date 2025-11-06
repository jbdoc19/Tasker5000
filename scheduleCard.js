import { WEEK_SCHEDULE } from "./scheduleModel.js";
import { dayState, setDay, setResidentPresence } from "./dayState.js";
import { bucketTemplate as BUCKET_TEMPLATE } from "./bucketModel.js";
import { buildAdaptiveDayPlan } from "./adaptivePlanner.js";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SLOT_ORDER = ["AM", "PM"];

const cloneSchedule = source => {
  if (typeof structuredClone === "function") {
    return structuredClone(source);
  }
  return JSON.parse(JSON.stringify(source));
};

const scheduleState = cloneSchedule(WEEK_SCHEDULE);

const createEmptyPatient = () => ({ time: "", id: null, residentPresent: false });

const ensureBlockStructure = block => {
  if (!block) return;
  if (!Array.isArray(block.patients)) {
    block.patients = [];
  }
  while (block.patients.length < 4) {
    block.patients.push(createEmptyPatient());
  }
};

const getDefaultDay = () => {
  try {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", { weekday: "long" });
    const dayName = formatter.format(today);
    if (DAY_ORDER.includes(dayName)) {
      return dayName;
    }
  } catch (error) {
    // Ignore Intl errors and fall back to Monday.
  }
  return DAY_ORDER[0];
};

const formatTimeRange = block => {
  if (!block || !block.start || !block.end) {
    return "—";
  }
  return `${block.start} – ${block.end}`;
};

const setToggleState = (toggle, present) => {
  if (!toggle) return;
  toggle.setAttribute("aria-pressed", present ? "true" : "false");
  toggle.setAttribute("aria-label", present ? "Resident present" : "Resident not present");
  toggle.textContent = "🧑‍⚕️";
};

const formatSlotLabel = (patient, index) => {
  if (patient && patient.id) {
    return `Patient ${patient.id}`;
  }
  return `Awaiting assignment #${index + 1}`;
};

const formatSlotTime = (patient, index) => {
  if (patient && patient.time) {
    return patient.time;
  }
  return `Slot ${index + 1}`;
};

document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("weeklyScheduleCard");
  if (!card) return;

  const grid = card.querySelector("[data-weekly-grid]");
  const overlay = card.querySelector("[data-day-overlay]");
  const overlayTitle = card.querySelector("[data-day-overlay-title]");
  const overlaySubtitle = card.querySelector("[data-day-overlay-subtitle]");
  const overlaySlots = card.querySelector("[data-day-overlay-slots]");
  const confirmButton = card.querySelector("[data-day-overlay-confirm]");
  const closeButton = card.querySelector("[data-day-overlay-close]");
  const todayButton = card.querySelector("[data-schedule-today]");

  if (!grid || !overlay || !overlayTitle || !overlaySubtitle || !overlaySlots || !confirmButton || !closeButton) {
    return;
  }

  grid.setAttribute("aria-rowcount", String(SLOT_ORDER.length));
  grid.setAttribute("aria-colcount", String(DAY_ORDER.length));

  let activeDay = null;
  let activeSlot = null;
  let lastTrigger = null;

  const closeOverlay = () => {
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    activeDay = null;
    activeSlot = null;
    if (lastTrigger) {
      lastTrigger.focus();
      lastTrigger = null;
    }
  };

  const openOverlay = (day, slot, trigger) => {
    const schedule = scheduleState[day];
    if (!schedule) return;
    const block = schedule[slot];
    if (!block) return;

    ensureBlockStructure(block);

    activeDay = day;
    activeSlot = slot;
    lastTrigger = trigger || null;
    setDay(day, slot, block.label || null);

    overlay.hidden = false;
    overlay.removeAttribute("aria-hidden");
    if (typeof overlay.focus === "function") {
      overlay.focus({ preventScroll: true });
    }
    overlayTitle.textContent = day;
    overlaySubtitle.textContent = `${slot} block · ${block.label || "Clinic"}`;

    overlaySlots.innerHTML = "";

    block.patients.forEach((patient, index) => {
      const slotRow = document.createElement("div");
      slotRow.className = "day-overlay__slot";

      const info = document.createElement("div");
      info.className = "day-overlay__slot-info";

      const time = document.createElement("span");
      time.className = "day-overlay__slot-time";
      time.textContent = formatSlotTime(patient, index);

      const label = document.createElement("span");
      label.className = "day-overlay__slot-label";
      label.textContent = formatSlotLabel(patient, index);

      info.append(time, label);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "resident-toggle";
      toggle.dataset.day = day;
      toggle.dataset.slot = slot;
      toggle.dataset.index = String(index);

      const present = Boolean(patient && patient.residentPresent);
      setToggleState(toggle, present);
      setResidentPresence(day, slot, index, present);

      toggle.addEventListener("click", () => {
        const targetBlock = scheduleState[day]?.[slot];
        if (!targetBlock) return;
        ensureBlockStructure(targetBlock);
        const current = targetBlock.patients[index] || createEmptyPatient();
        current.residentPresent = !current.residentPresent;
        targetBlock.patients[index] = current;
        setToggleState(toggle, current.residentPresent);
        setResidentPresence(day, slot, index, current.residentPresent);
      });

      slotRow.append(info, toggle);
      overlaySlots.append(slotRow);
    });

    const firstToggle = overlaySlots.querySelector(".resident-toggle");
    if (firstToggle) {
      firstToggle.focus();
    }
  };

  const renderGrid = () => {
    grid.innerHTML = "";
    SLOT_ORDER.forEach(slot => {
      DAY_ORDER.forEach(day => {
        const schedule = scheduleState[day];
        if (!schedule) return;

        const block = schedule[slot] || {};
        ensureBlockStructure(block);

        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "weekly-grid__cell";
        cell.dataset.day = day;
        cell.dataset.slot = slot;
        cell.setAttribute("role", "gridcell");
        const colIndex = DAY_ORDER.indexOf(day) + 1;
        const rowIndex = SLOT_ORDER.indexOf(slot) + 1;
        cell.setAttribute("aria-colindex", String(colIndex));
        cell.setAttribute("aria-rowindex", String(rowIndex));
        cell.setAttribute(
          "aria-label",
          `${day} ${slot}: ${block.label || "Unassigned"} ${formatTimeRange(block)}`
        );

        const dayLabel = document.createElement("span");
        dayLabel.className = "weekly-grid__day";
        dayLabel.textContent = day;

        const session = document.createElement("span");
        session.className = "weekly-grid__session";
        session.textContent = `${slot} block`;

        const clinic = document.createElement("span");
        clinic.className = "weekly-grid__clinic";
        clinic.textContent = block.label || "Clinic TBD";

        const time = document.createElement("span");
        time.className = "weekly-grid__time";
        time.textContent = formatTimeRange(block);

        const indicator = document.createElement("span");
        indicator.className = "weekly-grid__indicator";
        indicator.textContent = "🧑‍⚕️";
        if (block.residentRequired) {
          indicator.classList.add("weekly-grid__indicator--visible");
        }

        cell.append(dayLabel, session, clinic, time, indicator);
        cell.addEventListener("click", () => openOverlay(day, slot, cell));
        grid.append(cell);
      });
    });
  };

  renderGrid();

  if (todayButton) {
    todayButton.addEventListener("click", () => {
      const targetDay = getDefaultDay();
      const focusCell = grid.querySelector(`[data-day="${targetDay}"][data-slot="AM"]`);
      if (focusCell) {
        focusCell.focus();
        focusCell.click();
      }
    });
  }

  confirmButton.addEventListener("click", () => {
    if (activeDay && activeSlot) {
      buildAdaptiveDayPlan(dayState, WEEK_SCHEDULE, BUCKET_TEMPLATE);
    }
    closeOverlay();
  });

  closeButton.addEventListener("click", () => {
    closeOverlay();
  });

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });

  overlay.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
    }
  });
});

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

export function setScheduleMode(mode = "today") {
  if (!grid) return;
  const resolvedMode = mode === "week" ? "week" : "today";
  grid.innerHTML = "";
  grid.classList.toggle("weekly-grid--single-day", resolvedMode === "today");
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

  if (!grid) {
    return;
  }

  injectHeaderToggles();
  attachOverlayControls();
  setScheduleMode("today");
});

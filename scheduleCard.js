import { WEEK_SCHEDULE } from "./scheduleModel.js";
import {
  setDay,
  replaceResidentMap,
  setResidentPresence,
} from "./dayState.js";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SLOT_ORDER = ["AM", "PM"];

const cloneSchedule = source => {
  if (typeof structuredClone === "function") {
    return structuredClone(source);
  }
  return JSON.parse(JSON.stringify(source));
};

const scheduleState = cloneSchedule(WEEK_SCHEDULE);

const buildResidentMapFromSchedule = schedule => {
  const map = {};
  DAY_ORDER.forEach(day => {
    const daySchedule = schedule[day];
    if (!daySchedule) return;
    SLOT_ORDER.forEach(slot => {
      const block = daySchedule[slot];
      if (!block || !Array.isArray(block.patients)) return;
      block.patients.forEach((patient, index) => {
        map[`${day}|${slot}|${index}`] = Boolean(patient?.residentPresent);
      });
    });
  });
  return map;
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
    // Fallback to Monday if Intl is unavailable.
  }
  return DAY_ORDER[0];
};

const formatTimeRange = block => {
  if (!block || !block.start || !block.end) {
    return "—";
  }
  return `${block.start} – ${block.end}`;
};

const hasResidentCoverage = block => {
  if (!block || !Array.isArray(block.patients)) {
    return false;
  }
  return block.patients.some(patient => Boolean(patient && patient.residentPresent));
};

const createResidentBadge = present => {
  const badge = document.createElement("span");
  badge.className = "schedule-grid__resident-badge";
  if (present) {
    badge.classList.add("schedule-grid__resident-badge--present");
    badge.textContent = "🧑‍⚕️";
  } else {
    badge.textContent = "—";
  }
  return badge;
};

const updateResidentBadge = (badge, present) => {
  if (!badge) return;
  badge.classList.toggle("schedule-grid__resident-badge--present", present);
  badge.textContent = present ? "🧑‍⚕️" : "—";
};

const updateResidentToggle = (toggle, present) => {
  if (!toggle) return;
  toggle.setAttribute("aria-pressed", present ? "true" : "false");
  toggle.setAttribute("aria-label", present ? "Resident present" : "Resident not present");
  toggle.textContent = present ? "🧑‍⚕️" : "—";
};

document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("weeklyScheduleCard");
  if (!card) return;

  const grid = card.querySelector("[data-schedule-grid]");
  const dayView = card.querySelector("[data-schedule-day-view]");
  const dayTitle = card.querySelector("[data-schedule-day-title]");
  const daySummary = card.querySelector("[data-schedule-day-summary]");
  const dayBlocks = card.querySelector("[data-schedule-day-blocks]");
  const todayButton = card.querySelector("[data-schedule-today]");

  if (!grid || !dayView || !dayTitle || !daySummary || !dayBlocks) {
    return;
  }

  const cellMap = new Map();
  const dayCellMap = new Map();
  let activeDay = getDefaultDay();
  let activeBlock = "AM";

  const syncDayState = (day, block) => {
    const clinicType = scheduleState[day]?.[block]?.label || null;
    setDay(day, block, clinicType);
  };

  const handleDaySelection = day => {
    if (!DAY_ORDER.includes(day) || !scheduleState[day]) {
      return;
    }
    activeDay = day;
    dayCellMap.forEach((cells, dayName) => {
      const isActive = dayName === day;
      cells.forEach(cell => {
        cell.classList.toggle("schedule-grid__cell--active", isActive);
        cell.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    });
    renderDayView(day);
  };

  const handleCellSelection = (day, slot) => {
    if (!DAY_ORDER.includes(day) || !scheduleState[day]) {
      return;
    }
    activeBlock = slot;
    syncDayState(day, slot);
    handleDaySelection(day);
  };

  const updateDaySummary = day => {
    const schedule = scheduleState[day];
    if (!schedule || !daySummary) return;

    let totalSlots = 0;
    let residentSlots = 0;
    SLOT_ORDER.forEach(slot => {
      const block = schedule[slot];
      if (!block || !Array.isArray(block.patients)) {
        return;
      }
      block.patients.forEach(patient => {
        if (!patient) return;
        totalSlots += 1;
        if (patient.residentPresent) {
          residentSlots += 1;
        }
      });
    });

    if (totalSlots === 0) {
      daySummary.textContent = "No scheduled patients for this day.";
      return;
    }

    const slotLabel = totalSlots === 1 ? "slot" : "slots";
    if (residentSlots === 0) {
      daySummary.textContent = `${totalSlots} patient ${slotLabel} · No resident coverage`;
    } else {
      const residentLabel = residentSlots === 1 ? "slot" : "slots";
      daySummary.textContent = `${totalSlots} patient ${slotLabel} · ${residentSlots} resident ${residentLabel}`;
    }
  };

  const updateGridResidentIndicator = (day, slot) => {
    const key = `${day}-${slot}`;
    const entry = cellMap.get(key);
    if (!entry) return;
    const block = scheduleState[day]?.[slot];
    const present = hasResidentCoverage(block);
    updateResidentBadge(entry.badge, present);
    if (entry.srLabel) {
      entry.srLabel.textContent = present ? "Resident present" : "No resident";
    }
  };

  const renderDayView = day => {
    const schedule = scheduleState[day];
    if (!schedule) return;

    dayTitle.textContent = day;
    dayBlocks.innerHTML = "";

    SLOT_ORDER.forEach(slot => {
      const block = schedule[slot] || {};
      const blockEl = document.createElement("article");
      blockEl.className = "schedule-day-view__block";
      blockEl.dataset.slot = slot;

      const head = document.createElement("div");
      head.className = "schedule-day-view__block-head";

      const title = document.createElement("h4");
      title.className = "schedule-day-view__block-title";
      title.textContent = block.label || `${slot} block`;

      const time = document.createElement("span");
      time.className = "schedule-day-view__block-time";
      time.textContent = formatTimeRange(block);

      head.append(title, time);
      blockEl.append(head);

      if (block.locationLabel) {
        const location = document.createElement("span");
        location.className = "schedule-day-view__location";
        location.textContent = block.locationLabel;
        blockEl.append(location);
      }

      if (!Array.isArray(block.patients) || block.patients.length === 0) {
        const empty = document.createElement("p");
        empty.className = "schedule-day-view__empty";
        empty.textContent = "No scheduled patients in this block.";
        blockEl.append(empty);
      } else {
        const list = document.createElement("ul");
        list.className = "schedule-day-view__patients";
        block.patients.forEach((patient, index) => {
          const item = document.createElement("li");
          item.className = "schedule-day-view__patient";

          const details = document.createElement("div");
          details.className = "schedule-day-view__patient-details";

          const timeEl = document.createElement("span");
          timeEl.className = "schedule-day-view__patient-time";
          timeEl.textContent = patient?.time || "—";

          const idEl = document.createElement("span");
          idEl.className = "schedule-day-view__patient-id";
          idEl.textContent = patient?.id ? String(patient.id) : "Unassigned slot";

          details.append(timeEl, idEl);

          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "schedule-resident-toggle";
          toggle.dataset.day = day;
          toggle.dataset.slot = slot;
          toggle.dataset.index = String(index);
          updateResidentToggle(toggle, Boolean(patient?.residentPresent));

          toggle.addEventListener("click", () => {
            const blockRef = scheduleState[day]?.[slot];
            if (!blockRef || !Array.isArray(blockRef.patients)) {
              return;
            }
            const current = blockRef.patients[index];
            if (!current) return;
            current.residentPresent = !current.residentPresent;
            setResidentPresence(day, slot, index, current.residentPresent);
            updateResidentToggle(toggle, current.residentPresent);
            updateGridResidentIndicator(day, slot);
            updateDaySummary(day);
          });

          item.append(details, toggle);
          list.append(item);
        });
        blockEl.append(list);
      }

      dayBlocks.append(blockEl);
    });

    dayView.hidden = false;
    updateDaySummary(day);
  };

  const renderGrid = () => {
    grid.innerHTML = "";
    DAY_ORDER.forEach(day => {
      const schedule = scheduleState[day];
      if (!schedule) return;

      SLOT_ORDER.forEach(slot => {
        const block = schedule[slot] || {};
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "schedule-grid__cell";
        cell.dataset.day = day;
        cell.dataset.slot = slot;
        cell.setAttribute("aria-pressed", "false");
        cell.setAttribute("aria-label", `${day} ${slot}: ${block.label || "Unassigned"} ${formatTimeRange(block)}`);

        if (slot === "AM") {
          const dayName = document.createElement("span");
          dayName.className = "schedule-grid__dayname";
          dayName.textContent = day;
          cell.append(dayName);
        }

        const slotLabel = document.createElement("span");
        slotLabel.className = "schedule-grid__slot-label";
        slotLabel.textContent = slot;
        cell.append(slotLabel);

        const label = document.createElement("span");
        label.className = "schedule-grid__label";
        label.textContent = block.label || "—";
        cell.append(label);

        const time = document.createElement("span");
        time.className = "schedule-grid__time";
        time.textContent = formatTimeRange(block);
        cell.append(time);

        const residentWrap = document.createElement("span");
        residentWrap.className = "schedule-grid__resident";
        const badge = createResidentBadge(hasResidentCoverage(block));
        residentWrap.append(badge);

        const srLabel = document.createElement("span");
        srLabel.className = "visually-hidden";
        srLabel.textContent = hasResidentCoverage(block) ? "Resident present" : "No resident";
        residentWrap.append(srLabel);

        cell.append(residentWrap);

        cell.addEventListener("click", () => {
          handleCellSelection(day, slot);
        });

        grid.append(cell);

        if (!dayCellMap.has(day)) {
          dayCellMap.set(day, []);
        }
        dayCellMap.get(day).push(cell);
        cellMap.set(`${day}-${slot}`, { cell, badge, srLabel });
      });
    });
  };

  renderGrid();
  replaceResidentMap(buildResidentMapFromSchedule(scheduleState));
  handleCellSelection(activeDay, activeBlock);

  if (todayButton) {
    todayButton.addEventListener("click", () => {
      const targetDay = getDefaultDay();
      if (DAY_ORDER.includes(targetDay)) {
        handleCellSelection(targetDay, "AM");
        const focusCell = grid.querySelector(`[data-day="${targetDay}"][data-slot="AM"]`);
        if (focusCell) {
          focusCell.focus();
        }
      }
    });
  }
});

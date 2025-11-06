const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SLOT_BLOCKS = ["AM", "PM"];
const SLOT_TIMES = {
  AM: ["08:00", "09:00", "10:00", "11:00"],
  PM: ["13:00", "14:00", "15:00", "16:00"]
};

let grid = null;
let overlay = null;
let overlayTitle = null;
let overlaySubtitle = null;
let overlaySlots = null;
let closeButton = null;
let confirmButton = null;
let toastHost = null;
let overlaySlotsState = [];

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
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "weekly-grid__cell";
    cell.dataset.day = day;
    cell.dataset.block = block;
    cell.textContent = `${day} ${block}`;
    cell.addEventListener("click", () => openDayOverlay(day, block));
    grid.appendChild(cell);
  });
}

function openDayOverlay(day, block) {
  if (!overlay || !overlayTitle || !overlaySubtitle || !overlaySlots) {
    return;
  }

  overlayTitle.textContent = `${day} — ${block}`;
  overlaySubtitle.textContent = "Tap 👩‍⚕️ to include a resident.";
  overlaySlots.innerHTML = "";

  const times = SLOT_TIMES[block] || [];
  overlaySlotsState = times.map(time => ({ time, resident: false }));

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
    toggle.setAttribute("aria-pressed", "false");

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
    hideOverlay();
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

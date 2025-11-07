import { dayState } from "./dayState.js";
import { WEEK_SCHEDULE } from "./scheduleModel.js";
import {
  CLINIC_BASKET_ITEMS,
  CLINIC_DAYS,
  CLINIC_OPTIONS,
  SLOT_BLOCKS,
  SLOT_TIMES,
} from "./scheduleData.js";

function clonePatientSlots() {
  const source = dayState.patientSlots || {};
  return Object.fromEntries(
    Object.entries(source).map(([key, slots]) => [
      key,
      Array.isArray(slots) ? slots.map(slot => ({ ...slot })) : [],
    ]),
  );
}

function cloneDayState() {
  return {
    currentDay: dayState.currentDay,
    currentBlock: dayState.currentBlock,
    clinicType: dayState.clinicType,
    clinicSelections: { ...dayState.clinicSelections },
    blockResidentPresence: { ...dayState.blockResidentPresence },
    residentMap: { ...dayState.residentMap },
    patientSlots: clonePatientSlots(),
  };
}

function cloneBasketItems() {
  return CLINIC_BASKET_ITEMS.map(item => ({ ...item }));
}

function cloneSlotTimes() {
  return Object.fromEntries(
    Object.entries(SLOT_TIMES).map(([block, times]) => [block, [...times]]),
  );
}

if (typeof window !== "undefined") {
  window.TaskerSchedule = Object.assign(window.TaskerSchedule || {}, {
    getWeekSchedule: () => WEEK_SCHEDULE,
    getDayState: () => cloneDayState(),
    getPatientSlots: () => clonePatientSlots(),
    getClinicBasketItems: () => cloneBasketItems(),
    getClinicDays: () => [...CLINIC_DAYS],
    getSlotBlocks: () => [...SLOT_BLOCKS],
    getSlotTimes: () => cloneSlotTimes(),
    getClinicOptions: () => [...CLINIC_OPTIONS],
  });

  window.dispatchEvent(
    new CustomEvent("scheduleBridgeReady", {
      detail: {
        dayState: cloneDayState(),
        clinicBasketItems: cloneBasketItems(),
      },
    }),
  );
}

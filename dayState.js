import { CLINIC_OPTIONS } from "./scheduleData.js";

const STORAGE_KEY = "taskerScheduleState";

const CLINIC_OPTION_LOOKUP = new Map(
  CLINIC_OPTIONS.map(option => [option.toLowerCase(), option]),
);

function normalizeClinicOption(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const directMatch = CLINIC_OPTION_LOOKUP.get(trimmed.toLowerCase());
  if (directMatch) {
    return directMatch;
  }
  return null;
}

const hasStorage = () => typeof window !== "undefined" && window.localStorage;

function sanitizeBoolean(value) {
  return value === true;
}

function sanitizePatientSlot(slot, index) {
  const safe = slot && typeof slot === "object" ? slot : {};
  const id = typeof safe.id === "string" && safe.id.trim() ? safe.id.trim() : `slot-${index}`;
  const time = typeof safe.time === "string" ? safe.time : "";
  const label = typeof safe.label === "string" && safe.label.trim() ? safe.label.trim() : "Visit";
  return {
    id,
    time,
    label,
    resident: sanitizeBoolean(safe.resident),
    isCustom: Boolean(safe.isCustom),
  };
}

function clonePatientSlotsMap(source) {
  const clone = {};
  if (!source || typeof source !== "object") {
    return clone;
  }
  Object.entries(source).forEach(([key, slots]) => {
    if (Array.isArray(slots)) {
      clone[key] = slots.map((slot, index) => sanitizePatientSlot(slot, index));
    }
  });
  return clone;
}

function createDefaultState() {
  return {
    currentDay: null,
    currentBlock: null,
    clinicType: null,
    residentMap: {},
    clinicSelections: {},
    blockResidentPresence: {},
    patientSlots: {},
  };
}

function loadStateFromStorage() {
  const base = createDefaultState();
  if (!hasStorage()) {
    return base;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return base;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return base;
    }
    if (typeof parsed.currentDay === "string") {
      base.currentDay = parsed.currentDay;
    }
    if (typeof parsed.currentBlock === "string") {
      base.currentBlock = parsed.currentBlock;
    }
    const storedClinicType = normalizeClinicOption(parsed.clinicType);
    if (storedClinicType) {
      base.clinicType = storedClinicType;
    }
    if (parsed.clinicSelections && typeof parsed.clinicSelections === "object") {
      base.clinicSelections = Object.fromEntries(
        Object.entries(parsed.clinicSelections)
          .map(([key, value]) => {
            const normalized = normalizeClinicOption(value);
            return normalized ? [key, normalized] : null;
          })
          .filter(Boolean),
      );
    }
    if (parsed.blockResidentPresence && typeof parsed.blockResidentPresence === "object") {
      base.blockResidentPresence = Object.fromEntries(
        Object.entries(parsed.blockResidentPresence).map(([key, value]) => [key, sanitizeBoolean(value)]),
      );
    }
    if (parsed.residentMap && typeof parsed.residentMap === "object") {
      base.residentMap = Object.fromEntries(
        Object.entries(parsed.residentMap).map(([key, value]) => [key, sanitizeBoolean(value)]),
      );
    }
    base.patientSlots = clonePatientSlotsMap(parsed.patientSlots);
    return base;
  } catch (error) {
    console.warn("[dayState] Unable to load schedule state:", error);
    return base;
  }
}

function persistState() {
  if (!hasStorage()) {
    return;
  }
  try {
    const payload = {
      currentDay: dayState.currentDay,
      currentBlock: dayState.currentBlock,
      clinicType: dayState.clinicType,
      clinicSelections: { ...dayState.clinicSelections },
      blockResidentPresence: { ...dayState.blockResidentPresence },
      residentMap: { ...dayState.residentMap },
      patientSlots: clonePatientSlotsMap(dayState.patientSlots),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[dayState] Unable to persist schedule state:", error);
  }
}

const initialState = loadStateFromStorage();

export const dayState = initialState;

export function setDay(day, block, clinicType) {
  dayState.currentDay = day ?? null;
  dayState.currentBlock = block ?? null;
  const normalized = normalizeClinicOption(clinicType);
  dayState.clinicType = normalized ?? null;
  persistState();
}

export function replaceResidentMap(map) {
  dayState.residentMap = map ? { ...map } : {};
}

const createBlockKey = (day, block) => {
  if (!day || !block) {
    return null;
  }
  return `${day}|${block}`;
};

const createResidentKey = (day, block, slotIndex) => {
  if (!day || !block || typeof slotIndex !== "number") {
    return null;
  }
  return `${day}|${block}|${slotIndex}`;
};

export function setClinicSelection(day, block, clinicType) {
  const key = createBlockKey(day, block);
  if (!key) return;
  if (clinicType == null) {
    delete dayState.clinicSelections[key];
  } else {
    const normalized = normalizeClinicOption(clinicType);
    if (normalized) {
      dayState.clinicSelections[key] = normalized;
    } else {
      delete dayState.clinicSelections[key];
    }
  }
  persistState();
}

export function getClinicSelection(day, block) {
  const key = createBlockKey(day, block);
  if (!key) return undefined;
  return dayState.clinicSelections[key];
}

export function setResidentPresence(day, block, slotIndex, present) {
  const key = createResidentKey(day, block, slotIndex);
  if (!key) return;
  dayState.residentMap[key] = Boolean(present);
  const blockKey = createBlockKey(day, block);
  if (blockKey) {
    const slots = Array.isArray(dayState.patientSlots[blockKey])
      ? dayState.patientSlots[blockKey].slice()
      : [];
    while (slots.length <= slotIndex) {
      slots.push(sanitizePatientSlot({}, slots.length));
    }
    slots[slotIndex] = {
      ...slots[slotIndex],
      resident: Boolean(present),
    };
    dayState.patientSlots[blockKey] = slots;
    const hasResident = slots.some(slot => slot.resident);
    dayState.blockResidentPresence[blockKey] = hasResident;
  }
  persistState();
}

export function getResidentPresence(day, block, slotIndex) {
  const key = createResidentKey(day, block, slotIndex);
  if (!key) return undefined;
  return dayState.residentMap[key];
}

export function setBlockResidentPresence(day, block, present) {
  const key = createBlockKey(day, block);
  if (!key) return;
  if (present == null) {
    delete dayState.blockResidentPresence[key];
  } else {
    dayState.blockResidentPresence[key] = Boolean(present);
  }
  persistState();
}

export function getBlockResidentPresence(day, block) {
  const key = createBlockKey(day, block);
  if (!key) return undefined;
  return dayState.blockResidentPresence[key];
}

function clearResidentMapForBlock(day, block) {
  const blockKey = createBlockKey(day, block);
  if (!blockKey) return;
  const prefix = `${blockKey}|`;
  Object.keys(dayState.residentMap).forEach(residentKey => {
    if (residentKey.startsWith(prefix)) {
      delete dayState.residentMap[residentKey];
    }
  });
}

export function getPatientSlots(day, block) {
  const key = createBlockKey(day, block);
  if (!key) return [];
  const slots = dayState.patientSlots[key];
  if (!Array.isArray(slots)) {
    return [];
  }
  return slots.map(slot => ({ ...slot }));
}

export function setPatientSlots(day, block, slots) {
  const key = createBlockKey(day, block);
  if (!key) return;
  if (!Array.isArray(slots) || slots.length === 0) {
    delete dayState.patientSlots[key];
  } else {
    dayState.patientSlots[key] = slots.map((slot, index) => sanitizePatientSlot(slot, index));
  }
  clearResidentMapForBlock(day, block);
  const resolvedSlots = dayState.patientSlots[key] || [];
  resolvedSlots.forEach((slot, index) => {
    const residentKey = createResidentKey(day, block, index);
    if (residentKey) {
      dayState.residentMap[residentKey] = Boolean(slot.resident);
    }
  });
  const hasResident = resolvedSlots.some(slot => slot.resident);
  dayState.blockResidentPresence[key] = hasResident;
  persistState();
}

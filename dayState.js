export const dayState = {
  currentDay: null,
  currentBlock: null,
  clinicType: null,
  residentMap: {},
  clinicSelections: {},
  blockResidentPresence: {},
};

export function setDay(day, block, clinicType) {
  dayState.currentDay = day ?? null;
  dayState.currentBlock = block ?? null;
  dayState.clinicType = clinicType ?? null;
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
    dayState.clinicSelections[key] = clinicType;
  }
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
}

export function getBlockResidentPresence(day, block) {
  const key = createBlockKey(day, block);
  if (!key) return undefined;
  return dayState.blockResidentPresence[key];
}

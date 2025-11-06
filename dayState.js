export const dayState = {
  currentDay: null,
  currentBlock: null,
  clinicType: null,
  residentMap: {},
};

export function setDay(day, block, clinicType) {
  dayState.currentDay = day ?? null;
  dayState.currentBlock = block ?? null;
  dayState.clinicType = clinicType ?? null;
}

export function replaceResidentMap(map) {
  dayState.residentMap = map ? { ...map } : {};
}

const createResidentKey = (day, block, slotIndex) => {
  if (!day || !block || typeof slotIndex !== "number") {
    return null;
  }
  return `${day}|${block}|${slotIndex}`;
};

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

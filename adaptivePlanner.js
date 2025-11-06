const pad = value => String(value).padStart(2, "0");

const toMinutes = time => {
  if (typeof time !== "string") return NaN;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return NaN;
  return hours * 60 + minutes;
};

const toTimeString = minutes => {
  const safeMinutes = Number.isFinite(minutes) && minutes >= 0 ? minutes : 0;
  const hrs = Math.floor(safeMinutes / 60) % 24;
  const mins = safeMinutes % 60;
  return `${pad(hrs)}:${pad(mins)}`;
};

const buildPatientEntries = (block, fallbackLabel) => {
  if (!block || !Array.isArray(block.patients)) return [];
  const defaultTime = block.start || "00:00";
  return block.patients.map((patient, index) => ({
    time: patient?.time || defaultTime,
    type: "patient",
    label: patient?.id ? String(patient.id) : `${fallbackLabel} ${index + 1}`,
    source: "schedule",
  }));
};

const buildBucketEntries = (block, BUCKET_TEMPLATE) => {
  if (!Array.isArray(BUCKET_TEMPLATE) || BUCKET_TEMPLATE.length === 0) return [];
  const limit = Math.min(BUCKET_TEMPLATE.length, 3);
  const startMinutes = Number.isFinite(toMinutes(block?.start))
    ? Math.max(toMinutes(block.start) - 30, 0)
    : 420;
  let cursor = startMinutes;
  return BUCKET_TEMPLATE.slice(0, limit).map((item, index) => {
    const increment = Number.isFinite(item?.avgTime) && item.avgTime > 0 ? item.avgTime : 10;
    cursor = index === 0 ? cursor : cursor + increment;
    return {
      time: toTimeString(cursor),
      type: "task",
      label: item?.type || `Bucket Task ${index + 1}`,
      source: "bucket",
    };
  });
};

const sortPlan = items =>
  items.slice().sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

export function buildAdaptiveDayPlan(dayState, WEEK_SCHEDULE, BUCKET_TEMPLATE) {
  console.info("[AdaptivePlanner] Starting plan build", { dayState });
  if (!dayState?.currentDay || !dayState?.currentBlock) {
    console.warn("[AdaptivePlanner] Missing day or block selection", dayState);
    return [];
  }

  const daySchedule = WEEK_SCHEDULE?.[dayState.currentDay];
  const block = daySchedule?.[dayState.currentBlock];
  if (!block) {
    console.warn(
      "[AdaptivePlanner] No clinic block found",
      dayState.currentDay,
      dayState.currentBlock
    );
    return [];
  }

  const patients = buildPatientEntries(block, "Patient Slot");
  const bucketTasks = buildBucketEntries(block, BUCKET_TEMPLATE);
  const plan = sortPlan([...bucketTasks, ...patients]);

  console.log(
    `[AdaptivePlanner] Plan ready for ${dayState.currentDay} ${dayState.currentBlock}`,
    plan
  );

  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("planReady", { detail: plan }));
  }

  return plan;
}

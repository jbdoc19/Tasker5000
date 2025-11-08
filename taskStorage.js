const EMPTY_RESULT = { tasks: [], discarded: 0, error: null };

function isObject(value) {
  return Boolean(value) && typeof value === "object";
}

function toArrayFromNumericObject(candidate) {
  if (!isObject(candidate)) return null;
  const keys = Object.keys(candidate);
  if (!keys.length) return null;
  if (!keys.every(key => /^\d+$/.test(key))) {
    return null;
  }
  return keys
    .sort((a, b) => Number(a) - Number(b))
    .map(key => candidate[key]);
}

const COLLECTION_KEYS = [
  "tasks",
  "items",
  "entries",
  "list",
  "value",
  "data",
  "payload",
  "taskList",
  "taskEntries",
];

function extractCandidateList(candidate, depth = 0) {
  if (Array.isArray(candidate)) {
    return candidate;
  }

  if (typeof candidate === "string") {
    if (!candidate.trim()) return null;
    if (depth > 4) return null;
    try {
      const parsed = JSON.parse(candidate);
      return extractCandidateList(parsed, depth + 1);
    } catch (error) {
      return null;
    }
  }

  if (!isObject(candidate)) {
    return null;
  }

  const numericValues = toArrayFromNumericObject(candidate);
  if (Array.isArray(numericValues)) {
    return numericValues;
  }

  for (const key of COLLECTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(candidate, key)) {
      const list = extractCandidateList(candidate[key], depth + 1);
      if (Array.isArray(list)) {
        return list;
      }
    }
  }

  return null;
}

export function parseStoredTasks(serialized) {
  if (typeof serialized !== "string" || !serialized.trim()) {
    return { ...EMPTY_RESULT };
  }

  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    return { ...EMPTY_RESULT, error };
  }

  const candidateList = extractCandidateList(parsed);

  if (!Array.isArray(candidateList)) {
    return { ...EMPTY_RESULT };
  }

  const tasks = [];
  let discarded = 0;

  candidateList.forEach(entry => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      tasks.push({ ...entry });
    } else if (entry !== null && entry !== undefined) {
      discarded += 1;
    } else if (entry === null) {
      discarded += 1;
    }
  });

  return { tasks, discarded, error: null };
}

if (typeof window !== "undefined") {
  window.TaskerStorage = Object.assign(window.TaskerStorage || {}, {
    parseStoredTasks,
  });
}

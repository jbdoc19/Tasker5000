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

function normalizeTaskEntries(candidateList) {
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

  return { tasks, discarded };
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

  const { tasks, discarded } = normalizeTaskEntries(candidateList);

  return { tasks, discarded, error: null };
}

export function attemptLegacyRestore(serialized) {
  if (typeof serialized !== "string" || !serialized.trim()) {
    return { tasks: [], format: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    return { tasks: [], format: null };
  }

  if (Array.isArray(parsed)) {
    return { tasks: parsed.slice(), format: "array" };
  }

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)) {
    return { tasks: parsed.tasks.slice(), format: "tasks-property" };
  }

  return { tasks: [], format: null };
}

function summarizeLocalStorageKeys() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const summaries = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (!/task/i.test(key)) continue;
      const value = window.localStorage.getItem(key) ?? "";
      summaries.push({
        key,
        length: value.length,
        preview: value.slice(0, 120),
      });
    }
  } catch (error) {
    summaries.push({ key: "<error>", length: 0, preview: "", error: error?.message || String(error) });
  }
  return summaries;
}

export function collectTaskDiagnostics(options = {}) {
  const source = Object.prototype.hasOwnProperty.call(options, "raw")
    ? options.raw
    : (() => {
        if (typeof window === "undefined" || !window.localStorage) return null;
        try {
          return window.localStorage.getItem("tasks");
        } catch (error) {
          return { error };
        }
      })();

  if (source && typeof source === "object" && source.error) {
    return {
      timestamp: new Date().toISOString(),
      rawPresent: false,
      rawLength: 0,
      parser: { tasks: 0, discarded: 0, error: source.error?.message || String(source.error) },
      legacy: { tasks: 0, format: null },
      candidateKeys: summarizeLocalStorageKeys(),
    };
  }

  const raw = typeof source === "string" ? source : "";
  const parserResult = parseStoredTasks(raw);
  const legacyResult = attemptLegacyRestore(raw);

  const diagnostics = {
    timestamp: new Date().toISOString(),
    rawPresent: Boolean(raw),
    rawLength: raw.length,
    parser: {
      tasks: parserResult.tasks.length,
      discarded: parserResult.discarded,
      error: parserResult.error ? parserResult.error.message || String(parserResult.error) : null,
    },
    legacy: {
      tasks: legacyResult.tasks.length,
      format: legacyResult.format,
    },
    candidateKeys: summarizeLocalStorageKeys(),
    sample: raw.slice(0, 3600),
  };

  if (typeof window !== "undefined") {
    window.TaskerStorage = Object.assign(window.TaskerStorage || {}, {
      lastDiagnostics: diagnostics,
    });
  }

  return diagnostics;
}

export function downloadTaskBackup(serialized, filename = "tasker-tasks-backup.json") {
  if (typeof document === "undefined") {
    return false;
  }

  const raw = typeof serialized === "string"
    ? serialized
    : (() => {
        if (typeof window === "undefined") {
          console.warn("Window is not available; unable to access localStorage for backup.");
          return "";
        }
        try {
          return window.localStorage?.getItem("tasks") ?? "";
        } catch (error) {
          console.warn("Unable to read tasks from localStorage for backup.", error);
          return "";
        }
      })();

  try {
    const blob = new Blob([raw || ""], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.warn("Unable to create task backup download.", error);
    return false;
  }
}

if (typeof window !== "undefined") {
  window.TaskerStorage = Object.assign(window.TaskerStorage || {}, {
    parseStoredTasks,
    attemptLegacyRestore,
    collectTaskDiagnostics,
    downloadTaskBackup,
  });
}

const TASKS_STORAGE_KEY = "tasks";
const QUICK_TASK_LABEL = "quick task";

function sanitizeTaskEntries(entries) {
  if (!Array.isArray(entries)) {
    return { tasks: [], discarded: 0 };
  }

  const tasks = [];
  let discarded = 0;

  entries.forEach(entry => {
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
  if (typeof serialized !== "string" || !serialized) {
    return { tasks: [], quickTasks: [], discarded: 0, quickDiscarded: 0, error: null };
  }

  try {
    const parsed = JSON.parse(serialized);
    const isPlainObject = parsed && typeof parsed === "object" && !Array.isArray(parsed);

    const taskEntries = Array.isArray(parsed)
      ? parsed
      : (isPlainObject && Array.isArray(parsed.allTasks)
        ? parsed.allTasks
        : (isPlainObject && Array.isArray(parsed.tasks)
          ? parsed.tasks
          : []));

    const quickEntries = isPlainObject && Array.isArray(parsed.quickTasks)
      ? parsed.quickTasks
      : [];

    const { tasks, discarded } = sanitizeTaskEntries(taskEntries);
    const { tasks: quickTasks, discarded: quickDiscarded } = sanitizeTaskEntries(quickEntries);

    return { tasks, quickTasks, discarded, quickDiscarded, error: null };
  } catch (error) {
    return { tasks: [], quickTasks: [], discarded: 0, quickDiscarded: 0, error };
  }
}

function isQuickTaskEntry(task) {
  if (!task) {
    return false;
  }
  const category = typeof task.category === "string" ? task.category.toLowerCase() : "";
  return category === QUICK_TASK_LABEL;
}

export function buildTaskStoragePayload(taskList = []) {
  const allTasks = Array.isArray(taskList)
    ? taskList.map(task => ({ ...task }))
    : [];
  const quickTasks = allTasks.filter(isQuickTaskEntry);
  return { allTasks, quickTasks };
}

function resolveStorage(candidate) {
  if (candidate && typeof candidate.getItem === "function" && typeof candidate.setItem === "function") {
    return candidate;
  }
  if (typeof localStorage !== "undefined" && localStorage && typeof localStorage.getItem === "function") {
    return localStorage;
  }
  return null;
}

export function saveTasksToStorage(taskList = [], storage) {
  const target = resolveStorage(storage);
  if (!target) {
    return { success: false, payload: null, error: null, storageAvailable: false };
  }
  try {
    const payload = buildTaskStoragePayload(taskList);
    target.setItem(TASKS_STORAGE_KEY, JSON.stringify(payload));
    return { success: true, payload, error: null, storageAvailable: true };
  } catch (error) {
    return { success: false, payload: null, error, storageAvailable: true };
  }
}

export function loadStoredTasks(storage) {
  const target = resolveStorage(storage);
  if (!target) {
    return {
      raw: null,
      tasks: [],
      quickTasks: [],
      discarded: 0,
      quickDiscarded: 0,
      error: null,
      storageAvailable: false,
    };
  }

  let raw = null;
  try {
    raw = target.getItem(TASKS_STORAGE_KEY);
  } catch (error) {
    return {
      raw: null,
      tasks: [],
      quickTasks: [],
      discarded: 0,
      quickDiscarded: 0,
      error,
      storageAvailable: true,
    };
  }

  if (typeof raw !== "string" || !raw) {
    return {
      raw: raw ?? null,
      tasks: [],
      quickTasks: [],
      discarded: 0,
      quickDiscarded: 0,
      error: null,
      storageAvailable: true,
    };
  }

  const parsed = parseStoredTasks(raw);
  return {
    raw,
    ...parsed,
    storageAvailable: true,
  };
}

export function getStoredTasksSnapshot() {
  const snapshot = loadStoredTasks();
  const { raw, tasks, quickTasks, discarded, quickDiscarded, error } = snapshot;
  return { raw, tasks, quickTasks, discarded, quickDiscarded, error };
}

export function collectTaskDiagnostics() {
  const snapshot = getStoredTasksSnapshot();
  const { raw, tasks, quickTasks, discarded, quickDiscarded, error } = snapshot;
  const total = Array.isArray(tasks) ? tasks.length : 0;
  return {
    raw,
    total,
    discarded,
    quickTotal: Array.isArray(quickTasks) ? quickTasks.length : 0,
    quickDiscarded,
    error,
    sample: total ? tasks.slice(0, Math.min(total, 3)) : [],
    quickSample: Array.isArray(quickTasks) && quickTasks.length
      ? quickTasks.slice(0, Math.min(quickTasks.length, 3))
      : [],
  };
}

export function downloadTaskBackup(payload = null) {
  let raw = null;
  if (payload && typeof payload === "object") {
    try {
      raw = JSON.stringify(payload, null, 2);
    } catch (error) {
      console.warn("Unable to serialize provided task backup payload", error);
      raw = null;
    }
  } else {
    raw = typeof payload === "string" && payload ? payload : getRawTaskPayload();
  }

  if (typeof raw !== "string" || !raw) {
    return false;
  }
  if (typeof document === "undefined") {
    return false;
  }
  try {
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    anchor.download = `task-backup-${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.warn("Unable to create task backup", error);
    return false;
  }
}

function getRawTaskPayload() {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem(TASKS_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to read stored tasks", error);
    return null;
  }
}

if (typeof window !== "undefined") {
  window.TaskerStorage = Object.assign(window.TaskerStorage || {}, {
    parseStoredTasks,
    buildTaskStoragePayload,
    saveTasksToStorage,
    loadStoredTasks,
    getStoredTasksSnapshot,
    collectTaskDiagnostics,
    downloadTaskBackup,
  });
}

const TASKS_STORAGE_KEY = "tasks";

export function parseStoredTasks(serialized) {
  if (typeof serialized !== "string" || !serialized) {
    return { tasks: [], discarded: 0, error: null };
  }

  try {
    const parsed = JSON.parse(serialized);
    const candidateList = Array.isArray(parsed)
      ? parsed
      : (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.tasks)
        ? parsed.tasks
        : []);

    if (!Array.isArray(candidateList)) {
      return { tasks: [], discarded: 0, error: null };
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
  } catch (error) {
    return { tasks: [], discarded: 0, error };
  }
}

export function getStoredTasksSnapshot() {
  const raw = getRawTaskPayload();
  if (typeof raw !== "string" || !raw) {
    return { raw: raw ?? null, tasks: [], discarded: 0, error: null };
  }
  const result = parseStoredTasks(raw);
  return { raw, ...result };
}

export function collectTaskDiagnostics() {
  const snapshot = getStoredTasksSnapshot();
  const { raw, tasks, discarded, error } = snapshot;
  const total = Array.isArray(tasks) ? tasks.length : 0;
  return {
    raw,
    total,
    discarded,
    error,
    sample: total ? tasks.slice(0, Math.min(total, 3)) : [],
  };
}

export function downloadTaskBackup(payload = null) {
  const raw = typeof payload === "string" && payload ? payload : getRawTaskPayload();
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
    anchor.download = "tasker-tasks-backup.json";
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
    getStoredTasksSnapshot,
    collectTaskDiagnostics,
    downloadTaskBackup,
  });
}

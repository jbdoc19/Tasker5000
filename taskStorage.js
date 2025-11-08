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

if (typeof window !== "undefined") {
  window.TaskerStorage = Object.assign(window.TaskerStorage || {}, {
    parseStoredTasks,
  });
}

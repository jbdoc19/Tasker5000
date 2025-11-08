// recover-tasks.js
(function () {
  const infoBox = document.createElement('div');
  infoBox.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;max-height:50vh;
    overflow:auto;background:#0d1117;color:#eee;
    border-top:2px solid #2dd4bf;padding:1rem;
    font-family:monospace;font-size:0.9rem;z-index:9999;
  `;
  infoBox.innerHTML = `<strong>Task Recovery Console</strong><br>`;

  function log(msg) {
    infoBox.innerHTML += msg + '<br>';
  }

  document.body.appendChild(infoBox);

  try {
    const raw = localStorage.getItem("tasks");
    if (!raw) {
      log("❌ No 'tasks' key found in localStorage.");
      return;
    }
    log("✅ Found 'tasks' key.");
    log("Raw length: " + raw.length + " characters");

    // Try to parse
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      log("⚠️ JSON parse failed: " + e.message);
      return;
    }

    const tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];
    log("Detected tasks count: " + tasks.length);

    if (tasks.length > 0) {
      log("First task preview:");
      const sample = JSON.stringify(tasks[0], null, 2);
      log(`<pre>${sample}</pre>`);

      // Offer download
      const btn = document.createElement('button');
      btn.textContent = "Download Backup (JSON)";
      btn.style.cssText = "margin-top:0.5rem;padding:0.4rem 0.8rem;";
      btn.onclick = () => {
        const blob = new Blob([raw], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "tasker-tasks-backup.json";
        a.click();
        URL.revokeObjectURL(url);
      };
      infoBox.appendChild(btn);
    } else {
      log("No tasks found inside the saved data.");
    }

    const allKeys = Object.keys(localStorage);
    log("Other localStorage keys: " + allKeys.join(", "));

  } catch (err) {
    log("Unexpected error: " + err.message);
  }
})();


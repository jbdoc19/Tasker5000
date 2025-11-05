(function () {
    const root = document.querySelector('.focus-command-deck');
    if (!root) return;

    const fill = root.querySelector('.cm-fill');
    const doneEl = root.querySelector('.cm-done');
    const totalEl = root.querySelector('.cm-total');
    const floatEl = root.querySelector('.cm-float');

    function zone(pct) {
      if (pct >= 1) return 'high';
      if (pct >= 0.3) return 'mid';
      return 'low';
    }

    function setFill(pct) {
      const z = zone(pct);
      fill.dataset.zone = z;
      fill.style.width = (pct * 100).toFixed(0) + '%';
    }

    window.updateChartProgress = function (completed, total) {
      const prev = parseFloat((fill.style.width || '0').replace('%', '')) / 100 || 0;
      const pct = total > 0 ? completed / total : 0;

      doneEl.textContent = completed;
      totalEl.textContent = total;
      setFill(pct);

      floatEl.textContent = Math.round(pct * 100) + '% complete';
      floatEl.style.opacity = '1';
      floatEl.style.transform = 'translateY(-4px)';

      setTimeout(() => {
        floatEl.style.opacity = '0';
        floatEl.style.transform = 'translateY(-10px)';
      }, 700);

      if (pct > prev || pct >= 1) {
        fill.classList.remove('pulse');
        void fill.offsetWidth; // force reflow
        fill.classList.add('pulse');
      }
    };

    // Optional: initialize from any existing DOM values
    const initDone = parseInt(doneEl.textContent, 10) || 0;
    const initTotal = parseInt(totalEl.textContent, 10) || 0;
    setFill(initTotal ? initDone / initTotal : 0);
  })();

  document.addEventListener("DOMContentLoaded", () => {
    // Debugging script for the 2x2 recovery routines grid layout
    const container = document.querySelector(".recovery-routines-container");
    if (!container) {
      console.error("Error: Rounded container for recovery routines is missing.");
      return;
    }

    console.log("Recovery routines container found:", container);

    const containerStyles = getComputedStyle(container);
    if (containerStyles.display !== "grid") {
      console.error(
        "Error: Container is not using grid layout. Current display property:",
        containerStyles.display
      );
    } else {
      console.log("Container is using grid layout.");
    }

    const modules = container.querySelectorAll(".routine-tile");
    if (modules.length !== 4) {
      console.error(`Error: Expected 4 routine modules, found ${modules.length}.`);
    } else {
      console.info("Routine modules found:", modules);
      const expectedTitles = ["🌅 AM Start", "🚀 Launch Pad", "😴 Sleep Toolkit", "🎵 Dopa-Me"];

      modules.forEach((module, index) => {
        const titleElement = module.querySelector(".routine-tile__title");
        const title = titleElement ? titleElement.textContent.trim() : null;

        if (title !== expectedTitles[index]) {
          console.error(
            `Error: Routine ${index + 1} has incorrect title. Expected: "${expectedTitles[index]}", Found: "${title}".`
          );
        } else {
          console.info(`Routine ${index + 1} title is correct: "${title}".`);
        }
      });
    }

    const outline = containerStyles.border || containerStyles.boxShadow;
    if (!outline || outline === "none") {
      console.error("Error: No outline is applied to the container.");
    } else {
      console.log("Outline applied to the container:", outline);
    }
  });

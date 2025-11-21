# Repository Audit — Tasker 5000

## Critical issues

- Morning Launch experience never renders because no element with `data-morning-launch` (or child selectors `data-ml-*`) exists in `index.html`, so `DOMContentLoaded` logic in `morningLaunch.js` returns early and the checklist UI is missing. Fix: add the Morning Launch card markup with matching `data-morning-launch`, `data-ml-toggle`, `data-ml-panel`, `data-ml-list`, and `data-ml-progress` hooks.
- Feature modules for morning launch and other interactions are not loaded anywhere. `index.html` only imports `taskStorage.js`, `scheduleCard.js`, and `scheduleBridge.js`; `morningLaunch.js` is never executed, leaving its event handlers and initialization unused. Fix: register `<script type="module" src="./morningLaunch.js"></script>` (and any other required modules) near the existing module imports.

## File-by-file findings

### index.html
- [Critical] Missing Morning Launch container: no element defines `data-morning-launch` or supporting `data-ml-*` hooks, so the checklist block referenced in `morningLaunch.js` never mounts. → Fix: add the Morning Launch card structure with the expected data attributes.
- [Critical] Module imports incomplete: head/footer only load `taskStorage.js`, `scheduleCard.js`, and `scheduleBridge.js`, omitting `morningLaunch.js`. Result: Morning Launch initialization never runs and associated buttons remain inert. → Fix: add a `<script type="module" src="./morningLaunch.js"></script>` tag alongside the other module imports.

### morningLaunch.js
- [Critical] Initialization requires a `[data-morning-launch]` root and child hooks (`[data-ml-toggle]`, `[data-ml-panel]`, `[data-ml-list]`, `[data-ml-progress]`); if any are missing the handler aborts. With the markup absent in `index.html`, the UI and its event handlers (toggle, progress updates, checkbox change listener) never activate. → Fix: supply matching DOM nodes and ensure the module is imported so `DOMContentLoaded` can bind listeners.

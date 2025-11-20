const ORDER_PARALLEL = ['Results', 'Calls', 'Charts', 'Advice'];
const MIN_PARALLEL_SLICE = 20;
const MAX_PARALLEL_SLICE = 40;
const MIN_PARALLEL_WINDOW = 12;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function toMinutes(time) {
  if (typeof time !== 'string') return NaN;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function toTime(minutes) {
  const safe = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(safe / 60) % 24;
  const mins = safe % 60;
  return `${pad(hrs)}:${pad(mins)}`;
}

function clampMinutes(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return number;
}

function deriveParallelMinutes(source) {
  if (source == null) return 0;
  if (typeof source === 'number') return Math.max(source, 0);
  if (typeof source === 'object') {
    const count = clampMinutes(source.count, 0);
    const minutesPerItem = clampMinutes(source.minutesPerItem, 5);
    if (count > 0 && minutesPerItem > 0) {
      return count * minutesPerItem;
    }
    return clampMinutes(source.minutes, 0);
  }
  return 0;
}

function normaliseGeneralTasks(tasks) {
  const queue = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task?.quickWin) continue;
    const total = clampMinutes(task?.minutes ?? task?.duration, 30);
    queue.push({
      title: task?.name || 'Focused Work',
      remaining: total,
      slice: clampMinutes(task?.slice, Math.min(total, 45)),
      yield: clampMinutes(task?.yield, 2),
      kind: task?.kind || 'Task',
      meta: Array.isArray(task?.meta) ? [...task.meta] : [],
      source: task?.source || 'tasks',
    });
  }
  return queue;
}

function normaliseQuickWins(tasks) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter(task => task?.quickWin)
    .sort((a, b) => clampMinutes(a?.minutes, 15) - clampMinutes(b?.minutes, 15))
    .map(task => ({
      title: task?.name || 'Quick Win',
      minutes: Math.min(clampMinutes(task?.minutes, 15), 15),
    }));
}

export function clusterTasks(tasks, basket) {
  const generalQueue = normaliseGeneralTasks(tasks);
  const quickWins = normaliseQuickWins(tasks);
  const parallelQueue = new Map();
  for (const kind of ORDER_PARALLEL) {
    const minutes = deriveParallelMinutes(basket?.[kind]);
    if (minutes > 0) {
      parallelQueue.set(kind, minutes);
    }
  }
  return { generalQueue, quickWins, parallelQueue };
}

function computeSegmentMeta(windows) {
  const meta = new Map();
  for (const win of Array.isArray(windows) ? windows : []) {
    if (!win?.block || !win.start || !win.end) continue;
    const start = toMinutes(win.start);
    const end = toMinutes(win.end);
    if (!meta.has(win.block)) {
      meta.set(win.block, { start, end });
    } else {
      const entry = meta.get(win.block);
      entry.start = Math.min(entry.start, start);
      entry.end = Math.max(entry.end, end);
    }
  }
  return meta;
}

function nextOrder(counter) {
  counter.value += 1;
  return counter.value;
}

function enqueueQuickWin(blocks, quickWins, segment, meta, counter) {
  if (!quickWins.length || !meta.has(segment)) return;
  const { start } = meta.get(segment);
  const { title, minutes } = quickWins.shift();
  blocks.push({
    title: `Quick Win — ${title}`,
    minutes,
    kind: 'QuickWin',
    segment,
    yield: 6,
    meta: ['≤15m'],
    source: 'quickWin',
    startMinutes: start,
    endMinutes: start + minutes,
    order: nextOrder(counter),
  });
}

function scheduleBlock(collection, block) {
  collection.push({
    ...block,
    start: toTime(block.startMinutes),
    end: toTime(block.endMinutes),
  });
}

function fillGeneralWindow(out, window, capacity, queue, counter) {
  const windowStart = toMinutes(window.start);
  const windowEnd = toMinutes(window.end);
  const duration = Math.max(windowEnd - windowStart, 0);
  const maxCap = Math.min(Math.floor(duration * capacity.multiplier), duration);
  let remaining = maxCap;
  let cursor = windowStart;
  while (remaining > 0 && queue.length) {
    const cluster = queue[0];
    const slice = Math.min(cluster.slice || 45, cluster.remaining, remaining);
    if (slice < 5) break;
    const block = {
      title: cluster.title,
      minutes: slice,
      kind: cluster.kind,
      yield: cluster.yield,
      meta: [...cluster.meta],
      source: cluster.source,
      segment: window.block,
      startMinutes: cursor,
      endMinutes: cursor + slice,
      order: nextOrder(counter),
    };
    scheduleBlock(out, block);
    cluster.remaining -= slice;
    remaining -= slice;
    cursor += slice;
    if (cluster.remaining <= 0) {
      queue.shift();
    }
  }
}

function anyParallelMinutes(queue) {
  for (const minutes of queue.values()) {
    if (minutes >= MIN_PARALLEL_SLICE) return true;
  }
  return false;
}

function takeParallelMinutes(queue, kind, slice) {
  const minutes = queue.get(kind) || 0;
  if (minutes <= 0) return 0;
  const take = Math.min(slice, minutes);
  queue.set(kind, minutes - take);
  if (queue.get(kind) <= 0) {
    queue.delete(kind);
  }
  return take;
}

function fillParallelWindow(out, window, capacity, queue, counter) {
  const windowStart = toMinutes(window.start);
  const windowEnd = toMinutes(window.end);
  const duration = Math.max(windowEnd - windowStart, 0);
  if (duration < MIN_PARALLEL_WINDOW) return;
  const maxCap = Math.min(Math.floor(duration * capacity.multiplier), duration);
  let remaining = maxCap;
  let cursor = windowStart;
  while (remaining >= MIN_PARALLEL_SLICE && queue.size && anyParallelMinutes(queue)) {
    let consumedInCycle = false;
    for (const kind of ORDER_PARALLEL) {
      if (remaining < MIN_PARALLEL_SLICE) break;
      const slice = Math.min(MAX_PARALLEL_SLICE, remaining);
      const take = takeParallelMinutes(queue, kind, slice);
      if (take < MIN_PARALLEL_SLICE) continue;
      const block = {
        title: `${kind} Sweep`,
        minutes: take,
        kind: 'Parallel',
        yield: kind === 'Charts' ? 5 : kind === 'Results' ? 4 : kind === 'Calls' ? 3 : 2,
        meta: ['parallel'],
        source: kind,
        segment: window.block,
        startMinutes: cursor,
        endMinutes: cursor + take,
        order: nextOrder(counter),
      };
      scheduleBlock(out, block);
      cursor += take;
      remaining -= take;
      consumedInCycle = true;
      if (!queue.size) break;
    }
    if (!consumedInCycle) break;
  }
}

function addSupervisionBlock(out, window, counter) {
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  scheduleBlock(out, {
    title: 'Resident Presentations + Sign-offs',
    minutes: Math.max(end - start, 0),
    kind: 'Supervision',
    yield: 5,
    meta: ['clinic'],
    source: 'Chart Completion',
    segment: window.block,
    startMinutes: start,
    endMinutes: end,
    order: nextOrder(counter),
  });
}

function ensureSignOffs(blocks, segmentMeta, counter) {
  if (!segmentMeta.has('PM')) return;
  const hasSignOff = blocks.some(block => /sign[-\s]?off/i.test(block.title || ''));
  if (hasSignOff) return;
  const { end } = segmentMeta.get('PM');
  const start = Math.max(end - 15, 0);
  scheduleBlock(blocks, {
    title: 'Clinic Sign-offs',
    minutes: 15,
    kind: 'SignOff',
    yield: 4,
    meta: ['clinic'],
    source: 'auto',
    segment: 'PM',
    startMinutes: start,
    endMinutes: end,
    order: nextOrder(counter),
  });
}

function ensureWindDown(blocks, segmentMeta, counter) {
  if (!segmentMeta.has('PM')) return;
  const hasWindDown = blocks.some(block => block.segment === 'PM' && /wind[-\s]?down/i.test(block.title));
  if (hasWindDown) return;
  const { end } = segmentMeta.get('PM');
  const start = Math.max(end - 15, 0);
  scheduleBlock(blocks, {
    title: 'Wind-down',
    minutes: 15,
    kind: 'WindDown',
    yield: 2,
    meta: ['transition'],
    source: 'auto',
    segment: 'PM',
    startMinutes: start,
    endMinutes: end,
    order: nextOrder(counter),
  });
}

export function buildFromWindows(out, wins, queues, quota, counter) {
  for (const window of Array.isArray(wins) ? wins : []) {
    if (!window?.start || !window.end) continue;
    const capacity = { multiplier: quota ?? 0 };
    if (window.type === 'Clinical-Supervision') {
      addSupervisionBlock(out, window, counter);
    } else if (window.type === 'Clinical-Parallel') {
      fillParallelWindow(out, window, capacity, queues.parallelQueue, counter);
    } else if (window.type === 'Admin' || window.type === 'Focus' || window.type == null) {
      fillGeneralWindow(out, window, capacity, queues.generalQueue, counter);
    }
  }
}

function findLowestYield(blocks, segment) {
  let lowest = null;
  for (const block of blocks) {
    if (block.segment !== segment || block.kind === 'QuickWin' || block.kind === 'CarryoverLog') continue;
    if (!lowest || block.yield < lowest.yield) {
      lowest = block;
    }
  }
  return lowest;
}

function applyCarryover(blocks, removed, segment) {
  if (!removed) return;
  blocks.push({
    kind: 'CarryoverLog',
    title: `Carryover — ${removed.title}`,
    minutes: 0,
    segment,
    meta: ['carryover'],
    yield: removed.yield ?? 0,
    source: removed.source,
    start: toTime(removed.endMinutes || 0),
    end: toTime(removed.endMinutes || 0),
  });
}

function slideSegment(blocks, segment, meta) {
  if (!meta.has(segment)) return;
  const { start, end } = meta.get(segment);
  const entries = blocks
    .filter(block => block.segment === segment && block.kind !== 'CarryoverLog')
    .sort((a, b) => a.order - b.order);

  let cursor = start;
  for (const block of entries) {
    block.startMinutes = Math.max(block.startMinutes ?? cursor, cursor);
    block.endMinutes = block.startMinutes + block.minutes;
    if (block.endMinutes < block.startMinutes) {
      block.endMinutes = block.startMinutes;
      block.minutes = 0;
    }
    cursor = block.endMinutes;
  }

  while (entries.length && entries[entries.length - 1].endMinutes > end) {
    const last = entries[entries.length - 1];
    const overflow = last.endMinutes - end;
    if (last.minutes - overflow >= 10) {
      last.minutes -= overflow;
      last.endMinutes = end;
      last.meta = Array.isArray(last.meta) ? [...last.meta, 'shortened'] : ['shortened'];
    } else {
      const removed = findLowestYield(entries, segment);
      if (!removed) break;
      const idx = entries.indexOf(removed);
      if (idx !== -1) {
        entries.splice(idx, 1);
      }
      const globalIndex = blocks.indexOf(removed);
      if (globalIndex !== -1) {
        blocks.splice(globalIndex, 1);
      }
      applyCarryover(blocks, removed, segment);
      cursor = entries.length ? entries[entries.length - 1].endMinutes : start;
    }
  }

  for (const block of entries) {
    block.start = toTime(block.startMinutes);
    block.end = toTime(block.endMinutes);
  }
}

export function autoSlide(blocks, segmentMeta) {
  for (const segment of segmentMeta.keys()) {
    slideSegment(blocks, segment, segmentMeta);
  }
}

function compressPM(blocks, segmentMeta, userEndTime) {
  if (!userEndTime || !segmentMeta.has('PM')) return;
  const pmLimit = Math.min(segmentMeta.get('PM').end, toMinutes(userEndTime));
  const pmStart = segmentMeta.get('PM').start;
  if (pmLimit <= pmStart) return;

  const pmBlocks = blocks.filter(block => block.segment === 'PM' && block.kind !== 'CarryoverLog');
  if (!pmBlocks.length) return;

  const quickWin = pmBlocks.find(block => block.kind === 'QuickWin');
  const chartMinutes = pmBlocks
    .filter(block => /chart/i.test(block.title))
    .reduce((total, block) => total + block.minutes, 0);
  const resultsMinutes = pmBlocks
    .filter(block => /result/i.test(block.title))
    .reduce((total, block) => total + block.minutes, 0);
  const callMinutes = pmBlocks
    .filter(block => /call/i.test(block.title))
    .reduce((total, block) => total + block.minutes, 0);

  const keepers = [];
  const dropped = new Set();
  const markDropped = block => dropped.add(block);

  for (const block of pmBlocks) {
    if (block.kind === 'QuickWin') continue;
    if (/chart/i.test(block.title)) continue;
    if (/result/i.test(block.title)) continue;
    if (/call/i.test(block.title)) continue;
    if (/wind[-\s]?down/i.test(block.title)) continue;
    if (/sign[-\s]?off/i.test(block.title)) continue;
    markDropped(block.title);
  }

  const timeline = [];
  let cursor = pmStart;

  if (quickWin) {
    timeline.push({ ...quickWin });
    cursor = quickWin.endMinutes;
  }

  if (chartMinutes > 0) {
    const minutes = Math.min(chartMinutes, Math.max(pmLimit - cursor - 45, 30));
    timeline.push({
      title: 'Chart Sprint',
      minutes,
      kind: 'Task',
      yield: 5,
      meta: ['charts'],
      source: 'tasks',
      segment: 'PM',
      startMinutes: cursor,
      endMinutes: cursor + minutes,
      order: quickWin ? quickWin.order + 1 : 1,
    });
    cursor += minutes;
  }

  if (resultsMinutes > 0 && cursor < pmLimit - 30) {
    const minutes = Math.min(resultsMinutes, 30, pmLimit - cursor - 30);
    timeline.push({
      title: 'Results Sweep',
      minutes,
      kind: 'Parallel',
      yield: 4,
      meta: ['parallel'],
      source: 'Results',
      segment: 'PM',
      startMinutes: cursor,
      endMinutes: cursor + minutes,
      order: (timeline.at(-1)?.order ?? 1) + 1,
    });
    cursor += minutes;
  }

  if (callMinutes > 0 && cursor < pmLimit - 25) {
    const minutes = Math.min(callMinutes, 25, pmLimit - cursor - 25);
    timeline.push({
      title: 'Calls Burst',
      minutes,
      kind: 'Parallel',
      yield: 3,
      meta: ['parallel'],
      source: 'Calls',
      segment: 'PM',
      startMinutes: cursor,
      endMinutes: cursor + minutes,
      order: (timeline.at(-1)?.order ?? 1) + 1,
    });
    cursor += minutes;
  }

  const remaining = Math.max(pmLimit - cursor, 15);
  timeline.push({
    title: 'Wind-down',
    minutes: Math.min(remaining, 15),
    kind: 'WindDown',
    yield: 2,
    meta: ['transition'],
    source: 'auto',
    segment: 'PM',
    startMinutes: Math.max(pmLimit - Math.min(remaining, 15), cursor),
    endMinutes: pmLimit,
    order: (timeline.at(-1)?.order ?? 1) + 1,
  });

  const preserved = new Set(timeline.map(block => block.title));
  for (const block of pmBlocks) {
    if (block.kind === 'QuickWin') continue;
    if (preserved.has(block.title)) continue;
    markDropped(block.title);
  }

  const remainingBlocks = blocks.filter(block => block.segment !== 'PM' || block.kind === 'CarryoverLog');
  if (quickWin) {
    timeline.unshift(quickWin);
  }
  for (const block of timeline) {
    scheduleBlock(remainingBlocks, block);
  }

  blocks.splice(0, blocks.length, ...remainingBlocks);

  for (const title of dropped) {
    applyCarryover(blocks, { title, yield: 1, endMinutes: pmLimit, source: 'tasks' }, 'PM');
  }
}

export function finalizeLabels(blocks) {
  return blocks.map(block => ({
    ...block,
    label: block.title || block.kind || 'Block',
    why: block.source || 'adaptive',
  }));
}

export function generateAdaptiveItinerary(ctx, opts = {}) {
  const { windows = [], quotas = {}, tasks = [], basket = {}, clinicType, userEndTime, sessionState = {} } = ctx || {};
  const mentalEnergyScore = typeof sessionState.mentalEnergyScore === 'number'
    ? sessionState.mentalEnergyScore
    : null;
  const capacityBias = mentalEnergyScore != null
    ? Math.max(0.6, Math.min(1.15, 0.85 + mentalEnergyScore * 0.35))
    : 1;
  const resolveQuota = (value, fallback) => {
    const base = Number.isFinite(value) ? value : fallback;
    const adjusted = base * capacityBias;
    return Math.max(0.1, Math.min(1, adjusted));
  };
  const resolvedQuotas = {
    AM: resolveQuota(quotas.AM, 0.4),
    PM: resolveQuota(quotas.PM, 0.8),
  };
  const segmentMeta = computeSegmentMeta(windows);
  const queues = clusterTasks(tasks, basket);
  const counter = { value: 0 };
  const blocks = [];

  const amWindows = windows.filter(window => window?.block === 'AM');
  if (amWindows.length) {
    enqueueQuickWin(blocks, queues.quickWins, 'AM', segmentMeta, counter);
    buildFromWindows(blocks, amWindows, queues, resolvedQuotas.AM, counter);
  }

  const pmWindows = windows.filter(window => window?.block === 'PM');
  if (pmWindows.length) {
    enqueueQuickWin(blocks, queues.quickWins, 'PM', segmentMeta, counter);
    buildFromWindows(blocks, pmWindows, queues, resolvedQuotas.PM, counter);
  }

  if (clinicType === 'clinic') {
    ensureSignOffs(blocks, segmentMeta, counter);
  }
  ensureWindDown(blocks, segmentMeta, counter);

  autoSlide(blocks, segmentMeta);
  compressPM(blocks, segmentMeta, userEndTime);

  return finalizeLabels(blocks);
}

export default generateAdaptiveItinerary;

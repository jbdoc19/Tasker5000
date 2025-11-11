import assert from 'node:assert/strict';
import test from 'node:test';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }
}

class MockClassList {
  constructor(element) {
    this.element = element;
    this._classes = new Set();
  }

  _sync() {
    this.element._className = this.toString();
  }

  toString() {
    return [...this._classes].join(' ');
  }

  set(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
    this._sync();
  }

  add(...classes) {
    classes.forEach(cls => this._classes.add(cls));
    this._sync();
  }

  remove(...classes) {
    classes.forEach(cls => this._classes.delete(cls));
    this._sync();
  }

  toggle(cls, force) {
    if (force === true) {
      this.add(cls);
      return true;
    }
    if (force === false) {
      this.remove(cls);
      return false;
    }
    if (this._classes.has(cls)) {
      this._classes.delete(cls);
      this._sync();
      return false;
    }
    this._classes.add(cls);
    this._sync();
    return true;
  }

  contains(cls) {
    return this._classes.has(cls);
  }
}

class MockElement {
  constructor(tagName, id = null) {
    this.tagName = tagName.toUpperCase();
    this.id = id || null;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.disabled = false;
    this.value = '';
    this._innerHTML = '';
    this._textContent = '';
    this._className = '';
    this.classList = new MockClassList(this);
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') {
      this.id = String(value);
    } else if (name === 'class') {
      this.className = value;
    }
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'class') {
      this.className = '';
    }
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    if (value === '') {
      this.children = [];
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set textContent(value) {
    this._textContent = String(value);
  }

  get textContent() {
    return this._textContent;
  }

  set className(value) {
    this.classList.set(value);
  }

  get className() {
    return this.classList.toString();
  }

  contains(target) {
    if (this === target) return true;
    return this.children.some(child => child.contains?.(target));
  }

  focus() {
    this.focused = true;
  }

  addEventListener() {}

  querySelector(selector) {
    const tokens = selector.trim().split(/\s+/);
    return queryDescendants(this, tokens);
  }
}

function matchesSelector(element, selector) {
  if (!element) return false;
  if (selector.startsWith('.')) {
    return element.classList.contains(selector.slice(1));
  }
  if (selector.startsWith('#')) {
    return element.id === selector.slice(1);
  }
  return element.tagName === selector.toUpperCase();
}

function queryDescendants(node, selectors) {
  if (!selectors.length) {
    return null;
  }
  const [current, ...rest] = selectors;
  for (const child of node.children) {
    if (matchesSelector(child, current)) {
      if (!rest.length) {
        return child;
      }
      const nested = queryDescendants(child, rest);
      if (nested) {
        return nested;
      }
    }
    const descendant = queryDescendants(child, selectors);
    if (descendant) {
      return descendant;
    }
  }
  return null;
}

class MockDocument {
  constructor() {
    this.nodes = new Map();
    this.body = new MockElement('body', 'body');
    this.activeElement = null;
  }

  registerElement(element) {
    if (element.id) {
      this.nodes.set(element.id, element);
    }
    return element;
  }

  getElementById(id) {
    return this.nodes.get(id) || null;
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  addEventListener() {}

  removeEventListener() {}
}

const document = new MockDocument();
const window = {
  document,
  requestAnimationFrame: callback => callback(),
  setTimeout,
  clearTimeout,
};

globalThis.document = document;
globalThis.window = window;
globalThis.localStorage = new MemoryStorage();
globalThis.alert = () => {};
globalThis.confirm = () => true;
globalThis.prompt = () => null;

globalThis.console = console;

function register(id, tag = 'div') {
  const element = new MockElement(tag, id);
  document.registerElement(element);
  return element;
}

const nameInput = register('name', 'input');
const authorType = register('authorType', 'select');
const patientType = register('patientType', 'select');
const visitType = register('visitType', 'select');
const clinicSite = register('clinicSite', 'select');
const taskCategory = register('taskCategory', 'select');
const importance = register('importance', 'select');
const urgency = register('urgency', 'select');
const novelty = register('novelty', 'select');
const interest = register('interest', 'select');
const externalPressure = register('externalPressure', 'select');
const timeToStart = register('timeToStart', 'select');
const difficulty = register('difficulty', 'select');
const useTemplateBtn = register('btn-use-template', 'button');
const templateButtons = register('templateButtons', 'div');
const templateModal = register('template-modal', 'div');
templateModal.classList.add('hidden');
const templateGrid = register('template-grid', 'div');
templateModal.appendChild(templateGrid);
const modalClose = new MockElement('button');
modalClose.classList.add('modal__close');
templateModal.appendChild(modalClose);
document.body.appendChild(templateModal);

const $ = id => document.getElementById(id);
const TEMPLATE_STORAGE_KEY = "tasker5000.templates";
const LEGACY_TEMPLATE_STORAGE_KEY = "templates";
let templates = [];
let lastFocusedBeforeTemplateModal = null;

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampScale(value, fallback = 1) {
  const base = toNumber(value, fallback);
  return Math.min(5, Math.max(1, base));
}

function normalizePatientType(value) {
  const normalized = (value || '').toString().toLowerCase();
  return normalized === 'complex' ? 'Complex' : 'Non-Complex';
}

function normalizeVisitType(value) {
  const normalized = (value || '').toString().toLowerCase();
  if (normalized === 'establish' || normalized === 'establish care') return 'Establish Care';
  if (normalized === 'well-child' || normalized === 'well child visit') return 'Well Child Visit';
  if (normalized === 'acute' || normalized === 'acute visit') return 'Acute Visit';
  return 'Follow-Up';
}

function normalizeClinicSite(value) {
  const normalized = (value || '').toString().toLowerCase().replace(/[’]/g, "'").trim();
  if (normalized.includes('cranio')) return 'Craniofacial Clinic';
  if (normalized.includes('pj')) return "St PJ’s Shelter";
  if (normalized.includes('general')) return 'General Clinic';
  return 'General Clinic';
}

function normalizeStoredTemplate(template) {
  if (!template || typeof template !== 'object') {
    return null;
  }
  const name = typeof template.name === 'string' ? template.name.trim() : '';
  if (!name) {
    return null;
  }
  const category = typeof template.category === 'string' && template.category.trim()
    ? template.category
    : 'General';
  return {
    name,
    category,
    authorType: template.authorType || 'attending',
    patientType: normalizePatientType(template.patientType),
    visitType: normalizeVisitType(template.visitType),
    clinicSite: normalizeClinicSite(template.clinicSite),
    importance: clampScale(template.importance, 1),
    urgency: clampScale(template.urgency, 3),
    novelty: clampScale(template.novelty, 1),
    interest: clampScale(template.interest, 1),
    externalPressure: clampScale(template.externalPressure, 1),
    timeToStart: clampScale(template.timeToStart, 1),
    difficulty: clampScale(template.difficulty, 1),
  };
}

function readTemplatesFromStorage() {
  if (typeof localStorage === 'undefined') {
    return { templates: [], migrated: false };
  }
  const sources = [
    { key: TEMPLATE_STORAGE_KEY, migrated: false },
    { key: LEGACY_TEMPLATE_STORAGE_KEY, migrated: true },
  ];
  for (const source of sources) {
    let raw;
    try {
      raw = localStorage.getItem(source.key);
    } catch (error) {
      console.warn('Unable to read templates from storage.', error);
      return { templates: [], migrated: false };
    }
    if (raw === null) {
      continue;
    }
    if (raw === '') {
      return { templates: [], migrated: source.migrated };
    }
    if (typeof raw !== 'string') {
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        continue;
      }
      const normalized = parsed.map(normalizeStoredTemplate).filter(Boolean);
      return { templates: normalized, migrated: source.migrated };
    } catch (error) {
      console.warn('Unable to parse saved templates.', error);
    }
  }
  return { templates: [], migrated: false };
}

function persistTemplates() {
  if (typeof localStorage === 'undefined') {
    console.info('[templates] Skipping persist: localStorage unavailable.');
    return;
  }
  const payload = templates.map(normalizeStoredTemplate).filter(Boolean);
  templates.length = 0;
  payload.forEach(template => {
    templates.push({ ...template });
  });
  try {
    const serialized = JSON.stringify(payload);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, serialized);
    localStorage.setItem(LEGACY_TEMPLATE_STORAGE_KEY, serialized);
    const count = payload.length;
    console.info(`[templates] Persisted ${count} template${count === 1 ? '' : 's'} to storage.`);
  } catch (error) {
    console.warn('Unable to persist templates.', error);
  }
}

function renderTemplateCards(list) {
  const grid = $("template-grid");
  if (!grid) return;
  grid.innerHTML = '';
  if (!list || !list.length) {
    const empty = document.createElement('p');
    empty.className = 'score';
    empty.textContent = 'No templates for this category yet.';
    grid.appendChild(empty);
    return;
  }
  list.forEach(template => {
    const card = document.createElement('div');
    card.className = 'template-card';
    const title = document.createElement('strong');
    title.textContent = template.name;
    card.appendChild(title);
    const meta = document.createElement('p');
    meta.className = 'score';
    const categoryLabel = template.category || 'General';
    meta.textContent = `Category: ${categoryLabel}`;
    card.appendChild(meta);
    const stats = document.createElement('p');
    stats.className = 'score';
    stats.textContent = `Imp ${template.importance || 1} • Urg ${template.urgency || 3} • Diff ${template.difficulty || 3}`;
    card.appendChild(stats);
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'btn btn-primary';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => applyTemplate(template));
    card.appendChild(applyBtn);
    grid.appendChild(card);
  });
}

function updateTemplateModalForCategory(category) {
  const modal = $("template-modal");
  if (!modal || modal.classList.contains('hidden')) return;
  const filtered = templates.filter(t => (t.category || 'General') === category);
  renderTemplateCards(filtered);
}

function renderTemplates() {
  const container = $("templateButtons");
  const selectedCategory = $("taskCategory")?.value || 'General';
  const matchingTemplates = templates
    .map((template, index) => ({ template, index }))
    .filter(({ template }) => (template.category || 'General') === selectedCategory);

  const useTemplateBtnRef = $("btn-use-template");
  if (useTemplateBtnRef) {
    const hasTemplates = matchingTemplates.length > 0;
    useTemplateBtnRef.disabled = !hasTemplates;
    useTemplateBtnRef.setAttribute('aria-disabled', hasTemplates ? 'false' : 'true');
    useTemplateBtnRef.title = hasTemplates ? '' : 'No templates for this category yet';
  }

  updateTemplateModalForCategory(selectedCategory);

  if (!container) return;

  container.innerHTML = '';

  if (!matchingTemplates.length) {
    const empty = document.createElement('p');
    empty.className = 'score';
    empty.textContent = 'No templates for this category yet.';
    container.appendChild(empty);
    return;
  }

  matchingTemplates.forEach(({ template: t, index: templateIndex }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'template-entry';
    const useBtn = document.createElement('button');
    useBtn.textContent = `📋 ${t.name}`;
    useBtn.onclick = () => {
      applyTemplate(t);
    };
    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit template';
    editBtn.setAttribute('aria-label', 'Edit template');
    editBtn.onclick = () => {
      const newName = prompt('Edit template name:', t.name);
      if (!newName) return;
      t.name = newName;
      persistTemplates();
      renderTemplates();
    };
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete template';
    deleteBtn.setAttribute('aria-label', 'Delete template');
    deleteBtn.onclick = () => {
      if (!confirm('Delete this template?')) return;
      templates.splice(templateIndex, 1);
      persistTemplates();
      renderTemplates();
    };
    [useBtn, editBtn, deleteBtn].forEach(b => {
      b.style.marginRight = '0.3rem';
      b.style.fontSize = '0.9rem';
    });
    wrapper.appendChild(useBtn);
    wrapper.appendChild(editBtn);
    wrapper.appendChild(deleteBtn);
    container.appendChild(wrapper);
  });
}

function hydrateTemplatesFromStorage() {
  const { templates: storedTemplates, migrated } = readTemplatesFromStorage();
  templates.length = 0;
  if (Array.isArray(storedTemplates) && storedTemplates.length) {
    storedTemplates.forEach(template => {
      templates.push({ ...template });
    });
  }
  if (migrated && templates.length) {
    console.info('[templates] Migrated legacy templates to consolidated storage key.');
    persistTemplates();
  }
  const count = templates.length;
  console.info(`[templates] Hydrated ${count} template${count === 1 ? '' : 's'} from storage.`);
  renderTemplates();
}

function handleTemplateModalKeydown() {}
function applyTemplate() {}

function openTemplateModal() {
  const modal = $("template-modal");
  if (!modal) return;
  lastFocusedBeforeTemplateModal = document.activeElement;
  const category = $("taskCategory")?.value || 'General';
  const filtered = templates.filter(t => (t.category || 'General') === category);
  renderTemplateCards(filtered);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.addEventListener('keydown', handleTemplateModalKeydown);
  const firstButton = modal.querySelector('.template-card button') || modal.querySelector('.modal__close');
  if (firstButton) {
    firstButton.focus();
  }
}

function saveAsTemplate() {
  const name = $("name").value.trim();
  if (!name) return alert('Task name is required');
  const authorField = $("authorType");
  const authorType = authorField ? (authorField.value || 'attending') : 'attending';
  const patientField = $("patientType");
  const patientType = normalizePatientType(patientField ? patientField.value : 'Non-Complex');
  const visitField = $("visitType");
  const visitType = normalizeVisitType(visitField ? visitField.value : 'Follow-Up');
  const clinicField = $("clinicSite");
  const clinicSite = normalizeClinicSite(clinicField ? clinicField.value : 'General Clinic');
  const template = {
    name,
    category: $("taskCategory").value || 'General',
    authorType,
    patientType,
    visitType,
    clinicSite,
    importance: clampScale($("importance").value, 1),
    urgency: clampScale($("urgency").value, 3),
    novelty: clampScale($("novelty").value, 1),
    interest: clampScale($("interest").value, 1),
    externalPressure: clampScale($("externalPressure").value, 1),
    timeToStart: clampScale($("timeToStart").value, 1),
    difficulty: clampScale($("difficulty").value, 1),
  };
  templates.push(template);
  persistTemplates();
  renderTemplates();
}

test('templates persist across reload and render in modal', () => {
  nameInput.value = 'Hydration Template';
  authorType.value = 'attending';
  patientType.value = 'Non-Complex';
  visitType.value = 'Follow-Up';
  clinicSite.value = 'General Clinic';
  taskCategory.value = 'General';
  importance.value = '2';
  urgency.value = '3';
  novelty.value = '1';
  interest.value = '1';
  externalPressure.value = '1';
  timeToStart.value = '1';
  difficulty.value = '1';
  templates.length = 0;
  templateButtons.innerHTML = '';
  templateGrid.innerHTML = '';

  saveAsTemplate();

  const stored = JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY));
  assert.ok(Array.isArray(stored));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].name, 'Hydration Template');
  assert.equal(JSON.parse(localStorage.getItem(LEGACY_TEMPLATE_STORAGE_KEY)).length, 1);

  templates.length = 0;
  templateButtons.innerHTML = '';
  templateGrid.innerHTML = '';
  templateModal.classList.add('hidden');

  hydrateTemplatesFromStorage();

  assert.equal(templates.length, 1);
  assert.equal(templateButtons.children.length, 1);

  openTemplateModal();

  assert.equal(templateModal.classList.contains('hidden'), false);
  assert.equal(templateGrid.children.length, 1);
  const card = templateGrid.children[0];
  assert.equal(card.children[0].textContent, 'Hydration Template');
});

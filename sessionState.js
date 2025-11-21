export const ENERGY_SCORE_MAP = {
  1: 0.15,
  2: 0.4,
  3: 0.7,
  4: 0.95,
  5: 1.0,
};

export const SOCIAL_CONTEXT_OPTIONS = [
  { value: "home_solo", label: "Charting at home", score: 0.0 },
  { value: "clinic_open_door", label: "Charting in exam room with door open", score: 0.7 },
  { value: "clinic_workroom", label: "Charting in workroom", score: 0.5 },
  { value: "cafe", label: "Charting in a cafe", score: 0.4 },
  { value: "zoom_buddy", label: "Charting with a zoom buddy", score: 1.0 },
];

export const SOCIAL_SCORE_MAP = {
  home_solo: 0.0,
  clinic_open_door: 0.7,
  clinic_workroom: 0.5,
  cafe: 0.4,
  zoom_buddy: 1.0,
};

export const SessionState = (typeof window !== "undefined" && window.SessionState)
  ? window.SessionState
  : {};

if (!SessionState.energyLevel) {
  SessionState.energyLevel = 3;
}

if (!SessionState.contextLocation) {
  SessionState.contextLocation = SOCIAL_CONTEXT_OPTIONS[0].value;
}

export function getSocialContextOption(loc = SessionState.contextLocation || SOCIAL_CONTEXT_OPTIONS[0].value) {
  return SOCIAL_CONTEXT_OPTIONS.find(option => option.value === loc) || SOCIAL_CONTEXT_OPTIONS[0];
}

export function getMentalEnergyScore(energyLevel = SessionState.energyLevel ?? ENERGY_SCORE_MAP[3]) {
  const numeric = Number(energyLevel);
  if (Number.isFinite(numeric)) {
    return ENERGY_SCORE_MAP[numeric] ?? ENERGY_SCORE_MAP[3];
  }
  return ENERGY_SCORE_MAP[3];
}

export function getSocialContextScore(loc = SessionState.contextLocation || SOCIAL_CONTEXT_OPTIONS[0].value) {
  return SOCIAL_SCORE_MAP[loc] ?? getSocialContextOption(loc)?.score ?? 0;
}

if (typeof window !== "undefined") {
  window.SessionState = SessionState;
  window.getMentalEnergyScore = getMentalEnergyScore;
  window.getSocialContextScore = getSocialContextScore;
  window.getSocialContextOption = getSocialContextOption;
  window.SOCIAL_CONTEXT_OPTIONS = SOCIAL_CONTEXT_OPTIONS;
}

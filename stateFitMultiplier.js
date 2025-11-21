import { getMentalEnergyScore, getSocialContextScore } from './sessionState.js';

const SCALE_MIN = 1;
const SCALE_MAX = 5;

const clamp01 = value => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const toScaleValue = (value, fallback = 3) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, SCALE_MIN), SCALE_MAX);
};

const normaliseScale = (value, { invert = false } = {}) => {
  const clamped = toScaleValue(value);
  const normalised = (clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
  return invert ? 1 - normalised : normalised;
};

const computeEaseScore = task => {
  const startEase = normaliseScale(task?.timeToStart);
  const difficultyEase = normaliseScale(task?.difficulty, { invert: true });
  return (startEase + difficultyEase) / 2;
};

const computeEngagementScore = task => {
  const noveltyScore = normaliseScale(task?.novelty);
  const interestScore = normaliseScale(task?.interest);
  return (noveltyScore + interestScore) / 2;
};

export function computeStateFitMultiplier(
  task,
  { alpha = 0.7, kEase = 0.4, kEng = 0.4, kSocial = 0.5 } = {},
) {
  const easeScore = computeEaseScore(task);
  const engagementScore = computeEngagementScore(task);
  const mentalEnergy = clamp01(getMentalEnergyScore());
  const socialScore = clamp01(getSocialContextScore());

  const intrinsic = (
    kEase * easeScore
    + kEng * engagementScore
    + Math.max(0, 1 - kEase - kEng) * mentalEnergy
  );
  const context = (
    kSocial * socialScore
    + Math.max(0, 1 - kSocial) * mentalEnergy
  );

  const combined = alpha * intrinsic + (1 - alpha) * context;
  return clamp01(combined);
}

export default computeStateFitMultiplier;

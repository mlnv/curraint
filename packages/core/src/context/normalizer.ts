export function normalizeContextLimit(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;

  const rounded = Math.round(numeric);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

export type ContextLimitTarget = 'messages' | 'chars';

export function getContextLimitBounds(target: ContextLimitTarget): { min: number; max: number } {
  return target === 'messages'
    ? {
        min: 4,
        max: 1_200,
      }
    : {
        min: 4_000,
        max: 2_000_000,
      };
}

export function validateContextLimit(target: ContextLimitTarget, value: unknown): number | null {
  let numeric: number;

  if (typeof value === 'string') {
    numeric = /^-?\d+$/.test(value) ? Number.parseInt(value, 10) : Number.NaN;
  } else if (typeof value === 'number') {
    numeric = value;
  } else {
    numeric = Number.NaN;
  }

  if (!Number.isSafeInteger(numeric)) {
    return null;
  }

  const { min, max } = getContextLimitBounds(target);
  return numeric >= min && numeric <= max ? numeric : null;
}

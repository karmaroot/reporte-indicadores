import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Determines whether an indicator unit represents a time reduction goal (e.g. "Tiempo Promedio", "días hábiles").
 * For these indicators, taking fewer days/time (reported <= target) achieves target compliance and weighting contribution.
 */
export function isTimeReductionUnit(unit?: string | null): boolean {
  if (!unit) return false;
  const u = unit.toLowerCase().trim();
  return u.includes('tiempo') ||
         u.includes('días') || 
         u.includes('dias') || 
         u.includes('día') || 
         u.includes('dia') ||
         u.includes('horas') ||
         u.includes('hora');
}

/**
 * Checks if an indicator has fulfilled its target / weighting delivery.
 * - For time reduction units ("días hábiles"): fulfilled if reportedVal > 0 and reportedVal <= targetVal.
 * - For standard units: fulfilled if reportedVal >= targetVal.
 */
export function isIndicatorTargetFulfilled(
  reportedVal: number,
  targetVal: number,
  unit?: string | null
): boolean {
  if (targetVal <= 0 || reportedVal === null || reportedVal === undefined || isNaN(reportedVal)) {
    return false;
  }
  if (isTimeReductionUnit(unit)) {
    return reportedVal > 0 && reportedVal <= targetVal;
  }
  return reportedVal >= targetVal;
}

/**
 * Calculates progress percentage (0-100+) for an indicator based on reported value, target value, and unit.
 * - For time reduction units ("Tiempo Promedio", "días hábiles", etc.):
 *   - If reportedVal <= 0: 0%
 *   - If reportedVal <= targetVal: 100% (Cumple la entrega de ponderación)
 *   - If reportedVal > targetVal: 0% (Se excedió el tiempo límite; la ponderación no aporta al cálculo de porcentaje de avance)
 * - For standard indicators:
 *   - (reportedVal / targetVal) * 100 (capped at 100% by default)
 */
export function calculateIndicatorProgress(
  reportedVal: number,
  targetVal: number,
  unit?: string | null,
  options?: { capAt100?: boolean }
): number {
  const capAt100 = options?.capAt100 ?? true;

  if (targetVal <= 0 || reportedVal === null || reportedVal === undefined || isNaN(reportedVal)) {
    return 0;
  }

  if (isTimeReductionUnit(unit)) {
    if (reportedVal <= 0) return 0;
    if (reportedVal <= targetVal) {
      return 100;
    }
    // Si valor reportado > valor programado (se excedió el tiempo límite): la ponderación no aporta al avance
    return 0;
  }

  const pct = Math.round((reportedVal / targetVal) * 100);
  return capAt100 ? Math.min(pct, 100) : pct;
}

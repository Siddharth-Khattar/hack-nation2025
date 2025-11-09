// ABOUTME: Utility functions for calculating percentiles and statistical thresholds
// ABOUTME: Used for dynamic color scaling and visual threshold determination

/**
 * Calculates the percentile value from a sorted array
 * @param sortedArray - Array of numbers sorted in ascending order
 * @param percentile - Percentile to calculate (0-100)
 * @returns The value at the given percentile
 */
export function getPercentileValue(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) {
    return 0;
  }

  if (sortedArray.length === 1) {
    return sortedArray[0];
  }

  // Ensure percentile is within bounds
  const p = Math.max(0, Math.min(100, percentile));

  // Calculate the index using linear interpolation
  const index = (p / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  // If exact index, return that value
  if (lower === upper) {
    return sortedArray[lower];
  }

  // Otherwise, interpolate between lower and upper values
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

/**
 * Calculates multiple percentile values from an array
 * @param values - Array of numbers (will be sorted internally)
 * @param percentiles - Array of percentiles to calculate (0-100)
 * @returns Object mapping percentile to its value
 */
export function getPercentiles(values: number[], percentiles: number[]): Record<number, number> {
  if (values.length === 0) {
    return percentiles.reduce((acc, p) => ({ ...acc, [p]: 0 }), {});
  }

  // Sort the values once
  const sorted = [...values].sort((a, b) => a - b);

  // Calculate each percentile
  const result: Record<number, number> = {};
  for (const percentile of percentiles) {
    result[percentile] = getPercentileValue(sorted, percentile);
  }

  return result;
}

/**
 * Volatility thresholds for color scaling
 */
export interface VolatilityThresholds {
  p40: number;  // 40th percentile - below this is white
  p60: number;  // 60th percentile - middle color range
  p80: number;  // 80th percentile - above this is dark blue with glow
  min: number;  // Minimum value
  max: number;  // Maximum value
}

/**
 * Calculates volatility thresholds from node data
 * @param volatilities - Array of volatility values from nodes
 * @returns Thresholds for color scaling
 */
export function calculateVolatilityThresholds(volatilities: number[]): VolatilityThresholds {
  if (volatilities.length === 0) {
    // Return default values if no data
    return {
      p40: 0.4,
      p60: 0.6,
      p80: 0.8,
      min: 0,
      max: 1,
    };
  }

  const sorted = [...volatilities].sort((a, b) => a - b);

  return {
    p40: getPercentileValue(sorted, 40),
    p60: getPercentileValue(sorted, 60),
    p80: getPercentileValue(sorted, 80),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}
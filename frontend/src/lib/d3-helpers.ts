// ABOUTME: D3 utility functions for graph visualization styling and calculations
// ABOUTME: Maps data properties (volatility, correlation) to visual properties (colors, widths)

import type { VolatilityThresholds } from "../utils/percentile";

/**
 * Maps a node's volatility value to a color based on dynamic percentile thresholds.
 * Color scale:
 * - Below 40th percentile: white (#ffffff)
 * - 40th-60th percentile: very light blue (#dbeafe)
 * - 60th-80th percentile: light to standard blue (gradient)
 * - Above 80th percentile: dark blue (#1e3a8a)
 *
 * @param volatility - Value between 0 and 1 representing market volatility
 * @param thresholds - Dynamic percentile thresholds for color mapping
 * @returns CSS color string for the node
 */
export function getNodeColorWithThresholds(volatility: number, thresholds: VolatilityThresholds): string {
  // Bottom 40% - white
  if (volatility < thresholds.p40) {
    return "#ffffff";
  }

  // 40th to 60th percentile - very light blue
  if (volatility < thresholds.p60) {
    return "#dbeafe";
  }

  // 60th to 80th percentile - gradient from light blue to standard blue
  if (volatility < thresholds.p80) {
    // Interpolate between light blue (#93c5fd) and standard blue (#3b82f6)
    const range = thresholds.p80 - thresholds.p60;
    const position = (volatility - thresholds.p60) / range;

    // Linear interpolation between RGB values
    const startColor = { r: 147, g: 197, b: 253 }; // #93c5fd
    const endColor = { r: 59, g: 130, b: 246 }; // #3b82f6

    const r = Math.round(startColor.r + (endColor.r - startColor.r) * position);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * position);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * position);

    return `rgb(${r}, ${g}, ${b})`;
  }

  // Top 20% - dark blue
  return "#1e3a8a";
}

/**
 * Maps a node's volatility value (0-1) to a corresponding theme color.
 * Uses a 4-tier color scale as specified:
 * - < 0.3: very light blue (calm)
 * - 0.3-0.5: light blue
 * - 0.5-0.7: standard blue
 * - > 0.7: dark blue (highly volatile)
 *
 * @param volatility - Value between 0 and 1 representing market volatility
 * @returns CSS color string matching the theme's volatility color scale
 * @deprecated Use getNodeColorWithThresholds for dynamic percentile-based colors
 */
export function getNodeColor(volatility: number): string {
  if (volatility < 0.3) {
    return "#dbeafe"; // very light blue
  }
  if (volatility < 0.5) {
    return "#93c5fd"; // light blue
  }
  if (volatility < 0.7) {
    return "#3b82f6"; // standard blue
  }
  return "#1e3a8a"; // dark blue
}

/**
 * Maps a connection's correlation value (0-1) to a line thickness in pixels.
 * Higher correlation results in thicker lines to emphasize stronger relationships.
 *
 * @param correlation - Value between 0 and 1 representing connection strength
 * @returns Line width in pixels (0.5px to 5px range)
 */
export function getConnectionWidth(correlation: number): number {
  // Linear mapping: 0 -> 0.5px, 1 -> 5px
  return 0.5 + correlation * 4.5;
}

/**
 * Returns the base color for connections from the theme.
 *
 * @returns CSS color string for connection lines
 */
export function getConnectionColor(): string {
  return "rgba(148, 163, 184, 0.3)"; // connection-base from theme
}

/**
 * Calculates the radius for a node based on its volatility.
 * Higher volatility nodes are larger for clear visual emphasis.
 * Linear mapping from volatility to radius for noticeable diversity.
 *
 * @param volatility - Value between 0 and 1 representing market volatility
 * @returns Node radius in pixels (5-11px range, 6px variation)
 */
export function getNodeRadius(volatility: number): number {
  const minRadius = 5;
  const maxRadius = 11;
  const radiusRange = maxRadius - minRadius;

  // Linear mapping: 0 volatility = 5px, 1 volatility = 11px
  // This creates clear visual diversity (6px variation is very noticeable)
  return minRadius + (volatility * radiusRange);
}

/**
 * Checks if a node should have pulsing animation based on dynamic percentile thresholds.
 * Nodes above the 80th percentile will pulse with light green glow.
 *
 * @param volatility - Value between 0 and 1 representing market volatility
 * @param thresholds - Dynamic percentile thresholds
 * @returns Boolean indicating if node should pulse
 */
export function shouldNodePulseWithThresholds(volatility: number, thresholds: VolatilityThresholds): boolean {
  return volatility >= thresholds.p80;
}

/**
 * Checks if a node should have pulsing animation based on volatility.
 * Nodes with volatility > 0.7 will pulse with light green glow.
 *
 * @param volatility - Value between 0 and 1 representing market volatility
 * @returns Boolean indicating if node should pulse
 * @deprecated Use shouldNodePulseWithThresholds for dynamic percentile-based pulsing
 */
export function shouldNodePulse(volatility: number): boolean {
  return volatility > 0.7;
}

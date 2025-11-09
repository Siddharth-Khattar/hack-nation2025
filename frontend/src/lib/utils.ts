// ABOUTME: Utility functions for the application
// ABOUTME: Includes className merging and other helper functions

import { clsx, type ClassValue } from "clsx";

/**
 * Merges className strings using clsx
 * Handles conditional classes and removes duplicates
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Formats an ISO 8601 timestamp string to a human-readable format.
 *
 * @param isoString - ISO 8601 timestamp string (e.g., "2025-01-15T14:30:00.000Z")
 * @returns Formatted date string (e.g., "Jan 15, 2025, 2:30 PM")
 *
 * @example
 * formatTimestamp("2025-01-15T14:30:00.000Z") // "Jan 15, 2025, 2:30 PM"
 */
export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "Invalid date";
  }
}

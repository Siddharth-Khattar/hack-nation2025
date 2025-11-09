// ABOUTME: Utility functions for the application
// ABOUTME: Includes className merging, timestamp formatting, and localStorage helpers

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

/**
 * Safely retrieves a value from localStorage with SSR guard and error handling.
 *
 * This function is safe to use in Next.js server-side rendering contexts as it checks
 * for window availability before accessing localStorage. If localStorage is unavailable
 * or if parsing fails, it returns the provided default value.
 *
 * @template T - The type of the stored value
 * @param key - The localStorage key to retrieve
 * @param defaultValue - The value to return if retrieval fails or key doesn't exist
 * @returns The parsed value from localStorage, or defaultValue if unavailable
 *
 * @example
 * const userPrefs = getLocalStorage<UserPreferences>('user-prefs', { theme: 'dark' });
 */
export function getLocalStorage<T>(key: string, defaultValue: T): T {
  // SSR guard: localStorage is only available in the browser
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const item = window.localStorage.getItem(key);

    // Return default if key doesn't exist
    if (item === null) {
      return defaultValue;
    }

    // Parse and return the stored value
    return JSON.parse(item) as T;
  } catch (error) {
    // Log warning for debugging but don't throw
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safely sets a value in localStorage with SSR guard and error handling.
 *
 * This function is safe to use in Next.js server-side rendering contexts as it checks
 * for window availability before accessing localStorage. Errors (like quota exceeded)
 * are caught and logged but do not throw.
 *
 * @template T - The type of the value to store
 * @param key - The localStorage key to set
 * @param value - The value to store (will be JSON.stringify'd)
 *
 * @example
 * setLocalStorage('user-prefs', { theme: 'dark', language: 'en' });
 */
export function setLocalStorage<T>(key: string, value: T): void {
  // SSR guard: localStorage is only available in the browser
  if (typeof window === "undefined") {
    return;
  }

  try {
    const serializedValue = JSON.stringify(value);
    window.localStorage.setItem(key, serializedValue);
  } catch (error) {
    // Log warning for debugging (e.g., quota exceeded, circular reference)
    console.warn(`Error writing localStorage key "${key}":`, error);
  }
}

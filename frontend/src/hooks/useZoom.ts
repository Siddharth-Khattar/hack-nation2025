// ABOUTME: Utility function for creating D3 zoom and pan behavior for the graph canvas
// ABOUTME: Handles zoom events, programmatic zoom controls, and coordinate transformations

import { zoom, zoomIdentity, type D3ZoomEvent } from "d3-zoom";
import { select } from "d3-selection";
import "d3-transition";
import type { ZoomTransform } from "d3-zoom";

/**
 * Controller interface for programmatic zoom operations.
 * Provides methods to control zoom level via code (e.g., from UI buttons).
 */
export interface ZoomController {
  /**
   * Zooms in by a scale factor with smooth transition.
   * @param scaleFactor - Multiplier for current scale (default: 1.3)
   */
  zoomIn: (scaleFactor?: number) => void;

  /**
   * Zooms out by a scale factor with smooth transition.
   * @param scaleFactor - Divisor for current scale (default: 1.3)
   */
  zoomOut: (scaleFactor?: number) => void;

  /**
   * Resets zoom to initial state (scale: 1, translate: [0, 0]).
   */
  resetZoom: () => void;

  /**
   * Gets the current zoom transform.
   */
  getCurrentTransform: () => ZoomTransform;

  /**
   * Applies a specific zoom transform with animation.
   * Useful for zoom-to-cluster or zoom-to-fit operations.
   * @param transform - The target zoom transform
   * @param duration - Animation duration in milliseconds (default: 500)
   */
  applyTransform: (transform: ZoomTransform, duration?: number) => void;
}

/**
 * Creates a D3 zoom behavior for interactive graph navigation.
 *
 * The zoom behavior enables:
 * 1. **Mouse Wheel Zoom**: Zoom in/out centered on cursor position
 * 2. **Pan**: Click and drag on empty space to pan the view
 * 3. **Programmatic Control**: Zoom in/out/reset via returned controller methods
 *
 * The zoom transform is applied to the graph container group, moving all nodes
 * and connections together while preserving their relative positions.
 *
 * @param svgElement - The SVG element to attach zoom behavior to
 * @param onTransformChange - Callback fired when zoom transform changes
 * @param containerWidth - Width of the container for translate extent calculation
 * @param containerHeight - Height of the container for translate extent calculation
 * @returns ZoomController for programmatic zoom operations, or null if svgElement is null
 */
export function createZoomBehavior(
  svgElement: SVGSVGElement | null,
  onTransformChange: (transform: ZoomTransform) => void,
  containerWidth: number,
  containerHeight: number
): ZoomController | null {
  console.log("[DEBUG useZoom] createZoomBehavior called", {
    svgElement: !!svgElement,
    containerWidth,
    containerHeight,
  });

  if (!svgElement) {
    console.warn("[DEBUG useZoom] No SVG element provided, returning null");
    return null;
  }

  // Track current transform for programmatic operations
  let currentTransform: ZoomTransform = zoomIdentity;

  // Calculate translate extent to prevent panning too far off-canvas
  // Allow panning 2x container size in each direction for flexibility
  const translateExtent: [[number, number], [number, number]] = [
    [-containerWidth * 2, -containerHeight * 2],
    [containerWidth * 3, containerHeight * 3],
  ];

  /**
   * Handles zoom events from mouse wheel and pan gestures.
   * Updates the current transform and notifies parent component.
   */
  function handleZoom(event: D3ZoomEvent<SVGSVGElement, unknown>) {
    console.log("[DEBUG useZoom] Zoom event:", {
      scale: event.transform.k,
      translate: [event.transform.x, event.transform.y],
    });

    currentTransform = event.transform;
    onTransformChange(event.transform);
  }

  // Create zoom behavior with constraints
  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 5]) // Min: 10%, Max: 500%
    .translateExtent(translateExtent)
    .on("zoom", handleZoom);

  // Apply zoom behavior to SVG element
  const svg = select(svgElement);
  svg.call(zoomBehavior);

  console.log("[DEBUG useZoom] Zoom behavior applied to SVG", {
    scaleExtent: [0.1, 5],
    translateExtent,
  });

  /**
   * Applies a programmatic zoom transformation with smooth transition.
   * @param transform - The target zoom transform
   */
  function applyProgrammaticZoom(transform: ZoomTransform) {
    console.log("[DEBUG useZoom] Applying programmatic zoom:", {
      scale: transform.k,
      translate: [transform.x, transform.y],
    });

    // svgElement is guaranteed non-null at this point (checked before creating controller)
    const svg = select(svgElement as SVGSVGElement);
    svg
      .transition()
      .duration(300)
      .call(zoomBehavior.transform, transform);
  }

  // Create controller object with programmatic zoom methods
  const controller: ZoomController = {
    zoomIn: (scaleFactor = 1.3) => {
      console.log("[DEBUG useZoom] zoomIn called, scaleFactor:", scaleFactor);
      const newScale = currentTransform.k * scaleFactor;

      // Respect scale extent limits
      if (newScale > 5) {
        console.warn("[DEBUG useZoom] Zoom in blocked - at max scale");
        return;
      }

      // Scale centered on current view
      const newTransform = currentTransform.scale(scaleFactor);
      applyProgrammaticZoom(newTransform);
    },

    zoomOut: (scaleFactor = 1.3) => {
      console.log("[DEBUG useZoom] zoomOut called, scaleFactor:", scaleFactor);
      const newScale = currentTransform.k / scaleFactor;

      // Respect scale extent limits
      if (newScale < 0.1) {
        console.warn("[DEBUG useZoom] Zoom out blocked - at min scale");
        return;
      }

      // Scale centered on current view
      const newTransform = currentTransform.scale(1 / scaleFactor);
      applyProgrammaticZoom(newTransform);
    },

    resetZoom: () => {
      console.log("[DEBUG useZoom] resetZoom called");
      applyProgrammaticZoom(zoomIdentity);
    },

    getCurrentTransform: () => {
      return currentTransform;
    },

    applyTransform: (transform: ZoomTransform, duration = 500) => {
      console.log("[DEBUG useZoom] applyTransform called:", {
        scale: transform.k,
        translate: [transform.x, transform.y],
        duration,
      });

      // Apply the transform with custom duration
      const svg = select(svgElement as SVGSVGElement);
      svg
        .transition()
        .duration(duration)
        .call(zoomBehavior.transform, transform);
    },
  };

  return controller;
}

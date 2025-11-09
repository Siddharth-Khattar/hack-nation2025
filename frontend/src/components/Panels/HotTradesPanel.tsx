// ABOUTME: Hot trades panel component for displaying recommended trades
// ABOUTME: Placeholder component with collapse functionality; full trade filtering to be implemented in TICKET-011

"use client";

import { usePanelState } from "@/hooks/usePanelState";

/**
 * HotTradesPanel displays recommended trades based on selected cluster or graph analysis.
 *
 * This is a placeholder component with basic collapse functionality.
 * Full trade filtering, action badges, and confidence scores will be implemented in TICKET-011.
 *
 * Features:
 * - Positioned on right side of screen
 * - Collapsible with arrow button on left edge
 * - Semi-transparent background with backdrop blur
 * - Smooth transitions matching NodeInfoPanel
 */
export function HotTradesPanel() {
  const { isCollapsed, toggleCollapse } = usePanelState("hot-trades", true);

  return (
    <div
      style={{
        position: "fixed",
        right: "24px",
        top: "24px",
        zIndex: 10,
        width: isCollapsed ? "auto" : "min(320px, calc(100vw - 48px))",
        maxHeight: "calc(100vh - 48px)",
        transition: "width 300ms ease-in-out",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          border: "1px solid rgba(148, 163, 184, 0.2)",
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
          padding: isCollapsed ? "12px" : "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          transition: "padding 300ms ease-in-out",
        }}
      >
        {/* Header with collapse button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          {/* Collapse toggle button - on LEFT edge for right-side panel */}
          <button
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
            title={isCollapsed ? "Expand panel" : "Collapse panel"}
            style={{
              backgroundColor: "rgba(30, 41, 59, 0.6)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "6px",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px 10px",
              fontSize: "16px",
              transition: "all 200ms ease-in-out",
              marginRight: isCollapsed ? 0 : "auto",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)";
              e.currentTarget.style.color = "#60a5fa";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.2)";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            {isCollapsed ? "◀" : "▶"}
          </button>

          {!isCollapsed && (
            <h2
              style={{
                color: "#f1f5f9",
                fontSize: "18px",
                fontWeight: "600",
                margin: 0,
              }}
            >
              Recommended Trades
            </h2>
          )}
        </div>

        {/* Content - only show when not collapsed */}
        {!isCollapsed && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: "24px 12px",
            }}
          >
            {/* Placeholder content */}
            <div
              style={{
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <div
                style={{
                  fontSize: "48px",
                  marginBottom: "16px",
                }}
                role="img"
                aria-label="Construction"
              >
                🚧
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  marginBottom: "8px",
                }}
              >
                Trade Features Coming Soon
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#64748b",
                  lineHeight: "1.5",
                }}
              >
                This panel will display recommended trades with action badges
                (LONG/SHORT), confidence scores, and filtering based on selected
                clusters.
              </div>
            </div>

            {/* Placeholder for future feature list */}
            <div
              style={{
                backgroundColor: "rgba(30, 41, 59, 0.4)",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "13px",
                color: "#94a3b8",
                lineHeight: "1.6",
              }}
            >
              <div
                style={{
                  fontWeight: "600",
                  marginBottom: "8px",
                  color: "#cbd5e1",
                }}
              >
                Upcoming Features:
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                }}
              >
                <li>Trade action badges (LONG/SHORT/NEUTRAL)</li>
                <li>Confidence percentage indicators</li>
                <li>Cluster-based trade filtering</li>
                <li>Interactive trade cards</li>
                <li>Trade execution buttons</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

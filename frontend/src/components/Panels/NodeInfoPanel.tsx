// ABOUTME: Node info panel component for displaying node details and list
// ABOUTME: Shows selected node properties or scrollable list when no selection

"use client";

import { useState } from "react";
import type { GraphNode } from "@/types/graph";
import { getNodeColor } from "@/lib/d3-helpers";
import { formatTimestamp } from "@/lib/utils";

interface NodeInfoPanelProps {
  /** All nodes in the graph for list view */
  nodes: GraphNode[];

  /** Currently selected node (null if none selected) */
  selectedNode: GraphNode | null;

  /** Callback when user clicks a node in list view */
  onNodeSelect: (nodeId: string) => void;
}

/**
 * NodeInfoPanel displays either detailed information about a selected node
 * or a scrollable list of all nodes in the graph.
 *
 * Features:
 * - Detail View: Shows name, group, volatility bar, and last update timestamp
 * - List View: Shows scrollable list of all nodes with hover effects
 * - Collapsible with arrow button on right edge
 * - Semi-transparent background with backdrop blur
 * - Smooth transitions between views
 */
export function NodeInfoPanel({
  nodes,
  selectedNode,
  onNodeSelect,
}: NodeInfoPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  return (
    <div
      style={{
        position: "fixed",
        left: "24px",
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
          {!isCollapsed && (
            <h2
              style={{
                color: "#f1f5f9",
                fontSize: "18px",
                fontWeight: "600",
                margin: 0,
              }}
            >
              {selectedNode ? "Node Info" : "All Nodes"}
            </h2>
          )}

          {/* Collapse toggle button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
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
              marginLeft: isCollapsed ? 0 : "auto",
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
            {isCollapsed ? "→" : "←"}
          </button>
        </div>

        {/* Content - only show when not collapsed */}
        {!isCollapsed && (
          <>
            {selectedNode ? (
              <NodeDetailView node={selectedNode} />
            ) : (
              <NodeListView
                nodes={nodes}
                onNodeSelect={onNodeSelect}
                hoveredNodeId={hoveredNodeId}
                onHoverChange={setHoveredNodeId}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * NodeDetailView displays detailed information about a selected node.
 * Shows name, group, volatility with gradient bar, and last update timestamp.
 */
function NodeDetailView({ node }: { node: GraphNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Name field */}
      <FieldDisplay label="Name" value={node.name} />

      {/* ID field */}
      <FieldDisplay label="ID" value={node.id} />

      {/* Group field */}
      <FieldDisplay label="Group" value={node.group} />

      {/* Volatility field with gradient bar */}
      <div>
        <FieldLabel>Volatility</FieldLabel>
        <VolatilityBar volatility={node.volatility} />
      </div>

      {/* Last Update field */}
      <FieldDisplay
        label="Last Update"
        value={formatTimestamp(node.lastUpdate)}
      />
    </div>
  );
}

/**
 * NodeListView displays a scrollable list of all nodes in the graph.
 * Each item shows the node ID, name, and a volatility color indicator.
 */
function NodeListView({
  nodes,
  onNodeSelect,
  hoveredNodeId,
  onHoverChange,
}: {
  nodes: GraphNode[];
  onNodeSelect: (nodeId: string) => void;
  hoveredNodeId: string | null;
  onHoverChange: (nodeId: string | null) => void;
}) {
  return (
    <div
      style={{
        maxHeight: "calc(100vh - 180px)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {nodes.length === 0 ? (
        <div
          style={{
            color: "#64748b",
            fontSize: "14px",
            textAlign: "center",
            padding: "24px 12px",
          }}
        >
          No nodes available
        </div>
      ) : (
        nodes.map((node) => (
          <div
            key={node.id}
            onClick={() => onNodeSelect(node.id)}
            onMouseEnter={() => onHoverChange(node.id)}
            onMouseLeave={() => onHoverChange(null)}
            role="button"
            tabIndex={0}
            aria-label={`Select node ${node.id}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNodeSelect(node.id);
              }
            }}
            style={{
              padding: "12px",
              borderRadius: "8px",
              backgroundColor:
                hoveredNodeId === node.id
                  ? "rgba(59, 130, 246, 0.2)"
                  : "transparent",
              cursor: "pointer",
              transition: "all 150ms ease-in-out",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* Volatility color indicator */}
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: getNodeColor(node.volatility),
                flexShrink: 0,
              }}
              aria-hidden="true"
            />

            {/* Node info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: "#f1f5f9",
                  fontSize: "14px",
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.id}
              </div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.name}
              </div>
            </div>

            {/* Group badge */}
            <div
              style={{
                color: "#64748b",
                fontSize: "11px",
                backgroundColor: "rgba(30, 41, 59, 0.6)",
                padding: "2px 8px",
                borderRadius: "4px",
                flexShrink: 0,
              }}
            >
              G{node.group}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * FieldDisplay is a reusable component for displaying a label and value pair.
 */
function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          color: "#f1f5f9",
          fontSize: "14px",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * FieldLabel is a reusable component for field labels.
 */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        color: "#94a3b8",
        fontSize: "12px",
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        display: "block",
        marginBottom: "4px",
      }}
    >
      {children}
    </label>
  );
}

/**
 * Interpolates between two RGB colors based on a ratio.
 * Used to calculate the appropriate color for a given volatility level.
 *
 * @param color1 - Starting color in hex format (e.g., "#3b82f6")
 * @param color2 - Ending color in hex format (e.g., "#ef4444")
 * @param ratio - Interpolation ratio between 0 and 1
 * @returns Interpolated color in hex format
 */
function interpolateColor(color1: string, color2: string, ratio: number): string {
  const hex = (color: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  const c1 = hex(color1);
  const c2 = hex(color2);

  const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
  const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
  const b = Math.round(c1.b + (c2.b - c1.b) * ratio);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * VolatilityBar displays a gradient progress bar showing volatility level.
 * The gradient transitions from blue (low volatility) through yellow/orange to red (high volatility).
 * The gradient only extends to the current volatility level, not the full spectrum.
 */
function VolatilityBar({ volatility }: { volatility: number }) {
  // Calculate the color at the current volatility level
  // Blue (#3b82f6) at 0% -> Red (#ef4444) at 100%
  const endColor = interpolateColor("#3b82f6", "#ef4444", volatility);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {/* Progress bar container */}
      <div
        style={{
          flex: 1,
          height: "8px",
          backgroundColor: "rgba(30, 41, 59, 0.6)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {/* Progress bar fill with gradient from blue to volatility-appropriate color */}
        <div
          style={{
            width: `${volatility * 100}%`,
            height: "100%",
            background: `linear-gradient(to right, #3b82f6, ${endColor})`,
            transition: "width 300ms ease-in-out",
          }}
        />
      </div>

      {/* Percentage display */}
      <span
        style={{
          color: "#f1f5f9",
          fontSize: "12px",
          minWidth: "40px",
          textAlign: "right",
        }}
      >
        {(volatility * 100).toFixed(0)}%
      </span>
    </div>
  );
}

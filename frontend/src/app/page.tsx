// ABOUTME: Main page component displaying the trading network graph
// ABOUTME: Loads graph data and renders the force-directed visualization

"use client";

import { useState, useMemo } from "react";
import { ForceGraph } from "@/components/ForceGraph/ForceGraph";
import { ZoomControls } from "@/components/Controls/ZoomControls";
import { SearchBar } from "@/components/Controls/SearchBar";
import { NodeInfoPanel } from "@/components/Panels/NodeInfoPanel";
import { HotTradesPanel } from "@/components/Panels/HotTradesPanel";
import { isGraphData } from "@/types/graph";
import type { ZoomController } from "@/hooks/useZoom";
import type { ClusterController } from "@/types/graph";

// API-TODO: Replace with GET /api/graph/data endpoint when backend is ready
// API-TODO: This mock data import should be replaced with a fetch call to the backend API
// API-TODO: Example: const response = await fetch('/api/graph/data'); const data = await response.json();
import graphDataJson from "@/data/sample-100-nodes.json";
import type { GraphData, GraphNode } from "@/types/graph";

const graphData = graphDataJson as GraphData;

// Deduplicate nodes by ID to ensure data integrity across all components
// This prevents React key conflicts and ensures consistent behavior
function deduplicateNodes(nodes: GraphNode[]): GraphNode[] {
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach(node => {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    }
  });
  return Array.from(nodeMap.values());
}

export default function Home() {
  const [zoomController, setZoomController] = useState<ZoomController | null>(null);
  const [clusterController, setClusterController] = useState<ClusterController | null>(null);

  // Deduplicate nodes once for consistent data across all components
  // Memoized to prevent re-computation on every render
  const uniqueNodes = useMemo(() => deduplicateNodes(graphData.nodes), []);

  // Derive the currently selected node from the cluster controller
  // Returns null if no node is selected or controller is not available
  const selectedNode = useMemo(() => {
    if (!clusterController) return null;

    const selectedNodeId = clusterController.getSelectedNodeId();
    if (!selectedNodeId) return null;

    return uniqueNodes.find(node => node.id === selectedNodeId) || null;
  }, [clusterController, uniqueNodes]);

  // Validate data structure at runtime
  if (!isGraphData(graphData)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-graph-bg">
        <div className="rounded-lg bg-accent-red/10 border border-accent-red px-8 py-6">
          <p className="text-lg font-medium text-accent-red">
            Error: Invalid graph data structure
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-graph-bg">
      <ForceGraph
        data={graphData}
        onZoomControllerCreated={setZoomController}
        onClusterControllerCreated={setClusterController}
      />
      {clusterController && (
        <>
          <NodeInfoPanel
            nodes={uniqueNodes}
            selectedNode={selectedNode}
            onNodeSelect={(nodeId) => clusterController.selectNode(nodeId)}
          />
          <SearchBar
            nodes={uniqueNodes}
            onNodeSelect={(nodeId) => clusterController.selectNode(nodeId)}
            onClear={() => clusterController.clearSelection()}
          />
          <HotTradesPanel />
        </>
      )}
      {zoomController && (
        <ZoomControls
          onZoomIn={() => zoomController.zoomIn()}
          onZoomOut={() => zoomController.zoomOut()}
          onReset={() => zoomController.resetZoom()}
        />
      )}
    </div>
  );
}

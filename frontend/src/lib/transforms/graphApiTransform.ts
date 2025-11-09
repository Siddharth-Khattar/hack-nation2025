// ABOUTME: Transform functions for converting API graph endpoint response to frontend GraphData
// ABOUTME: Merges market details with graph structure from /api/relations/graph

import type {
  Market,
  GraphNodeResponse,
  GraphConnectionResponse,
  GraphResponse
} from '../api/types';
import type { GraphData, GraphNode, GraphConnection, HotTrade } from '@/types/graph';

/**
 * Calculate distance from similarity for D3 force simulation
 * Higher similarity = shorter distance (nodes closer together)
 * @param similarity - Similarity score (0.0-1.0)
 * @returns Distance value for D3 force simulation
 */
function calculateDistance(similarity: number): number {
  const minDist = 30; // Minimum distance for very similar nodes
  const maxDist = 150; // Maximum distance for dissimilar nodes

  // Invert similarity to get distance
  // similarity 1.0 -> distance 30
  // similarity 0.7 -> distance 69
  // similarity 0.0 -> distance 150
  return maxDist - (similarity * (maxDist - minDist));
}

/**
 * Transform API GraphNodeResponse to frontend GraphNode
 * Enriches with market details if available
 * @param apiNode - Node from graph API response
 * @param marketMap - Map of market_id to full Market object
 * @returns Transformed GraphNode
 */
function transformApiNodeToGraphNode(
  apiNode: GraphNodeResponse,
  marketMap: Map<number, Market>
): GraphNode {
  // Get full market details if available
  const market = marketMap.get(apiNode.market_id);

  return {
    // Use market_id as the primary identifier for internal consistency
    id: apiNode.market_id.toString(),

    // Use shortened_name if available, otherwise truncate name
    name: apiNode.shortened_name ||
          (apiNode.name.length > 50
            ? apiNode.name.substring(0, 47) + '...'
            : apiNode.name),

    // Full name for detail view
    fullName: apiNode.name,

    // Use shortened_name for display
    shortened_name: apiNode.shortened_name || apiNode.name,

    group: apiNode.group,

    // Use volatility from graph API, fallback to 0
    volatility: apiNode.volatility ?? 0,

    volume: apiNode.volume,
    lastUpdate: apiNode.lastUpdate,

    // Enrich with market details if available
    description: market?.description ?? undefined,
    tags: market?.tags ?? [apiNode.group], // Use group as fallback tag
    outcomes: market?.outcomes ?? [],
    outcomePrices: market?.outcome_prices ?? [],

    // Additional market info
    polymarketId: apiNode.id, // Store polymarket_id for reference
    marketId: apiNode.market_id,
  };
}

/**
 * Transform API GraphConnectionResponse to frontend GraphConnection
 * Maps polymarket_id to database ID and adds distance calculation
 * @param apiConnection - Connection from graph API response
 * @param nodeIdMap - Map of polymarket_id to database_id
 * @returns Transformed GraphConnection or null if nodes not found
 */
function transformApiConnectionToGraphConnection(
  apiConnection: GraphConnectionResponse,
  nodeIdMap: Map<string, string>
): GraphConnection | null {
  // Map polymarket IDs to database IDs
  const sourceDbId = nodeIdMap.get(apiConnection.source);
  const targetDbId = nodeIdMap.get(apiConnection.target);

  if (!sourceDbId || !targetDbId) {
    console.warn(`Missing node mapping for connection: ${apiConnection.source} -> ${apiConnection.target}`);
    return null;
  }

  return {
    source: sourceDbId,
    target: targetDbId,
    correlation: apiConnection.correlation,
    pressure: apiConnection.pressure,
    // Calculate distance from similarity for D3 force simulation
    distance: calculateDistance(apiConnection.similarity),
  };
}

/**
 * Generate synthetic hot trades from nodes and connections
 * Based on volatility patterns and connection strength
 * @param nodes - Graph nodes
 * @param connections - Graph connections
 * @param count - Number of trades to generate
 * @returns Generated hot trades
 */
function generateHotTrades(
  nodes: GraphNode[],
  connections: GraphConnection[],
  count: number
): HotTrade[] {
  // Sort nodes by volatility (highest first)
  const sortedNodes = [...nodes].sort((a, b) => b.volatility - a.volatility);

  // Create adjacency map for connection counting
  const connectionCount = new Map<string, number>();
  connections.forEach(conn => {
    const sourceId = typeof conn.source === 'string' ? conn.source : conn.source.id;
    const targetId = typeof conn.target === 'string' ? conn.target : conn.target.id;

    connectionCount.set(sourceId, (connectionCount.get(sourceId) || 0) + 1);
    connectionCount.set(targetId, (connectionCount.get(targetId) || 0) + 1);
  });

  // Generate trades for top volatile nodes
  return sortedNodes.slice(0, count).map((node, index) => {
    const connCount = connectionCount.get(node.id) || 0;

    // Determine action based on volatility
    let action: 'LONG' | 'SHORT' | 'NEUTRAL';
    if (node.volatility > 0.7) {
      action = 'SHORT'; // High volatility - potentially overbought
    } else if (node.volatility < 0.4) {
      action = 'LONG'; // Low volatility - potential opportunity
    } else {
      action = 'NEUTRAL'; // Medium volatility - uncertain
    }

    // Calculate confidence based on volatility stability and connections
    const stabilityScore = (1 - node.volatility) * 0.5;
    const connectionScore = Math.min(connCount / 10, 1) * 0.5;
    const confidence = Math.max(0.3, Math.min(0.95, stabilityScore + connectionScore));

    // Find related nodes
    const relatedNodeIds = connections
      .filter(conn => {
        const sourceId = typeof conn.source === 'string' ? conn.source : conn.source.id;
        const targetId = typeof conn.target === 'string' ? conn.target : conn.target.id;
        return sourceId === node.id || targetId === node.id;
      })
      .map(conn => {
        const sourceId = typeof conn.source === 'string' ? conn.source : conn.source.id;
        const targetId = typeof conn.target === 'string' ? conn.target : conn.target.id;
        return sourceId === node.id ? targetId : sourceId;
      })
      .slice(0, 3); // Limit to 3 related nodes

    return {
      id: `trade-${node.id}-${index}`,
      title: node.name,
      relatedNodes: [node.id, ...relatedNodeIds],
      confidence,
      action,
    };
  });
}

/**
 * Main transform function: Merge market data with graph response
 * @param markets - Full market details from /api/markets/
 * @param graphResponse - Graph structure from /api/relations/graph
 * @returns Complete GraphData for frontend
 */
export function transformApiGraphToGraphData(
  markets: Market[],
  graphResponse: GraphResponse
): GraphData {
  // Create map of market_id to Market for quick lookups
  const marketMap = new Map<number, Market>();
  markets.forEach(market => {
    marketMap.set(market.id, market);
  });

  // Create mapping from polymarket_id to database_id
  const nodeIdMap = new Map<string, string>();
  graphResponse.nodes.forEach(node => {
    nodeIdMap.set(node.id, node.market_id.toString());
  });

  // Transform nodes with market enrichment
  const nodes = graphResponse.nodes.map(apiNode =>
    transformApiNodeToGraphNode(apiNode, marketMap)
  );

  // Transform connections with ID mapping and distance calculation
  const connections = graphResponse.connections
    .map(conn => transformApiConnectionToGraphConnection(conn, nodeIdMap))
    .filter((conn): conn is GraphConnection => conn !== null);

  // Generate hot trades based on volatility patterns
  const hotTrades = generateHotTrades(nodes, connections, 15);

  return {
    nodes,
    connections,
    hotTrades,
  };
}

/**
 * Validate that the graph data is complete and consistent
 * @param data - Graph data to validate
 * @returns The validated GraphData if valid, throws error otherwise
 */
export function validateGraphData(data: GraphData): GraphData {
  // Check nodes
  if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
    throw new Error('Graph data must have at least one node');
  }

  // Check connections
  if (!Array.isArray(data.connections)) {
    throw new Error('Graph data must have connections array');
  }

  // Create node ID set for validation
  const nodeIds = new Set(data.nodes.map(n => n.id));

  // Validate connections reference existing nodes
  for (const conn of data.connections) {
    const sourceId = typeof conn.source === 'string' ? conn.source : conn.source.id;
    const targetId = typeof conn.target === 'string' ? conn.target : conn.target.id;

    if (!nodeIds.has(sourceId)) {
      console.warn(`Connection references non-existent source node: ${sourceId}`);
    }
    if (!nodeIds.has(targetId)) {
      console.warn(`Connection references non-existent target node: ${targetId}`);
    }
  }

  return data;
}
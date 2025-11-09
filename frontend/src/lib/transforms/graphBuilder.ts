// ABOUTME: Orchestrates the construction of complete GraphData from backend API responses
// ABOUTME: Combines markets, relations, and generates synthetic hot trades

import type { Market, EnrichedRelatedMarket } from '../api/types';
import type { GraphData, GraphNode, GraphConnection, HotTrade } from '@/types/graph';
import { transformMarketToNode } from './marketToGraph';
import {
  transformEnrichedMarketToConnection,
  deduplicateConnections,
  createAdjacencyMap,
} from './relationToEdge';

/**
 * Generate synthetic hot trades based on market volatility and connections
 * @param nodes - Array of GraphNode objects
 * @param connections - Array of GraphConnection objects
 * @param maxTrades - Maximum number of trades to generate (default 15)
 * @returns Array of HotTrade objects
 */
function generateHotTrades(
  nodes: GraphNode[],
  connections: GraphConnection[],
  maxTrades: number = 15
): HotTrade[] {
  const hotTrades: HotTrade[] = [];

  // Create adjacency map for finding clusters
  const adjacencyMap = createAdjacencyMap(connections);

  // Sort nodes by volatility to find hot markets
  const sortedNodes = [...nodes].sort((a, b) => b.volatility - a.volatility);

  // Generate trades for high-volatility nodes
  for (let i = 0; i < Math.min(maxTrades, sortedNodes.length); i++) {
    const node = sortedNodes[i];
    const connectedNodes = adjacencyMap.get(node.id) || new Set();

    // Determine trade action based on volatility and connections
    let action: HotTrade['action'];
    if (node.volatility > 0.7) {
      action = 'SHORT'; // High volatility suggests overbought
    } else if (node.volatility > 0.4) {
      action = 'NEUTRAL'; // Medium volatility suggests uncertainty
    } else {
      action = 'LONG'; // Low volatility suggests opportunity
    }

    // Calculate confidence based on number of connections and volatility
    const connectionStrength = Math.min(connectedNodes.size / 10, 1);
    const confidence = (1 - node.volatility) * 0.5 + connectionStrength * 0.5;

    const trade: HotTrade = {
      id: `trade-${node.id}`,
      title: `${action} ${node.name}`,
      relatedNodes: [node.id, ...Array.from(connectedNodes).slice(0, 3)],
      confidence: Math.min(Math.max(confidence, 0.3), 0.95), // Clamp between 0.3 and 0.95
      action,
    };

    hotTrades.push(trade);
  }

  return hotTrades;
}

/**
 * Build GraphData from markets and their enriched relations
 * @param markets - Array of Market objects
 * @param relationsMap - Map of market ID to enriched relations
 * @param options - Build options
 * @returns Complete GraphData structure
 */
export function buildGraphFromEnrichedData(
  markets: Market[],
  relationsMap: Map<number, EnrichedRelatedMarket[]>,
  options?: {
    maxNodes?: number;
    minCorrelation?: number;
    generateTrades?: boolean;
  }
): GraphData {
  const maxNodes = options?.maxNodes || 100;
  const minCorrelation = options?.minCorrelation || 0;
  const generateTrades = options?.generateTrades !== false; // Default true

  // Transform markets to nodes
  const allNodes = markets.map(transformMarketToNode);

  // Limit nodes if specified
  const nodes = allNodes.slice(0, maxNodes);
  const nodeIds = new Set(nodes.map(n => n.id));

  // Build connections from relations
  const allConnections: GraphConnection[] = [];

  relationsMap.forEach((relatedMarkets, sourceMarketId) => {
    const sourceId = sourceMarketId.toString();

    // Only include connections where both nodes are in our graph
    if (!nodeIds.has(sourceId)) return;

    relatedMarkets.forEach(relatedMarket => {
      const targetId = relatedMarket.market_id.toString();

      if (nodeIds.has(targetId)) {
        const connection = transformEnrichedMarketToConnection(
          sourceMarketId,
          relatedMarket
        );

        // Apply correlation filter
        if (connection.correlation >= minCorrelation) {
          allConnections.push(connection);
        }
      }
    });
  });

  // Deduplicate connections
  const connections = deduplicateConnections(allConnections);

  // Generate hot trades if requested
  const hotTrades = generateTrades
    ? generateHotTrades(nodes, connections, 15)
    : [];

  return {
    nodes,
    connections,
    hotTrades,
  };
}

/**
 * Build GraphData from simple market list and relations
 * @param markets - Array of Market objects
 * @param getRelations - Function to fetch relations for a market
 * @param options - Build options
 * @returns Promise resolving to complete GraphData structure
 */
export async function buildGraphWithRelationsFetch(
  markets: Market[],
  getRelations: (marketId: number) => Promise<EnrichedRelatedMarket[]>,
  options?: {
    maxNodes?: number;
    minSimilarity?: number;
    maxRelationsPerNode?: number;
    generateTrades?: boolean;
  }
): Promise<GraphData> {
  const maxNodes = options?.maxNodes || 100;
  const maxRelationsPerNode = options?.maxRelationsPerNode || 10;

  // Limit markets to maxNodes
  const limitedMarkets = markets.slice(0, maxNodes);

  // Fetch relations for each market in parallel
  const relationsPromises = limitedMarkets.map(async market => {
    try {
      const relations = await getRelations(market.id);
      // Limit relations per node
      const limitedRelations = relations.slice(0, maxRelationsPerNode);
      return { marketId: market.id, relations: limitedRelations };
    } catch (error) {
      console.warn(`Failed to fetch relations for market ${market.id}:`, error);
      return { marketId: market.id, relations: [] };
    }
  });

  const relationsResults = await Promise.all(relationsPromises);

  // Build relations map
  const relationsMap = new Map<number, EnrichedRelatedMarket[]>();
  relationsResults.forEach(result => {
    relationsMap.set(result.marketId, result.relations);
  });

  // Build graph from fetched data
  return buildGraphFromEnrichedData(limitedMarkets, relationsMap, options);
}

/**
 * Validate and sanitize GraphData
 * @param data - GraphData to validate
 * @returns Validated and sanitized GraphData
 */
export function validateGraphData(data: GraphData): GraphData {
  // Ensure all required fields are present
  const validatedData: GraphData = {
    nodes: data.nodes || [],
    connections: data.connections || [],
    hotTrades: data.hotTrades || [],
  };

  // Remove duplicate nodes
  const nodeMap = new Map<string, GraphNode>();
  validatedData.nodes.forEach(node => {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    }
  });
  validatedData.nodes = Array.from(nodeMap.values());

  // Create set of valid node IDs
  const validNodeIds = new Set(validatedData.nodes.map(n => n.id));

  // Filter connections to only include valid nodes
  validatedData.connections = validatedData.connections.filter(
    conn => validNodeIds.has(conn.source.toString()) &&
            validNodeIds.has(conn.target.toString())
  );

  // Filter hot trades to only include valid nodes
  validatedData.hotTrades = validatedData.hotTrades.filter(trade =>
    trade.relatedNodes.every(nodeId => validNodeIds.has(nodeId))
  );

  return validatedData;
}

/**
 * Merge multiple GraphData objects
 * @param graphs - Array of GraphData objects to merge
 * @returns Merged GraphData
 */
export function mergeGraphData(...graphs: GraphData[]): GraphData {
  const mergedNodes: GraphNode[] = [];
  const mergedConnections: GraphConnection[] = [];
  const mergedHotTrades: HotTrade[] = [];

  const nodeMap = new Map<string, GraphNode>();
  const connectionSet = new Set<string>();
  const tradeMap = new Map<string, HotTrade>();

  graphs.forEach(graph => {
    // Merge nodes
    graph.nodes.forEach(node => {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, node);
        mergedNodes.push(node);
      }
    });

    // Merge connections
    graph.connections.forEach(conn => {
      const key = `${conn.source}-${conn.target}`;
      const reverseKey = `${conn.target}-${conn.source}`;

      if (!connectionSet.has(key) && !connectionSet.has(reverseKey)) {
        connectionSet.add(key);
        mergedConnections.push(conn);
      }
    });

    // Merge hot trades
    graph.hotTrades.forEach(trade => {
      if (!tradeMap.has(trade.id)) {
        tradeMap.set(trade.id, trade);
        mergedHotTrades.push(trade);
      }
    });
  });

  return validateGraphData({
    nodes: mergedNodes,
    connections: mergedConnections,
    hotTrades: mergedHotTrades,
  });
}
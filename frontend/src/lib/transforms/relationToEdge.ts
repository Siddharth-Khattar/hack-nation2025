// ABOUTME: Transformation functions to convert backend MarketRelation objects to frontend GraphConnection objects
// ABOUTME: Handles edge creation from market relationships with correlation and pressure values

import type {
  MarketRelation,
  RelatedMarket,
  EnrichedRelatedMarket,
} from '../api/types';
import type { GraphConnection } from '@/types/graph';

/**
 * Transform a MarketRelation to GraphConnection
 * @param relation - MarketRelation from backend
 * @returns GraphConnection for frontend
 */
export function transformRelationToConnection(relation: MarketRelation): GraphConnection {
  return {
    source: relation.market_id_1.toString(),
    target: relation.market_id_2.toString(),
    correlation: relation.correlation || 0,
    pressure: relation.pressure || 0,
  };
}

/**
 * Transform a RelatedMarket result to GraphConnection
 * @param sourceMarketId - Source market ID
 * @param relatedMarket - Related market result
 * @returns GraphConnection for frontend
 */
export function transformRelatedMarketToConnection(
  sourceMarketId: number,
  relatedMarket: RelatedMarket
): GraphConnection {
  return {
    source: sourceMarketId.toString(),
    target: relatedMarket.market_id.toString(),
    correlation: relatedMarket.correlation || 0,
    pressure: relatedMarket.pressure || 0,
  };
}

/**
 * Transform an EnrichedRelatedMarket to GraphConnection
 * @param sourceMarketId - Source market ID
 * @param enrichedMarket - Enriched related market with full details
 * @returns GraphConnection for frontend
 */
export function transformEnrichedMarketToConnection(
  sourceMarketId: number,
  enrichedMarket: EnrichedRelatedMarket
): GraphConnection {
  return {
    source: sourceMarketId.toString(),
    target: enrichedMarket.market_id.toString(),
    correlation: enrichedMarket.correlation || 0,
    pressure: enrichedMarket.pressure || 0,
  };
}

/**
 * Transform an array of MarketRelations to GraphConnections
 * @param relations - Array of MarketRelation objects
 * @returns Array of GraphConnection objects
 */
export function transformRelationsToConnections(
  relations: MarketRelation[]
): GraphConnection[] {
  return relations.map(transformRelationToConnection);
}

/**
 * Transform RelatedMarket results to GraphConnections
 * @param sourceMarketId - Source market ID
 * @param relatedMarkets - Array of related markets
 * @returns Array of GraphConnection objects
 */
export function transformRelatedMarketsToConnections(
  sourceMarketId: number,
  relatedMarkets: RelatedMarket[]
): GraphConnection[] {
  return relatedMarkets.map(rm =>
    transformRelatedMarketToConnection(sourceMarketId, rm)
  );
}

/**
 * Create bidirectional connections for undirected graph
 * @param connections - Array of GraphConnection objects
 * @returns Array with bidirectional connections
 */
export function makeBidirectionalConnections(
  connections: GraphConnection[]
): GraphConnection[] {
  const bidirectional: GraphConnection[] = [];
  const seen = new Set<string>();

  connections.forEach(conn => {
    const forwardKey = `${conn.source}-${conn.target}`;
    const reverseKey = `${conn.target}-${conn.source}`;

    if (!seen.has(forwardKey) && !seen.has(reverseKey)) {
      bidirectional.push(conn);

      // Add reverse connection if not already present
      if (conn.source !== conn.target) {
        bidirectional.push({
          source: conn.target,
          target: conn.source,
          correlation: conn.correlation,
          pressure: conn.pressure,
        });
      }

      seen.add(forwardKey);
      seen.add(reverseKey);
    }
  });

  return bidirectional;
}

/**
 * Deduplicate connections keeping the one with highest correlation
 * @param connections - Array of GraphConnection objects
 * @returns Deduplicated array of connections
 */
export function deduplicateConnections(
  connections: GraphConnection[]
): GraphConnection[] {
  const connectionMap = new Map<string, GraphConnection>();

  connections.forEach(conn => {
    // Create a normalized key (smaller ID first)
    const [id1, id2] = [conn.source, conn.target].sort();
    const key = `${id1}-${id2}`;

    const existing = connectionMap.get(key);
    if (!existing || conn.correlation > existing.correlation) {
      // Keep the connection with higher correlation
      connectionMap.set(key, {
        source: id1,
        target: id2,
        correlation: conn.correlation,
        pressure: conn.pressure,
      });
    }
  });

  return Array.from(connectionMap.values());
}

/**
 * Filter connections based on criteria
 * @param connections - Array of GraphConnection objects
 * @param options - Filtering options
 * @returns Filtered array of connections
 */
export function filterConnections(
  connections: GraphConnection[],
  options?: {
    minCorrelation?: number;
    minPressure?: number;
    maxConnections?: number;
  }
): GraphConnection[] {
  let filtered = [...connections];

  // Apply filters
  if (options?.minCorrelation !== undefined) {
    const minCorrelation = options.minCorrelation;
    filtered = filtered.filter(c => c.correlation >= minCorrelation);
  }

  if (options?.minPressure !== undefined) {
    const minPressure = options.minPressure;
    filtered = filtered.filter(c => c.pressure >= minPressure);
  }

  // Sort by correlation (highest first) and limit
  if (options?.maxConnections !== undefined) {
    filtered.sort((a, b) => b.correlation - a.correlation);
    filtered = filtered.slice(0, options.maxConnections);
  }

  return filtered;
}

/**
 * Create an adjacency map from connections for quick neighbor lookups
 * @param connections - Array of GraphConnection objects
 * @returns Map of node ID to connected node IDs
 */
export function createAdjacencyMap(
  connections: GraphConnection[]
): Map<string, Set<string>> {
  const adjacencyMap = new Map<string, Set<string>>();

  connections.forEach(conn => {
    // Extract IDs from source and target (they could be strings or GraphNode objects)
    const sourceId = typeof conn.source === 'string' ? conn.source : conn.source.id;
    const targetId = typeof conn.target === 'string' ? conn.target : conn.target.id;

    // Add forward connection
    if (!adjacencyMap.has(sourceId)) {
      adjacencyMap.set(sourceId, new Set());
    }
    adjacencyMap.get(sourceId)!.add(targetId);

    // Add reverse connection (for undirected graph)
    if (!adjacencyMap.has(targetId)) {
      adjacencyMap.set(targetId, new Set());
    }
    adjacencyMap.get(targetId)!.add(sourceId);
  });

  return adjacencyMap;
}
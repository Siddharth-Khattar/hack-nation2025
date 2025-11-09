// ABOUTME: Transformation functions to convert backend Market objects to frontend GraphNode objects
// ABOUTME: Handles field mapping, volatility calculation, and group assignment

import type { Market } from '../api/types';
import type { GraphNode } from '@/types/graph';

/**
 * Hash function to generate consistent numeric value from string
 * @param str - String to hash
 * @returns Numeric hash value
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate volatility from price changes
 * @param dayChange - 1-day price change
 * @param weekChange - 7-day price change
 * @param monthChange - 30-day price change
 * @returns Normalized volatility value between 0 and 1
 */
function calculateVolatility(
  dayChange?: number | null,
  weekChange?: number | null,
  monthChange?: number | null
): number {
  // Filter out null/undefined values and get absolute values
  const changes = [dayChange, weekChange, monthChange]
    .filter((c): c is number => c !== null && c !== undefined)
    .map(c => Math.abs(c));

  if (changes.length === 0) return 0;

  // Use the maximum change as the volatility indicator
  const maxChange = Math.max(...changes);

  // Normalize to 0-1 range (50% change = max volatility)
  return Math.min(1, maxChange / 50);
}

/**
 * Assign group based on market properties
 * @param market - Market object
 * @returns Group number as string (0-9)
 */
function assignGroup(market: Market): string {
  // Strategy 1: Hash-based grouping using polymarket_id
  if (market.polymarket_id) {
    return (hashCode(market.polymarket_id) % 10).toString();
  }

  // Strategy 2: Volume-based grouping (fallback)
  const volumeTiers = [
    1000000000, // > $1B
    500000000,  // > $500M
    100000000,  // > $100M
    50000000,   // > $50M
    10000000,   // > $10M
    5000000,    // > $5M
    1000000,    // > $1M
    500000,     // > $500K
    100000,     // > $100K
    0,          // < $100K
  ];

  for (let i = 0; i < volumeTiers.length; i++) {
    if (market.volume >= volumeTiers[i]) {
      return (9 - i).toString();
    }
  }

  return '0';
}

/**
 * Transform a backend Market object to a frontend GraphNode
 * @param market - Market object from backend API
 * @returns GraphNode object for frontend visualization
 */
export function transformMarketToNode(market: Market): GraphNode {
  return {
    id: market.id.toString(),
    name: market.question,
    group: assignGroup(market),
    volatility: calculateVolatility(
      market.one_day_price_change,
      market.one_week_price_change,
      market.one_month_price_change
    ),
    lastUpdate: market.updated_at,
    ...(market.description && { description: market.description }),
    tags: market.tags || [],
    volume: market.volume,
    outcomes: market.outcomes,
    outcomePrices: market.outcome_prices,
  };
}

/**
 * Transform an array of Market objects to GraphNode array
 * @param markets - Array of Market objects
 * @returns Array of GraphNode objects
 */
export function transformMarketsToNodes(markets: Market[]): GraphNode[] {
  return markets.map(transformMarketToNode);
}

/**
 * Create a map of market IDs to GraphNodes for quick lookup
 * @param markets - Array of Market objects
 * @returns Map of market ID (string) to GraphNode
 */
export function createNodeMap(markets: Market[]): Map<string, GraphNode> {
  const nodeMap = new Map<string, GraphNode>();

  markets.forEach(market => {
    const node = transformMarketToNode(market);
    nodeMap.set(node.id, node);
  });

  return nodeMap;
}

/**
 * Filter and transform markets based on criteria
 * @param markets - Array of Market objects
 * @param options - Filtering options
 * @returns Filtered and transformed GraphNode array
 */
export function filterAndTransformMarkets(
  markets: Market[],
  options?: {
    minVolume?: number;
    isActive?: boolean;
    maxNodes?: number;
  }
): GraphNode[] {
  let filteredMarkets = [...markets];

  // Apply filters
  if (options?.minVolume !== undefined) {
    const minVolume = options.minVolume;
    filteredMarkets = filteredMarkets.filter(m => m.volume >= minVolume);
  }

  if (options?.isActive !== undefined) {
    filteredMarkets = filteredMarkets.filter(m => m.is_active === options.isActive);
  }

  // Sort by volume (highest first) and limit
  filteredMarkets.sort((a, b) => b.volume - a.volume);

  if (options?.maxNodes !== undefined) {
    filteredMarkets = filteredMarkets.slice(0, options.maxNodes);
  }

  return transformMarketsToNodes(filteredMarkets);
}
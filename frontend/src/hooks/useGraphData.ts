// ABOUTME: Main hook for fetching and managing graph data from the backend API
// ABOUTME: Handles loading states, error recovery, caching, and data transformation

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GraphData } from '@/types/graph';
import type { EnrichedRelatedMarket } from '@/lib/api/types';
import { getTopMarketsByVolume } from '@/lib/api/endpoints/markets';
import { getEnrichedRelatedMarkets } from '@/lib/api/endpoints/relations';
import { buildGraphFromEnrichedData, validateGraphData } from '@/lib/transforms/graphBuilder';
import { isApiError, isNetworkError, isTimeoutError } from '@/lib/api/errors';

/**
 * Configuration options for useGraphData hook
 */
interface UseGraphDataOptions {
  nodeLimit?: number;
  minSimilarity?: number;
  maxRelationsPerNode?: number;
  enableCache?: boolean;
  useMockData?: boolean;
  generateTrades?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * State returned by useGraphData hook
 */
interface UseGraphDataState {
  data: GraphData | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastFetchTime: Date | null;
  refetch: () => Promise<void>;
  retry: () => Promise<void>;
}

/**
 * Default options for the hook
 */
const DEFAULT_OPTIONS: Required<UseGraphDataOptions> = {
  nodeLimit: parseInt(process.env.NEXT_PUBLIC_MAX_NODES || '100', 10),
  minSimilarity: parseFloat(process.env.NEXT_PUBLIC_MIN_SIMILARITY || '0.7'),
  maxRelationsPerNode: parseInt(process.env.NEXT_PUBLIC_MAX_RELATIONS_PER_NODE || '10', 10),
  enableCache: true,
  useMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true',
  generateTrades: true,
  autoRefresh: false,
  refreshInterval: 60000, // 1 minute
};

/**
 * Cache for graph data
 */
const CACHE_TTL = parseInt(process.env.NEXT_PUBLIC_CACHE_TTL || '300000', 10); // 5 minutes
let cachedData: GraphData | null = null;
let cacheTimestamp: Date | null = null;

/**
 * Check if cached data is still valid
 */
function isCacheValid(): boolean {
  if (!cachedData || !cacheTimestamp) return false;
  const now = new Date();
  const elapsed = now.getTime() - cacheTimestamp.getTime();
  return elapsed < CACHE_TTL;
}

/**
 * Load mock data (fallback for development/testing)
 */
async function loadMockData(): Promise<GraphData> {
  try {
    // Dynamic import to avoid bundling when not needed
    const mockModule = await import('@/data/sample-100-nodes.json');
    const mockData = mockModule.default as GraphData;
    return validateGraphData(mockData);
  } catch (error) {
    console.error('Failed to load mock data:', error);
    throw new Error('Mock data not available');
  }
}

/**
 * Main hook for fetching and managing graph data
 * @param options - Configuration options
 * @returns Graph data state and control functions
 */
export function useGraphData(options?: UseGraphDataOptions): UseGraphDataState {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  const isMounted = useRef(true);
  const fetchAbortController = useRef<AbortController | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch graph data from API
   */
  const fetchGraphData = useCallback(async () => {
    // Cancel any ongoing fetch
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }

    // Create new abort controller
    fetchAbortController.current = new AbortController();

    try {
      // Use mock data if configured
      if (config.useMockData) {
        const mockData = await loadMockData();
        if (isMounted.current) {
          setData(mockData);
          setLastFetchTime(new Date());
          setIsStale(false);
        }
        return mockData;
      }

      // Check cache first
      if (config.enableCache && isCacheValid() && cachedData) {
        console.log('Using cached graph data');
        if (isMounted.current) {
          setData(cachedData);
          setLastFetchTime(cacheTimestamp);
          setIsStale(false);
        }
        return cachedData;
      }

      // Fetch markets
      console.log(`Fetching top ${config.nodeLimit} markets...`);
      const markets = await getTopMarketsByVolume(config.nodeLimit);

      if (!isMounted.current) return null;

      // Fetch relations for each market in parallel
      console.log('Fetching relations for markets...');
      const relationsPromises = markets.map(async market => {
        try {
          const response = await getEnrichedRelatedMarkets(market.id, {
            limit: config.maxRelationsPerNode,
            min_similarity: config.minSimilarity,
            ai_analysis: false, // Skip AI analysis for performance
          });

          return {
            marketId: market.id,
            relations: response.related_markets,
          };
        } catch (err) {
          console.warn(`Failed to fetch relations for market ${market.id}:`, err);
          return { marketId: market.id, relations: [] };
        }
      });

      const relationsResults = await Promise.all(relationsPromises);

      if (!isMounted.current) return null;

      // Build relations map
      const relationsMap = new Map<number, EnrichedRelatedMarket[]>();
      relationsResults.forEach(result => {
        relationsMap.set(result.marketId, result.relations);
      });

      // Build graph data
      const graphData = buildGraphFromEnrichedData(markets, relationsMap, {
        maxNodes: config.nodeLimit,
        minCorrelation: config.minSimilarity,
        generateTrades: config.generateTrades,
      });

      // Validate and set data
      const validatedData = validateGraphData(graphData);

      if (isMounted.current) {
        setData(validatedData);
        setLastFetchTime(new Date());
        setIsStale(false);

        // Update cache
        if (config.enableCache) {
          cachedData = validatedData;
          cacheTimestamp = new Date();
        }
      }

      return validatedData;
    } catch (err) {
      console.error('Failed to fetch graph data:', err);

      if (!isMounted.current) return null;

      // Handle different error types
      let errorMessage = 'Failed to load graph data';

      if (isTimeoutError(err)) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (isNetworkError(err)) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (isApiError(err)) {
        errorMessage = `API error: ${err.message}`;
      }

      const error = new Error(errorMessage);
      setError(error);
      throw error;
    }
  }, [
    config.useMockData,
    config.enableCache,
    config.nodeLimit,
    config.maxRelationsPerNode,
    config.minSimilarity,
    config.generateTrades,
  ]);

  /**
   * Refetch data (marks current data as stale first)
   */
  const refetch = useCallback(async () => {
    setIsStale(true);
    setError(null);

    try {
      await fetchGraphData();
    } catch {
      // Error already handled in fetchGraphData
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [fetchGraphData]);

  /**
   * Retry after error (clears error and retries)
   */
  const retry = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      await fetchGraphData();
    } catch {
      // Error already handled in fetchGraphData
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [fetchGraphData]);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
        await fetchGraphData();
      } catch {
        // Error already handled in fetchGraphData
      } finally {
        if (!isCancelled && isMounted.current) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - fetchGraphData is stable

  /**
   * Auto-refresh timer
   */
  useEffect(() => {
    if (config.autoRefresh && config.refreshInterval > 0) {
      refreshTimer.current = setInterval(() => {
        refetch();
      }, config.refreshInterval);

      return () => {
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
        }
      };
    }
  }, [config.autoRefresh, config.refreshInterval, refetch]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isMounted.current = false;

      // Cancel any ongoing fetch
      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
      }

      // Clear refresh timer
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, []);

  /**
   * Mark data as stale when cache expires
   */
  useEffect(() => {
    if (!config.enableCache || !lastFetchTime) return;

    const checkStaleness = () => {
      const now = new Date();
      const elapsed = now.getTime() - lastFetchTime.getTime();

      if (elapsed >= CACHE_TTL && !isStale) {
        setIsStale(true);
      }
    };

    const interval = setInterval(checkStaleness, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [config.enableCache, lastFetchTime, isStale]);

  return {
    data,
    loading,
    error,
    isStale,
    lastFetchTime,
    refetch,
    retry,
  };
}
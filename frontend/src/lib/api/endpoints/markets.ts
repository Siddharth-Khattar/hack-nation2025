// ABOUTME: Market-related API endpoint functions for fetching and searching markets
// ABOUTME: Provides typed wrappers around the market API endpoints

import { apiClient } from '../client';
import type {
  Market,
  MarketListResponse,
  MarketResponse,
  GetMarketsParams,
  SearchMarketsParams,
} from '../types';
import { isMarketListResponse } from '../types';
import { ValidationError } from '../errors';

/**
 * Fetch a list of markets with optional filtering
 * @param params - Query parameters for filtering and pagination
 * @returns Promise resolving to market list response
 */
export async function getMarkets(params?: GetMarketsParams): Promise<MarketListResponse> {
  const response = await apiClient.get<MarketListResponse>(
    '/api/markets/',
    { params: params ? { ...params } : undefined }
  );

  // Validate response structure
  if (!isMarketListResponse(response)) {
    throw new ValidationError('Invalid market list response structure');
  }

  return response;
}

/**
 * Fetch a single market by ID
 * @param marketId - Database ID of the market
 * @returns Promise resolving to market response
 */
export async function getMarket(marketId: number): Promise<Market> {
  const response = await apiClient.get<MarketResponse>(
    `/api/markets/${marketId}`
  );

  if (!response?.market) {
    throw new ValidationError('Invalid market response structure');
  }

  return response.market;
}

/**
 * Fetch a market by Polymarket ID
 * @param polymarketId - Polymarket ID of the market
 * @returns Promise resolving to market response
 */
export async function getMarketByPolymarketId(polymarketId: string): Promise<Market> {
  const response = await apiClient.get<MarketResponse>(
    `/api/markets/polymarket/${polymarketId}`
  );

  if (!response?.market) {
    throw new ValidationError('Invalid market response structure');
  }

  return response.market;
}

/**
 * Search markets by text query
 * @param params - Search parameters
 * @returns Promise resolving to market list response
 */
export async function searchMarkets(params: SearchMarketsParams): Promise<MarketListResponse> {
  const response = await apiClient.get<MarketListResponse>(
    '/api/markets/search/query',
    { params: { ...params } }
  );

  // Validate response structure
  if (!isMarketListResponse(response)) {
    throw new ValidationError('Invalid market search response structure');
  }

  return response;
}

/**
 * Get active markets
 * @param limit - Maximum number of results (default 100)
 * @returns Promise resolving to market list response
 */
export async function getActiveMarkets(limit: number = 100): Promise<MarketListResponse> {
  const response = await apiClient.get<MarketListResponse>(
    '/api/markets/filter/active',
    { params: { limit } }
  );

  // Validate response structure
  if (!isMarketListResponse(response)) {
    throw new ValidationError('Invalid active markets response structure');
  }

  return response;
}

/**
 * Get market statistics overview
 * @returns Promise resolving to market statistics
 */
export async function getMarketStats(): Promise<unknown> {
  return apiClient.get('/api/markets/stats/overview');
}

/**
 * Helper function to fetch top markets by volume
 * @param limit - Number of markets to fetch
 * @returns Promise resolving to array of markets
 */
export async function getTopMarketsByVolume(limit: number = 100): Promise<Market[]> {
  const response = await getMarkets({
    limit,
    is_active: true,
    order_by: 'volume',
    ascending: false,
  });

  return response.markets;
}

/**
 * Helper function to fetch all active markets with pagination
 * @param pageSize - Number of markets per page
 * @returns Promise resolving to array of all active markets
 */
export async function getAllActiveMarkets(pageSize: number = 100): Promise<Market[]> {
  const allMarkets: Market[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await getMarkets({
      limit: pageSize,
      offset,
      is_active: true,
      order_by: 'volume',
      ascending: false,
    });

    allMarkets.push(...response.markets);

    // Check if we've fetched all markets
    hasMore = response.markets.length === pageSize;
    offset += pageSize;

    // Safety limit to prevent infinite loops
    if (allMarkets.length >= 1000) {
      console.warn('Reached safety limit of 1000 markets');
      break;
    }
  }

  return allMarkets;
}

/**
 * Batch fetch multiple markets by IDs
 * @param marketIds - Array of market IDs to fetch
 * @returns Promise resolving to array of markets
 */
export async function getMarketsByIds(marketIds: number[]): Promise<Market[]> {
  // Note: Backend doesn't have a batch endpoint, so we need to fetch individually
  // This could be optimized if backend adds a batch endpoint
  const promises = marketIds.map(id => getMarket(id));

  try {
    const markets = await Promise.all(promises);
    return markets;
  } catch (error) {
    // Handle partial failures
    console.error('Some markets failed to load:', error);

    // Try to fetch markets one by one and skip failures
    const markets: Market[] = [];
    for (const id of marketIds) {
      try {
        const market = await getMarket(id);
        markets.push(market);
      } catch (err) {
        console.warn(`Failed to fetch market ${id}:`, err);
      }
    }
    return markets;
  }
}
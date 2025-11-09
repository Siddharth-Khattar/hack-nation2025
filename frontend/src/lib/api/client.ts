// ABOUTME: Base HTTP client with interceptors, retry logic, and error handling
// ABOUTME: Provides a robust foundation for all API calls with timeout and retry capabilities

import {
  ApiError,
  NetworkError,
  TimeoutError,
  createApiError,
} from './errors';
import type { HTTPValidationError } from './types';
import { isHTTPValidationError } from './types';

/**
 * Configuration for API client
 */
interface ClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: HeadersInit;
}

/**
 * Request options for API calls
 */
interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>; // Typed params
  timeout?: number;
  retries?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<ClientConfig> = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hacknation-backend-1094178237774.europe-west1.run.app',
  timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000', 10),
  retries: 3,
  retryDelay: 1000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

/**
 * API Client class for making HTTP requests
 */
export class ApiClient {
  private config: Required<ClientConfig>;

  constructor(config?: ClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build URL with query parameters
   */
  private buildURL(endpoint: string, params?: RequestOptions['params']): string {
    const url = new URL(endpoint, this.config.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Create abort controller with timeout
   */
  private createAbortController(timeout?: number): AbortController {
    const controller = new AbortController();
    const timeoutMs = timeout || this.config.timeout;

    setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    return controller;
  }

  /**
   * Sleep for exponential backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private getRetryDelay(attempt: number): number {
    return Math.min(this.config.retryDelay * Math.pow(2, attempt), 30000);
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(
    url: string,
    options: RequestOptions,
    attempt: number = 0
  ): Promise<T> {
    const controller = this.createAbortController(options.timeout);
    const maxRetries = options.retries !== undefined ? options.retries : this.config.retries;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.config.headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      // Parse response body
      let data: unknown;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle error responses
      if (!response.ok) {
        // Check for validation errors
        if (response.status === 422 && isHTTPValidationError(data)) {
          const validationError = data as HTTPValidationError;
          const errorDetails = validationError.detail.map(d => ({
            field: d.loc.join('.'),
            error: d.msg,
          }));
          throw createApiError(
            response,
            'Validation failed',
            errorDetails
          );
        }

        throw createApiError(
          response,
          `Request failed with status ${response.status}`,
          data
        );
      }

      return data as T;
    } catch (error) {
      // Handle abort/timeout
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(
            `Request timed out after ${options.timeout || this.config.timeout}ms`,
            options.timeout || this.config.timeout
          );
        }
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network request failed', error);
      }

      // Retry on certain errors
      const shouldRetry = attempt < maxRetries &&
        (error instanceof NetworkError ||
         error instanceof TimeoutError ||
         (error instanceof ApiError && error.statusCode && error.statusCode >= 500));

      if (shouldRetry) {
        const delay = this.getRetryDelay(attempt);
        console.warn(`Retrying request after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await this.sleep(delay);
        return this.makeRequest<T>(url, options, attempt + 1);
      }

      // Re-throw error if not retrying
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    return this.makeRequest<T>(url, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    return this.makeRequest<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    return this.makeRequest<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    return this.makeRequest<T>(url, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    return this.makeRequest<T>(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();

/**
 * Create a custom API client instance
 */
export function createApiClient(config?: ClientConfig): ApiClient {
  return new ApiClient(config);
}
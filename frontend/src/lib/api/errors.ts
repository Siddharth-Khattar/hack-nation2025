// ABOUTME: Custom error classes for API error handling and standardization
// ABOUTME: Provides typed errors for network failures, validation errors, and API responses

/**
 * Base class for all API-related errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Error thrown when network request fails (timeout, connection refused, etc.)
 */
export class NetworkError extends ApiError {
  constructor(message: string, public originalError?: unknown) {
    super(message, undefined, originalError);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Error thrown when API returns 4xx status codes
 */
export class ClientError extends ApiError {
  constructor(message: string, statusCode: number, details?: unknown) {
    super(message, statusCode, details);
    this.name = 'ClientError';
    Object.setPrototypeOf(this, ClientError.prototype);
  }
}

/**
 * Error thrown when API returns 5xx status codes
 */
export class ServerError extends ApiError {
  constructor(message: string, statusCode: number, details?: unknown) {
    super(message, statusCode, details);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Error thrown when API response validation fails
 */
export class ValidationError extends ApiError {
  constructor(
    message: string,
    public validationErrors?: Array<{ field: string; error: string }>
  ) {
    super(message, 422, validationErrors);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when request times out
 */
export class TimeoutError extends NetworkError {
  constructor(message = 'Request timed out', public timeoutMs?: number) {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Helper function to create appropriate error based on response
 */
export function createApiError(
  response?: Response,
  message?: string,
  details?: unknown
): ApiError {
  if (!response) {
    return new NetworkError(message || 'Network request failed', details);
  }

  const statusCode = response.status;
  const errorMessage = message || `API request failed with status ${statusCode}`;

  if (statusCode >= 500) {
    return new ServerError(errorMessage, statusCode, details);
  } else if (statusCode >= 400) {
    return new ClientError(errorMessage, statusCode, details);
  } else {
    return new ApiError(errorMessage, statusCode, details);
  }
}

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Type guard to check if error is a NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Type guard to check if error is a TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Type guard to check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
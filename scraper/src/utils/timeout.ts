/**
 * Centralized timeout utilities for the scraper.
 */

import { config } from "./config.js";

/**
 * Creates a promise that rejects after the specified timeout.
 */
export function createTimeout(ms: number, operation: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
  );
}

/**
 * Creates an AbortSignal that aborts after the specified timeout.
 */
export function createAbortSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * Wraps a fetch call with a timeout using AbortSignal.
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const signal = createAbortSignal(config.fetchTimeoutMs);
  return fetch(url, { ...options, signal });
}

/**
 * Wraps a promise with a timeout, rejecting if the timeout is reached first.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  return Promise.race([promise, createTimeout(ms, operation)]);
}

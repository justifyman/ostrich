export interface RetryOptions {
  attempts: number;
  initialDelayMs: number;
  operationName: string;
  onRetry?: (details: {
    attempt: number;
    delayMs: number;
    error: unknown;
  }) => void;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts) break;

      const delayMs = options.initialDelayMs * 2 ** (attempt - 1);
      options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${options.operationName} failed after ${options.attempts} attempts`);
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

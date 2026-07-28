/** Thin fetch wrapper shared by every service. Keeps components API-free. */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions extends RequestInit {
  /** Abort after this many ms so the UI never hangs on a slow provider. */
  timeoutMs?: number;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function apiGet<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 8000, query, ...init } = options;
  const target = new URL(url);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) target.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target.toString(), {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...init.headers },
    });
    if (!response.ok) {
      throw new ApiError(`Request failed: ${response.statusText}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error instanceof Error ? error.message : "Network error");
  } finally {
    clearTimeout(timer);
  }
}

/** Runs a live call and silently falls back to a deterministic estimate. */
export async function withFallback<T>(
  live: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    return await live();
  } catch {
    return fallback();
  }
}

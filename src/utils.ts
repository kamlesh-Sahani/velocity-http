// ─────────────────────────────────────────────────────────────────────────────
//  Velocity – Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a full URL by appending serialised query params.
 *
 * - Skips null / undefined values.
 * - Arrays expand to repeated keys: { ids: [1,2] } → ?ids=1&ids=2
 * - Existing query strings in `url` are preserved.
 */
export function buildURL(
  url: string = "",
  params?: Record<string, any>,
): string {
  if (!params || Object.keys(params).length === 0) return url;

  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        qs.append(key, String(v));
      });
    } else {
      qs.set(key, String(value));
    }
  }

  const queryString = qs.toString();
  if (!queryString) return url;

  return url.includes("?") ? `${url}&${queryString}` : `${url}?${queryString}`;
}

/**
 * Returns `true` only when `value` is a plain, non-empty object.
 * Arrays, null and class instances all return `false`.
 */
export function isNonEmptyObject(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as object).length > 0
  );
}

/**
 * Joins a base URL and a path, normalising duplicate slashes at the join.
 */
export function joinURL(base: string, path: string): string {
  return base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
}

/**
 * Returns a Promise that resolves after `ms` milliseconds.
 * Immediately rejects with an AbortError when the optional signal fires,
 * so delayed polls/retries don't block cancellation.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Sleep aborted", "AbortError"));
      return;
    }

    const id = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Sleep aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Safely serialises a value to a JSON string.
 * Returns the original value unchanged if serialisation throws.
 */
export function safeStringify(value: unknown): string | unknown {
  try {
    return JSON.stringify(value);
  } catch {
    return value;
  }
}

/**
 * Safely parses a JSON string.
 * Returns the raw string on failure instead of throwing.
 */
export function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

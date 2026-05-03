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

/** Parses the response body according to `responseType` or Content-Type. */
export async function parseBody<T>(res: Response, config: any) {
  const { responseType } = config;

  if (responseType === "blob") return res.blob() as Promise<T>;
  if (responseType === "arrayBuffer") return res.arrayBuffer() as Promise<T>;
  if (responseType === "text") return res.text() as Promise<T>;

  // json or auto-detect
  const text = await res.text();

  if (text.trim() === "") return null as T;

  const contentType = res.headers.get("content-type") ?? "";
  const isJson =
    responseType === "json" ||
    (!responseType && contentType.includes("application/json"));

  if (isJson) {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  return text as unknown as T;
}

/** Serialises `data` to a fetch-compatible body. */
export function prepareBody(data: any): BodyInit | undefined {
  if (data === undefined || data === null) return undefined;
  
  if (typeof FormData !== "undefined" && data instanceof FormData) return data;
  if (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams) return data;
  if (data instanceof ArrayBuffer) return data;
  if (typeof Blob !== "undefined" && data instanceof Blob) return data;

  if (typeof data === "object") {
    try {
      return JSON.stringify(data);
    } catch (err) {
      console.warn("[Velocity] Could not serialise body:", err);
      return data;
    }
  }
  return data;
}

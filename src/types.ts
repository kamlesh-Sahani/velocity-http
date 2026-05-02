// ─────────────────────────────────────────────────────────────────────────────
//  Velocity – Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type Method =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export type ResponseType = "json" | "text" | "blob" | "arrayBuffer";

// ── Polling ───────────────────────────────────────────────────────────────────

export interface PollOptions<T = any> {
  /**
   * Milliseconds to wait between each poll attempt.
   * @default 1000
   */
  interval: number;

  /**
   * Called after every successful response.
   * Return `true` to stop polling — condition has been met.
   * Return `false` to keep polling.
   */
  validate: (
    data: T,
    response: VelocityResponse<T>,
    attempt: number,
  ) => boolean | Promise<boolean>;

  /**
   * Hard cap on total attempts. Polling stops after this many tries
   * even if `validate` never returns `true`.
   * @default 10
   */
  maxAttempts?: number;
}

// ── Retry ─────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /**
   * Number of retry attempts on failure.
   * @default 0
   */
  attempts: number;

  /**
   * Milliseconds to wait between retries.
   * @default 0
   */
  delay?: number;

  /**
   * HTTP status codes that should trigger a retry.
   * @default [408, 429, 500, 502, 503, 504]
   */
  statuses?: number[];

  /**
   * Custom predicate — return `true` to retry this response.
   * When provided, takes precedence over `statuses`.
   */
  shouldRetry?: (response: VelocityResponse, attempt: number) => boolean;
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface VelocityConfig<T = any> extends Omit<
  RequestInit,
  "method" | "headers" | "signal"
> {
  /** Prepended to every relative URL. */
  baseURL?: string;

  /** Request URL — relative or absolute. */
  url?: string;

  /** HTTP method. */
  method?: Method;

  /** Request headers. */
  headers?: HeadersInit;

  /** URL query parameters. Arrays expand to repeated keys. */
  params?: Record<
    string,
    string | number | boolean | (string | number | boolean)[]
  >;

  /** Request timeout in milliseconds. @default 30000 */
  timeout?: number;

  /** How the response body should be parsed. Defaults to auto-detect via Content-Type. */
  responseType?: ResponseType;

  /** External AbortSignal for manual cancellation. */
  signal?: AbortSignal;

  /** Polling configuration. */
  poll?: PollOptions<T>;

  /** Retry configuration. */
  retry?: RetryOptions;

  /** Attach cookies to cross-origin requests. */
  withCredentials?: boolean;

  /** Arbitrary metadata passed through to hooks. */
  meta?: Record<string, any>;
}

// ── Response ──────────────────────────────────────────────────────────────────

export interface VelocityResponse<T = any> {
  /** Parsed response body. */
  data: T;

  /** HTTP status code. */
  status: number;

  /** HTTP status text. */
  statusText: string;

  /** Response headers. */
  headers: Headers;

  /** The config used for this request. */
  config: VelocityConfig<T>;

  /** `true` when status is in the 200–299 range. */
  ok: boolean;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export type RequestHook = (
  config: VelocityConfig,
) => VelocityConfig | Promise<VelocityConfig>;

export type ResponseHook = (
  response: VelocityResponse,
) => VelocityResponse | Promise<VelocityResponse>;

// ── Errors ────────────────────────────────────────────────────────────────────

export type VelocityErrorKind =
  | "TimeoutError"
  | "CancelError"
  | "NetworkError"
  | "HTTPError"
  | "PollingError"
  | "RetryError";

export class VelocityError extends Error {
  public readonly kind: VelocityErrorKind;
  public readonly config: VelocityConfig;
  public readonly response?: VelocityResponse;
  public readonly attempt?: number;

  constructor(
    kind: VelocityErrorKind,
    message: string,
    config: VelocityConfig,
    response?: VelocityResponse,
    attempt?: number,
  ) {
    super(message);
    this.name = kind;
    this.kind = kind;
    this.config = config;
    this.response = response;
    this.attempt = attempt;

    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

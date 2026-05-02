// ─────────────────────────────────────────────────────────────────────────────
//  Velocity – Core HTTP Client
// ─────────────────────────────────────────────────────────────────────────────

import {
  VelocityConfig,
  VelocityResponse,
  VelocityError,
  RequestHook,
  ResponseHook,
  PollOptions,
  RetryOptions,
} from "../types";
import { buildURL, isNonEmptyObject, joinURL, sleep } from "../utils";

// Default retry-able status codes
const DEFAULT_RETRY_STATUSES = [408, 429, 500, 502, 503, 504];
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_POLL_INTERVAL = 1_000;
const DEFAULT_RETRY_DELAY = 0;

export class Velocity {
  // ── Instance state ──────────────────────────────────────────────────────────

  public config: VelocityConfig;

  /** True while a polling sequence is running. */
  private _pollingBusy = false;

  /** AbortController that cancels the active polling sequence. */
  private _pollingAC?: AbortController;

  /** Ordered list of request interceptors. */
  private _requestHooks: RequestHook[] = [];

  /** Ordered list of response interceptors. */
  private _responseHooks: ResponseHook[] = [];

  // ── Constructor ─────────────────────────────────────────────────────────────

  constructor(config: VelocityConfig = {}) {
    this.config = {
      headers: { "Content-Type": "application/json" },
      ...config,
    };
  }

  // ── Interceptors ────────────────────────────────────────────────────────────

  /**
   * Registers a request interceptor.
   * Interceptors run in registration order before every request.
   * Returns an object with an `eject()` method to remove the hook.
   */
  onRequest(hook: RequestHook): { eject: () => void } {
    this._requestHooks.push(hook);
    return {
      eject: () => {
        this._requestHooks = this._requestHooks.filter((h) => h !== hook);
      },
    };
  }

  /**
   * Registers a response interceptor.
   * Interceptors run in registration order after every successful response.
   * Returns an object with an `eject()` method to remove the hook.
   */
  onResponse(hook: ResponseHook): { eject: () => void } {
    this._responseHooks.push(hook);
    return {
      eject: () => {
        this._responseHooks = this._responseHooks.filter((h) => h !== hook);
      },
    };
  }

  // ── Polling control ─────────────────────────────────────────────────────────

  /**
   * Cancels an active polling sequence.
   * Safe to call when no polling is in progress.
   */
  cancelPolling(): void {
    if (this._pollingAC) {
      this._pollingAC.abort();
      this._pollingAC = undefined;
      this._pollingBusy = false;
    }
  }

  // ── Core request ────────────────────────────────────────────────────────────

  async request<T = any>(
    config: VelocityConfig<T>,
  ): Promise<VelocityResponse<T>> {
    const isPolling = isNonEmptyObject(config?.poll);

    // Guard against concurrent polling
    if (isPolling && this._pollingBusy) {
      throw new VelocityError(
        "PollingError",
        "A polling request is already in progress. Call cancelPolling() first.",
        config,
      );
    }

    if (isPolling) {
      this._pollingBusy = true;
      this._pollingAC = new AbortController();
    }

    try {
      return await this._executeWithRetry<T>(config, isPolling);
    } finally {
      if (isPolling) {
        this._pollingBusy = false;
        this._pollingAC = undefined;
      }
    }
  }

  // ── Retry wrapper ───────────────────────────────────────────────────────────

  private async _executeWithRetry<T>(
    config: VelocityConfig<T>,
    isPolling: boolean,
  ): Promise<VelocityResponse<T>> {
    const retry = config.retry ?? this.config.retry;
    const maxRetries = retry?.attempts ?? 0;
    const retryDelay = retry?.delay ?? DEFAULT_RETRY_DELAY;
    const retryStatuses = retry?.statuses ?? DEFAULT_RETRY_STATUSES;

    let attempt = 0;

    while (true) {
      attempt++;

      try {
        const response = await this._executeSingle<T>(
          config,
          isPolling,
          attempt,
        );

        // Check whether this response should be retried
        if (attempt <= maxRetries) {
          const shouldRetry = retry?.shouldRetry
            ? retry.shouldRetry(response, attempt)
            : retryStatuses.includes(response.status);

          if (shouldRetry) {
            if (retryDelay > 0) {
              await sleep(retryDelay, config.signal);
            }
            continue; // retry
          }
        }

        return response;
      } catch (err: any) {
        // Do not retry cancellations or user-aborts
        const isCancelOrTimeout =
          err instanceof VelocityError &&
          (err.kind === "CancelError" || err.kind === "TimeoutError");

        if (isCancelOrTimeout || attempt > maxRetries) {
          throw err;
        }

        // Network-level error — wait then retry
        if (retryDelay > 0) {
          await sleep(retryDelay, config.signal);
        }
      }
    }
  }

  // ── Single fetch attempt ────────────────────────────────────────────────────

  private async _executeSingle<T>(
    config: VelocityConfig<T>,
    isPolling: boolean,
    _attempt: number,
  ): Promise<VelocityResponse<T>> {
    // ── 1. Merge configs ──────────────────────────────────────────────────────

    const mergedHeaders = this._mergeHeaders(
      this.config.headers,
      config.headers,
    );

    const { headers: _h, signal: _s, ...restConfig } = config;
    let mergedConfig: VelocityConfig<T> = {
      ...this.config,
      ...restConfig,
      headers: mergedHeaders,
    };

    if (mergedConfig.withCredentials) {
      mergedConfig.credentials = "include";
    }

    // ── 2. Run request interceptors ───────────────────────────────────────────

    for (const hook of this._requestHooks) {
      try {
        mergedConfig = (await hook(mergedConfig)) as VelocityConfig<T>;
      } catch (hookErr) {
        throw new VelocityError(
          "NetworkError",
          `Request interceptor threw: ${(hookErr as Error).message}`,
          mergedConfig,
        );
      }
    }

    // ── 3. Build URL ──────────────────────────────────────────────────────────

    const { baseURL, url = "", params } = mergedConfig;
    const rawUrl =
      baseURL && !url.startsWith("http") ? joinURL(baseURL, url) : url;
    const finalUrl = buildURL(rawUrl, params);

    // ── 4. Compose abort signal ───────────────────────────────────────────────

    const { signal: externalSignal } = config;
    const timeoutMs = mergedConfig.timeout ?? DEFAULT_TIMEOUT_MS;

    // Combine: timeout  +  user signal  +  polling cancel signal
    const signals: AbortSignal[] = [];

    const timeoutAC = new AbortController();
    const timeoutId = setTimeout(
      () =>
        timeoutAC.abort(
          new VelocityError(
            "TimeoutError",
            `Request timed out after ${timeoutMs}ms`,
            mergedConfig,
          ),
        ),
      timeoutMs,
    );
    signals.push(timeoutAC.signal);

    if (externalSignal) signals.push(externalSignal);
    if (isPolling && this._pollingAC) signals.push(this._pollingAC.signal);

    const combinedSignal =
      signals.length > 1
        ? AbortSignal.any(signals) // native; available in all modern browsers / Node 20+
        : signals[0];

    // ── 5. Fetch ──────────────────────────────────────────────────────────────

    let res: Response;

    try {
      res = await fetch(finalUrl, {
        ...mergedConfig,
        signal: combinedSignal,
      } as RequestInit);
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError" || err instanceof VelocityError) {
        // Figure out which signal fired
        if (timeoutAC.signal.aborted) {
          throw new VelocityError(
            "TimeoutError",
            `Request timed out after ${timeoutMs}ms`,
            mergedConfig,
          );
        }
        if (externalSignal?.aborted) {
          throw new VelocityError(
            "CancelError",
            "Request was cancelled",
            mergedConfig,
          );
        }
        if (this._pollingAC?.signal.aborted) {
          throw new VelocityError(
            "CancelError",
            "Polling was cancelled",
            mergedConfig,
          );
        }
      }

      throw new VelocityError(
        "NetworkError",
        err.message ?? "Network request failed",
        mergedConfig,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // ── 6. Parse body ─────────────────────────────────────────────────────────

    const data = await this._parseBody<T>(res, mergedConfig);

    // ── 7. Build response object ──────────────────────────────────────────────

    let response: VelocityResponse<T> = {
      data,
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      config: mergedConfig,
      ok: res.ok,
    };

    // ── 8. Run response interceptors ──────────────────────────────────────────

    for (const hook of this._responseHooks) {
      try {
        response = (await hook(response)) as VelocityResponse<T>;
      } catch (hookErr) {
        // Log but don't swallow — the response is still returned
        console.warn("[Velocity] Response interceptor threw:", hookErr);
      }
    }

    // ── 9. Throw on HTTP errors (non-2xx) ─────────────────────────────────────

    if (!res.ok) {
      throw new VelocityError(
        "HTTPError",
        `HTTP ${res.status}: ${res.statusText}`,
        mergedConfig,
        response,
      );
    }

    // ── 10. Polling loop ───────────────────────────────────────────────────────

    if (isNonEmptyObject(mergedConfig.poll)) {
      return this._poll<T>(mergedConfig, response, 1);
    }

    return response;
  }

  // ── Polling loop ────────────────────────────────────────────────────────────

  private async _poll<T>(
    config: VelocityConfig<T>,
    firstResponse: VelocityResponse<T>,
    attempt: number,
  ): Promise<VelocityResponse<T>> {
    const poll = config.poll as PollOptions<T>;
    const {
      validate,
      interval = DEFAULT_POLL_INTERVAL,
      maxAttempts = DEFAULT_MAX_ATTEMPTS,
    } = poll;

    let currentResponse = firstResponse;
    let currentAttempt = attempt;

    while (true) {
      // Check stop condition
      let isDone = false;
      try {
        isDone = await validate(
          currentResponse.data,
          currentResponse,
          currentAttempt,
        );
      } catch (validateErr) {
        throw new VelocityError(
          "PollingError",
          `Poll validate threw on attempt ${currentAttempt}: ${(validateErr as Error).message}`,
          config,
          currentResponse,
          currentAttempt,
        );
      }

      if (isDone) return currentResponse;

      if (currentAttempt >= maxAttempts) {
        throw new VelocityError(
          "PollingError",
          `Polling exceeded maxAttempts (${maxAttempts})`,
          config,
          currentResponse,
          currentAttempt,
        );
      }

      // Wait — respects polling cancellation
      const cancelSignal = this._pollingAC?.signal;
      await sleep(interval, cancelSignal);

      // Re-fetch
      currentAttempt++;
      currentResponse = await this._executeSingle<T>(
        config,
        true,
        currentAttempt,
      );
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Merges two HeadersInit values, with `override` winning on conflicts. */
  private _mergeHeaders(base?: HeadersInit, override?: HeadersInit): Headers {
    const merged = new Headers(base);
    if (override) {
      new Headers(override).forEach((value, key) => {
        merged.set(key, value);
      });
    }
    return merged;
  }

  /** Parses the response body according to `responseType` or Content-Type. */
  private async _parseBody<T>(
    res: Response,
    config: VelocityConfig<T>,
  ): Promise<T> {
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
  private _prepareBody(data: any): BodyInit | undefined {
    if (data === undefined || data === null) return undefined;
    if (typeof FormData !== "undefined" && data instanceof FormData) {
      return data;
    }
    if (
      typeof URLSearchParams !== "undefined" &&
      data instanceof URLSearchParams
    ) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return data;
    }
    if (typeof Blob !== "undefined" && data instanceof Blob) {
      return data;
    }

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

  // ── HTTP convenience methods ────────────────────────────────────────────────

  get = <T = any>(
    url: string,
    config?: VelocityConfig<T>,
  ): Promise<VelocityResponse<T>> =>
    this.request<T>({ ...config, method: "GET", url });

  post = <T = any>(
    url: string,
    data?: any,
    config?: VelocityConfig<T>,
  ): Promise<VelocityResponse<T>> =>
    this.request<T>({
      ...config,
      method: "POST",
      url,
      body: this._prepareBody(data),
    });

  put = <T = any>(
    url: string,
    data?: any,
    config?: VelocityConfig<T>,
  ): Promise<VelocityResponse<T>> =>
    this.request<T>({
      ...config,
      method: "PUT",
      url,
      body: this._prepareBody(data),
    });

  patch = <T = any>(
    url: string,
    data?: any,
    config?: VelocityConfig<T>,
  ): Promise<VelocityResponse<T>> =>
    this.request<T>({
      ...config,
      method: "PATCH",
      url,
      body: this._prepareBody(data),
    });

  delete = <T = any>(
    url: string,
    config?: VelocityConfig<T>,
  ): Promise<VelocityResponse<T>> =>
    this.request<T>({ ...config, method: "DELETE", url });

  head = <T = any>(
    url: string,
    config?: VelocityConfig<T>,
  ): Promise<VelocityResponse<T>> =>
    this.request<T>({ ...config, method: "HEAD", url });

  options = <T = any>(
    url: string,
    config?: VelocityConfig<T>,
  ): Promise<VelocityResponse<T>> =>
    this.request<T>({ ...config, method: "OPTIONS", url });
}

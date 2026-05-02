import {
  VelocityConfig,
  VelocityResponse,
  RequestHook,
  ResponseHook,
  PollOptions,
} from "../types";
import { buildURL, isNotEmptObject } from "../utils";

export class Velocity {
  public config: VelocityConfig;
  private isBusy = false;
  private _onRequest?: RequestHook;
  private _onResponse?: ResponseHook;
  private pollingAbortController?: AbortController;

  constructor(config: VelocityConfig = {}) {
    this.config = {
      headers: { "Content-Type": "application/json" },
      ...config,
    };
  }

  onRequest(hook: RequestHook) {
    this._onRequest = hook;
  }

  onResponse(hook: ResponseHook) {
    this._onResponse = hook;
  }

  // Method to cancel ongoing polling
  cancelPolling() {
    if (this.pollingAbortController) {
      this.pollingAbortController.abort();
      this.pollingAbortController = undefined;
      this.isBusy = false;
    }
  }

  async request<T = any>(config: VelocityConfig): Promise<VelocityResponse<T>> {
    const isPolling = isNotEmptObject(config?.poll);

    if (isPolling && this.isBusy) {
      throw new Error("Polling request already in progress");
    }

    if (isPolling) {
      this.isBusy = true;
      this.pollingAbortController = new AbortController();
    }

    let abortHandler: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      let attempts = 0;
      let shouldStop = false;

      // Listen for polling cancellation
      if (isPolling && this.pollingAbortController) {
        this.pollingAbortController.signal.addEventListener("abort", () => {
          shouldStop = true;
        });
      }

      const execute = async (): Promise<VelocityResponse<T>> => {
        // Check for cancellation
        if (shouldStop) {
          throw new Error("Polling cancelled");
        }

        attempts++;

        // Merge headers properly
        const mergedHeaders = new Headers(this.config?.headers);
        if (config.headers) {
          const requestHeaders = new Headers(config.headers);
          requestHeaders.forEach((value, key) => {
            mergedHeaders.set(key, value);
          });
        }

        const { headers, ...restConfig } = config;
        let mergedConfig: VelocityConfig = {
          ...this.config,
          ...restConfig,
          headers: mergedHeaders,
        };

        if (mergedConfig.withCredentials) {
          mergedConfig.credentials = "include";
        }

        // Run request hook with error handling
        if (this._onRequest) {
          try {
            mergedConfig = await this._onRequest(mergedConfig);
          } catch (error) {
            console.error("Request hook failed:", error);
            throw error;
          }
        }

        // Setup abort controller with timeout
        const controller = new AbortController();
        timeoutId = setTimeout(
          () => controller.abort(),
          mergedConfig.timeout || 50000,
        );

        // Handle external signal with cleanup
        if (mergedConfig.signal) {
          if (mergedConfig.signal.aborted) {
            controller.abort();
          } else {
            abortHandler = () => controller.abort();
            mergedConfig.signal.addEventListener("abort", abortHandler);
          }
        }

        // Handle polling cancellation signal
        if (isPolling && this.pollingAbortController) {
          const pollingAbortHandler = () => controller.abort();
          this.pollingAbortController.signal.addEventListener(
            "abort",
            pollingAbortHandler,
          );
        }

        try {
          const { baseURL, url = "", params } = mergedConfig;
          let rawUrl = url;
          if (baseURL && !url.startsWith("http")) {
            rawUrl = baseURL.replace(/\/$/, "") + "/" + url.replace(/^\//, "");
          }
          const finalUrl = buildURL(rawUrl, params);
          const res = await fetch(finalUrl, {
            ...mergedConfig,
            signal: controller.signal,
          } as RequestInit);

          // Clear timeout as request completed
          clearTimeout(timeoutId!);
          timeoutId = null;

          // Parse response data efficiently
          let data: any;
          const contentType = res.headers.get("content-type");

          if (mergedConfig.responseType === "blob") {
            data = await res.blob();
          } else if (mergedConfig.responseType === "arrayBuffer") {
            data = await res.arrayBuffer();
          } else if (mergedConfig.responseType === "text") {
            data = await res.text();
          } else {
            // Default to JSON parsing with fallback to text
            const text = await res.text();
            if (text.trim() === "") {
              data = null;
            } else if (
              mergedConfig.responseType === "json" ||
              (contentType?.includes("application/json") &&
                !mergedConfig.responseType)
            ) {
              try {
                data = JSON.parse(text);
              } catch {
                data = text; // Fallback to text if JSON parsing fails
              }
            } else {
              data = text;
            }
          }

          let response: VelocityResponse<T> = {
            data,
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
            config: mergedConfig,
          } as VelocityResponse<T>;

          // Run response hook with error handling
          if (this._onResponse) {
            try {
              response = await this._onResponse(response);
            } catch (error) {
              console.error("Response hook failed:", error);
              // Continue with original response
            }
          }

          // Handle polling logic
          const { poll } = mergedConfig;
          if (isNotEmptObject(poll) && !shouldStop) {
            const pollOptions = poll as PollOptions;
            const { validate, interval, maxAttempts = 10 } = pollOptions;

            // Validate if polling should stop
            let isDone = false;
            if (typeof validate === "function") {
              try {
                isDone = await validate(data, response, attempts);
              } catch (error) {
                console.error("Poll validate function failed:", error);
                isDone = true; // Stop polling on error
              }
            }

            const reachedLimit = maxAttempts && attempts >= maxAttempts;

            if (!isDone && !reachedLimit) {
              await new Promise((resolve) => setTimeout(resolve, interval));
              return execute(); // Recursive poll
            }
          }

          return response;
        } catch (error) {
          clearTimeout(timeoutId!);
          timeoutId = null;
          throw error;
        } finally {
          // Clean up abort handler
          if (abortHandler && mergedConfig?.signal) {
            mergedConfig.signal.removeEventListener("abort", abortHandler);
            abortHandler = null;
          }
        }
      };

      return await execute();
    } finally {
      if (isPolling) {
        this.isBusy = false;
        if (this.pollingAbortController) {
          this.pollingAbortController = undefined;
        }
      }
      // Final cleanup
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  get = <T = any>(
    url: string,
    config?: VelocityConfig,
  ): Promise<VelocityResponse<T>> => {
    return this.request<T>({ ...config, method: "GET", url });
  }

  private prepareBody(data: any): any {
    if (data === undefined || data === null) return undefined;
    if (typeof FormData !== "undefined" && data instanceof FormData)
      return data;
    if (
      typeof URLSearchParams !== "undefined" &&
      data instanceof URLSearchParams
    )
      return data;
    if (typeof data === "object") {
      try {
        return JSON.stringify(data);
      } catch (error) {
        console.error("Failed to stringify body:", error);
        return data;
      }
    }
    return data;
  }

  post = <T = any>(
    url: string,
    data?: any,
    config?: VelocityConfig,
  ): Promise<VelocityResponse<T>> => {
    return this.request<T>({
      ...config,
      method: "POST",
      url,
      body: this.prepareBody(data),
    });
  }

  put = <T = any>(
    url: string,
    data?: any,
    config?: VelocityConfig,
  ): Promise<VelocityResponse<T>> => {
    return this.request<T>({
      ...config,
      method: "PUT",
      url,
      body: this.prepareBody(data),
    });
  }

  patch = <T = any>(
    url: string,
    data?: any,
    config?: VelocityConfig,
  ): Promise<VelocityResponse<T>> => {
    return this.request<T>({
      ...config,
      method: "PATCH",
      url,
      body: this.prepareBody(data),
    });
  }

  delete = <T = any>(
    url: string,
    config?: VelocityConfig,
  ): Promise<VelocityResponse<T>> => {
    return this.request<T>({ ...config, method: "DELETE", url });
  }

  head = <T = any>(
    url: string,
    config?: VelocityConfig,
  ): Promise<VelocityResponse<T>> => {
    return this.request<T>({ ...config, method: "HEAD", url });
  }

  options = <T = any>(
    url: string,
    config?: VelocityConfig,
  ): Promise<VelocityResponse<T>> => {
    return this.request<T>({ ...config, method: "OPTIONS", url });
  }
}

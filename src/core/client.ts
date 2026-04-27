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

  async request<T = any>(
    config: VelocityConfig,
  ): Promise<VelocityResponse<T> | any> {
    const isPolling = isNotEmptObject(config.poll);

    if (isPolling && this.isBusy) return;
    if (isPolling) this.isBusy = true;

    try {
      let attempts = 0;

      const execute = async (): Promise<VelocityResponse<T>> => {
        attempts++;

        const { headers = {}, ...restConfig } = config;
        let mergedConfig: VelocityConfig = {
          ...this.config,
          ...restConfig,
          headers: { ...(this.config?.headers || {}), ...headers },
        };

        // Run request hook
        if (this._onRequest) {
          mergedConfig = await this._onRequest(mergedConfig);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          mergedConfig.timeout || 50000,
        );

        try {
          const url = this.prepareURL(mergedConfig);
          const res = await fetch(url, {
            ...mergedConfig,
            signal: controller.signal,
          } as RequestInit);

          const data = await res.json().catch(() => res.text());
          clearTimeout(timeoutId);

          let response: VelocityResponse = {
            data,
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
            config: mergedConfig,
          };

          // Run response hook
          if (this._onResponse) {
            response = await this._onResponse(response);
          }

          const { poll } = mergedConfig;
          if (isNotEmptObject(poll)) {
            const { validate, interval, maxAttempts } = poll as PollOptions;
            const isDone =
              typeof validate === "function" && validate(response.data);
            const reachedLimit = maxAttempts && attempts >= maxAttempts;

            if (!isDone && !reachedLimit) {
              await new Promise((resolve) => setTimeout(resolve, interval));
              return execute();
            }
          }

          return response as VelocityResponse<T>;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };

      return await execute();
    } finally {
      if (isPolling) this.isBusy = false;
    }
  }

  private prepareURL(config: VelocityConfig): string {
    let { url = "", baseURL, params } = config;
    if (baseURL && !url.startsWith("http")) {
      url = baseURL + url;
    }
    return buildURL(url, params);
  }

  get<T = any>(url: string, config?: VelocityConfig) {
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
    if (typeof data === "object") return JSON.stringify(data);
    return data;
  }

  post<T = any>(url: string, data?: any, config?: VelocityConfig) {
    return this.request<T>({
      ...config,
      method: "POST",
      url,
      body: this.prepareBody(data),
    });
  }

  put<T = any>(url: string, data?: any, config?: VelocityConfig) {
    return this.request<T>({
      ...config,
      method: "PUT",
      url,
      body: this.prepareBody(data),
    });
  }

  patch<T = any>(url: string, data?: any, config?: VelocityConfig) {
    return this.request<T>({
      ...config,
      method: "PATCH",
      url,
      body: this.prepareBody(data),
    });
  }

  delete<T = any>(url: string, config?: VelocityConfig) {
    return this.request<T>({ ...config, method: "DELETE", url });
  }

  head<T = any>(url: string, config?: VelocityConfig) {
    return this.request<T>({ ...config, method: "HEAD", url });
  }

  options<T = any>(url: string, config?: VelocityConfig) {
    return this.request<T>({ ...config, method: "OPTIONS", url });
  }
}

// velocity.ts

import { requestExecutor } from "./core/requestExecutor";
import { pollHandler } from "./features/poolHandler";
import { retryHandler } from "./features/retryHandler";
import { VelocityConfig, VelocityResponse, RequestHook, ResponseHook } from "./types";
import { prepareBody } from "./utils/utils";

export class Velocity {
  private _requestHooks: RequestHook[] = [];
  private _responseHooks: ResponseHook[] = [];
  private _pollingAC?: AbortController;

  constructor(public config: VelocityConfig = {}) {
    this.config = {
      headers: { "Content-Type": "application/json" },
      ...config,
    };
  }

  // ── Public API ──

  onRequest(hook: RequestHook) {
    this._requestHooks.push(hook);
    return {
      eject: () => {
        this._requestHooks = this._requestHooks.filter((h) => h !== hook);
      },
    };
  }

  onResponse(hook: ResponseHook) {
    this._responseHooks.push(hook);
    return {
      eject: () => {
        this._responseHooks = this._responseHooks.filter((h) => h !== hook);
      },
    };
  }

  cancelPolling(): void {
    if (this._pollingAC) {
      this._pollingAC.abort();
      this._pollingAC = undefined;
    }
  }

  // ── Core Request ──

  async request<T = any>(config: VelocityConfig<T>): Promise<VelocityResponse<T>> {
    const mergedConfig = { 
      ...this.config, 
      ...config,
      headers: { 
        ...this._toRecord(this.config.headers), 
        ...this._toRecord(config.headers) 
      }
    };

    const isPolling = !!mergedConfig.poll;
    if (isPolling) {
      this.cancelPolling();
      this._pollingAC = new AbortController();
    }

    const ctx = {
      requestHooks: this._requestHooks,
      responseHooks: this._responseHooks,
      pollingSignal: this._pollingAC?.signal,
    };

    const execute = async () => requestExecutor<T>(mergedConfig, ctx);

    try {
      // If polling, we hand over control to pollHandler
      if (isPolling) {
        return await pollHandler<T>(execute, mergedConfig.poll!);
      }

      // Otherwise, just a standard (possibly retried) request
      return await retryHandler(execute, mergedConfig.retry);
    } finally {
      if (isPolling) {
        this._pollingAC = undefined;
      }
    }
  }

  // ── Helpers ──

  get<T = any>(url: string, config?: VelocityConfig<T>) {
    return this.request<T>({ ...config, method: "GET", url });
  }

  post<T = any>(url: string, data?: any, config?: VelocityConfig<T>) {
    return this.request<T>({
      ...config,
      method: "POST",
      url,
      body: prepareBody(data),
    });
  }

  put<T = any>(url: string, data?: any, config?: VelocityConfig<T>) {
    return this.request<T>({
      ...config,
      method: "PUT",
      url,
      body: prepareBody(data),
    });
  }

  patch<T = any>(url: string, data?: any, config?: VelocityConfig<T>) {
    return this.request<T>({
      ...config,
      method: "PATCH",
      url,
      body: prepareBody(data),
    });
  }

  delete<T = any>(url: string, config?: VelocityConfig<T>) {
    return this.request<T>({ ...config, method: "DELETE", url });
  }

  private _toRecord(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};
    if (headers instanceof Headers) {
      const record: Record<string, string> = {};
      headers.forEach((v, k) => (record[k] = v));
      return record;
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    return headers as Record<string, string>;
  }
}

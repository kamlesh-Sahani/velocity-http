// core/requestExecutor.ts

import { buildURL, parseBody, joinURL, prepareBody } from "../utils/utils";
import { fetchAdapter } from "./fetchAdapter";
import { VelocityConfig, VelocityResponse, VelocityError } from "../types";
import { createAbortManager } from "../features/abortManager";

export async function requestExecutor<T = any>(
  config: VelocityConfig<T>,
  ctx: any,
): Promise<VelocityResponse<T>> {
  let finalConfig = { ...config };

  if (finalConfig.withCredentials) {
    finalConfig.credentials = "include";
  }

  // ── Request hooks ──
  for (const fn of ctx.requestHooks) {
    finalConfig = (await fn(finalConfig)) || finalConfig;
  }

  if (finalConfig.body) {
    finalConfig.body = prepareBody(finalConfig.body);
  }

  // ── Build URL ──
  const { baseURL, url: rawUrl = "" } = finalConfig;
  const fullUrl = baseURL && !rawUrl.startsWith("http") 
    ? joinURL(baseURL, rawUrl) 
    : rawUrl;
  const url = buildURL(fullUrl, finalConfig.params);

  // ── Abort Management ──
  const { signal, cleanup } = createAbortManager(finalConfig, ctx.pollingSignal);

  try {
    // ── Fetch ──
    const res = await fetchAdapter({
      ...finalConfig,
      url,
      signal,
    });

    // ── Parse ──
    const data = await parseBody<T>(res, finalConfig);

    let response: VelocityResponse<T> = {
      data,
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: res.headers,
      config: finalConfig,
    };

    // ── Response hooks ──
    for (const fn of ctx.responseHooks) {
      response = (await fn(response)) || response;
    }

    if (!res.ok) {
      throw new VelocityError(
        "HTTPError",
        `HTTP ${res.status}: ${res.statusText}`,
        finalConfig,
        response,
      );
    }

    return response;
  } catch (err: any) {
    // Determine if it was a timeout or a manual cancel
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      if (ctx.pollingSignal?.aborted) {
        throw new VelocityError("CancelError", "Polling was cancelled", finalConfig);
      }
      if (finalConfig.signal?.aborted) {
        throw new VelocityError("CancelError", "Request was cancelled", finalConfig);
      }
      // If we got here and it's an AbortError, it's likely our own timeout
      throw new VelocityError(
        "TimeoutError",
        `Request timed out after ${finalConfig.timeout ?? 30000}ms`,
        finalConfig,
      );
    }
    
    // Check if the error itself is a VelocityError (from createAbortManager reason)
    if (err instanceof VelocityError) throw err;
    if (err.message?.includes("timeout") || err.message?.includes("timed out")) {
        throw new VelocityError(
            "TimeoutError",
            err.message,
            finalConfig,
          );
    }

    throw new VelocityError("NetworkError", err.message, finalConfig);
  } finally {
    cleanup();
  }
}

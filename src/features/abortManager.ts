import { VelocityConfig, VelocityError } from "../types";

export function createAbortManager(config: VelocityConfig, pollingSignal?: AbortSignal) {
  const { timeout = 30000, signal: externalSignal } = config;
  const timeoutAC = new AbortController();

  const timeoutId = setTimeout(() => {
    timeoutAC.abort(new VelocityError(
      "TimeoutError",
      `Request timed out after ${timeout}ms`,
      config
    ));
  }, timeout);

  const signals: AbortSignal[] = [timeoutAC.signal];
  if (externalSignal) signals.push(externalSignal);
  if (pollingSignal) signals.push(pollingSignal);

  const combinedSignal = signals.length > 1 
    ? (AbortSignal as any).any(signals) 
    : signals[0];

  return {
    signal: combinedSignal,
    cleanup: () => clearTimeout(timeoutId)
  };
}

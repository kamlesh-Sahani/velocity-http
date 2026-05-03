import { sleep } from "../utils/utils";
import { RetryOptions } from "../types";

export async function retryHandler<T>(
  fn: () => Promise<T>, 
  options: RetryOptions = { attempts: 0 }
): Promise<T> {
  const { attempts = 0, delay = 0 } = options;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts) throw err;
      attempt++;
      if (delay) await sleep(delay);
    }
  }
}

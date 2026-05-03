import { sleep } from "../utils/utils";
import { PollOptions, VelocityResponse } from "../types";

export async function pollHandler<T>(
  fn: () => Promise<VelocityResponse<T>>, 
  options: PollOptions<T>
): Promise<VelocityResponse<T>> {
  const { validate, interval = 1000, maxAttempts = 10 } = options;

  let attempt = 1;

  while (true) {
    const res = await fn();

    const done = await validate(res.data, res, attempt);
    if (done) return res;

    if (attempt >= maxAttempts) {
      throw new Error(`Polling exceeded max attempts (${maxAttempts})`);
    }

    await sleep(interval);
    attempt++;
  }
}

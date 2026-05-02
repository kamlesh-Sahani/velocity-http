// ─────────────────────────────────────────────────────────────────────────────
//  Velocity – Full Feature Test Suite  (ESM)
//  Run: node test.mjs
// ─────────────────────────────────────────────────────────────────────────────

import Velocity, { VelocityError } from "./dist/index.mjs";

// ── Test runner ───────────────────────────────────────────────────────────────

const BASE_URL = "https://mocki.io/v1/5a7ed5d3-3132-4b36-b87a-dff4da8a2a30";
const JSON_URL = "https://jsonplaceholder.typicode.com";

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
    results.push({ name, status: "pass" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗  ${name}`);
    console.log(`       → ${msg}`);
    failed++;
    results.push({ name, status: "fail", error: msg, err });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

function assertError(err, kind) {
  assert(
    err instanceof VelocityError,
    `Expected VelocityError but got: ${err?.constructor?.name} — ${err?.message}`,
  );
  assert(
    err.kind === kind,
    `Expected error kind "${kind}" but got "${err.kind}"`,
  );
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 55 - title.length))}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. Basic HTTP methods
// ─────────────────────────────────────────────────────────────────────────────

async function testBasicMethods() {
  section("1. Basic HTTP methods");

  await test("GET — returns 200 and parsed JSON", async () => {
    const api = new Velocity();
    const res = await api.get(BASE_URL);
    console.log(res, "testBasicMethods");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.ok === true, "Expected res.ok to be true");
    assert(res.data !== null, "Expected data to be non-null");
  });

  await test("GET — response has correct shape (data, status, headers, ok, config)", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.get("/todos/1");
    assert("data" in res, "Missing .data");
    assert("status" in res, "Missing .status");
    assert("headers" in res, "Missing .headers");
    assert("ok" in res, "Missing .ok");
    assert("config" in res, "Missing .config");
  });

  await test("POST — sends JSON body and returns 201", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.post("/posts", { title: "velocity", userId: 1 });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.title === "velocity", "Body not echoed back");
  });

  await test("PUT — sends JSON body", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.put("/posts/1", { title: "updated", userId: 1 });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test("PATCH — partial update", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.patch("/posts/1", { title: "patched" });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test("DELETE — returns 200", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.delete("/posts/1");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. Timeout
// ─────────────────────────────────────────────────────────────────────────────

async function testTimeout() {
  section("2. Timeout");

  await test("Throws TimeoutError when timeout is exceeded (1ms)", async () => {
    const api = new Velocity();
    try {
      await api.get(BASE_URL, { timeout: 1 });
      throw new Error("Should have thrown");
    } catch (err) {
      assertError(err, "TimeoutError");
      assert(
        err.message.includes("timed out"),
        `Expected timeout message, got: "${err.message}"`,
      );
    }
  });

  await test("TimeoutError carries the config", async () => {
    const api = new Velocity();
    try {
      await api.get(BASE_URL, { timeout: 1 });
    } catch (err) {
      assert(err instanceof VelocityError, "Not a VelocityError");
      assert(err.config !== undefined, "Missing .config on error");
    }
  });

  await test("Does NOT timeout when limit is generous", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.get("/todos/1", { timeout: 15000 });
    assert(res.ok, "Expected successful response within generous timeout");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. Cancellation (AbortSignal)
// ─────────────────────────────────────────────────────────────────────────────

async function testCancellation() {
  section("3. Cancellation (AbortSignal)");

  await test("Throws CancelError when signal aborts immediately (3ms)", async () => {
    const api = new Velocity();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3);
    try {
      await api.get(BASE_URL, { signal: controller.signal });
      throw new Error("Should have thrown");
    } catch (err) {
      assertError(err, "CancelError");
    }
  });

  await test("CancelError — NOT a raw AbortError / DOMException", async () => {
    const api = new Velocity();
    const controller = new AbortController();
    controller.abort(); // abort immediately
    try {
      await api.get(BASE_URL, { signal: controller.signal });
    } catch (err) {
      assert(
        !(err instanceof DOMException),
        "Should not expose raw DOMException",
      );
      assertError(err, "CancelError");
    }
  });

  await test("Abort before fetch starts (signal already aborted)", async () => {
    const api = new Velocity();
    const controller = new AbortController();
    controller.abort(); // already aborted before call
    try {
      await api.get(BASE_URL, { signal: controller.signal });
      throw new Error("Should have thrown");
    } catch (err) {
      assertError(err, "CancelError");
    }
  });

  await test("Non-aborted signal completes normally", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const controller = new AbortController();
    // Never abort — should succeed
    const res = await api.get("/todos/1", { signal: controller.signal });
    assert(res.ok, "Expected successful response");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. HTTP errors
// ─────────────────────────────────────────────────────────────────────────────

async function testHTTPErrors() {
  section("4. HTTP errors");

  await test("Throws HTTPError on 404", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    try {
      await api.get("/this-does-not-exist-404");
      throw new Error("Should have thrown");
    } catch (err) {
      assertError(err, "HTTPError");
      assert(
        err.response?.status === 404,
        `Expected 404, got ${err.response?.status}`,
      );
    }
  });

  await test("HTTPError carries response.data", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    try {
      await api.get("/this-does-not-exist-404");
    } catch (err) {
      assert(err instanceof VelocityError, "Not a VelocityError");
      assert("response" in err, "Missing .response on HTTPError");
    }
  });

  await test("HTTPError message contains status code", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    try {
      await api.get("/this-does-not-exist-404");
    } catch (err) {
      assert(
        err instanceof VelocityError && err.message.includes("404"),
        `Expected message to contain 404, got: "${err?.message}"`,
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. Request interceptors
// ─────────────────────────────────────────────────────────────────────────────

async function testRequestInterceptors() {
  section("5. Request interceptors");

  await test("Single request hook runs and mutates config", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let hookRan = false;

    api.onRequest((config) => {
      hookRan = true;
      const headers = new Headers(config.headers);
      headers.set("X-Test", "velocity");
      console.log({ headers });
      return { ...config, headers };
    });

    await api.get("/todos/1");
    assert(hookRan, "Request hook did not run");
  });

  await test("Multiple request hooks run in registration order", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const order = [];

    api.onRequest((cfg) => {
      order.push(1);
      return cfg;
    });
    api.onRequest((cfg) => {
      order.push(2);
      return cfg;
    });
    api.onRequest((cfg) => {
      order.push(3);
      return cfg;
    });
    console.log({ order });
    await api.get("/todos/1");
    assert(
      JSON.stringify(order) === "[1,2,3]",
      `Expected [1,2,3], got ${JSON.stringify(order)}`,
    );
  });

  await test("Ejecting a hook stops it from running", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let ran = false;

    const handle = api.onRequest((cfg) => {
      ran = true;
      return cfg;
    });
    handle.eject();
    await api.get("/todos/1");

    assert(!ran, "Ejected hook should not have run");
  });

  await test("Request hook receives merged config including baseURL", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let capturedBaseURL;

    api.onRequest((cfg) => {
      capturedBaseURL = cfg.baseURL;
      return cfg;
    });

    await api.get("/todos/1");
    assert(
      capturedBaseURL === JSON_URL,
      `Expected baseURL "${JSON_URL}", got "${capturedBaseURL}"`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  6. Response interceptors
// ─────────────────────────────────────────────────────────────────────────────

async function testResponseInterceptors() {
  section("6. Response interceptors");

  await test("Response hook receives and can transform the response", async () => {
    const api = new Velocity({ baseURL: JSON_URL });

    api.onResponse((res) => ({
      ...res,
      data: { transformed: true, original: res.data },
    }));

    const res = await api.get("/todos/1");
    assert(res.data.transformed === true, "Response not transformed by hook");
    assert("original" in res.data, "Original data missing after transform");
  });

  await test("Multiple response hooks run in registration order", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const order = [];

    api.onResponse((res) => {
      order.push(1);
      return res;
    });
    api.onResponse((res) => {
      order.push(2);
      return res;
    });

    await api.get("/todos/1");
    assert(
      JSON.stringify(order) === "[1,2]",
      `Expected [1,2], got ${JSON.stringify(order)}`,
    );
  });

  await test("Ejecting a response hook stops it from running", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let ran = false;

    const handle = api.onResponse((res) => {
      ran = true;
      return res;
    });
    handle.eject();
    await api.get("/todos/1");

    assert(!ran, "Ejected response hook should not have run");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  7. Query params
// ─────────────────────────────────────────────────────────────────────────────

// async function testQueryParams() {
//   section("7. Query params");

//   // await test("Single param appended to URL", async () => {
//   //   const api = new Velocity({ baseURL: JSON_URL });
//   //   let capturedURL;

//   //   api.onRequest((cfg) => {
//   //     console.log({ cfg });
//   //     capturedURL = cfg.url;
//   //     return cfg;
//   //   });
//   //   console.log({ capturedURL });

//   //   await api.get("/posts", { params: { userId: 1, name: "kamlesh" } });
//   //   assert(
//   //     capturedURL?.includes("userId=1"),
//   //     `Expected userId=1 in URL, got: "${capturedURL}"`,
//   //   );
//   // });

//   await test("Null / undefined params are skipped", async () => {
//     const api = new Velocity({ baseURL: JSON_URL });
//     let capturedURL;

//     api.onRequest((cfg) => {
//       console.log({ cfg });
//       capturedURL = cfg.url;
//       return cfg;
//     });

//     await api.get("/posts", {
//       params: { userId: 1, sort: undefined, filter: null },
//     });
//     assert(!capturedURL?.includes("sort"), "undefined param should be omitted");
//     assert(!capturedURL?.includes("filter"), "null param should be omitted");
//   });

//   // await test("Multiple params all appended", async () => {
//   //   const api = new Velocity({ baseURL: JSON_URL });
//   //   const res = await api.get("/posts", { params: { userId: 1 } });
//   //   assert(Array.isArray(res.data), "Expected array of posts");
//   //   assert(res.data.length > 0, "Expected at least one post for userId=1");
//   //   res.data.forEach((post) => {
//   //     assert(post.userId === 1, `Post userId should be 1, got ${post.userId}`);
//   //   });
//   // });
// }

// ─────────────────────────────────────────────────────────────────────────────
//  8. Response types
// ─────────────────────────────────────────────────────────────────────────────

async function testResponseTypes() {
  section("8. Response types");

  await test("responseType: 'json' returns parsed object", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.get("/todos/1", { responseType: "json" });
    assert(
      typeof res.data === "object" && res.data !== null,
      "Expected object",
    );
  });

  await test("responseType: 'text' returns string", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.get("/todos/1", { responseType: "text" });
    console.log({ res });
    assert(
      typeof res.data === "string",
      `Expected string, got ${typeof res.data}`,
    );
  });

  await test("responseType: 'blob' returns Blob", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.get("/todos/1", { responseType: "blob" });
    assert(
      res.data instanceof Blob,
      `Expected Blob, got ${res.data?.constructor?.name}`,
    );
  });

  await test("Auto-detect JSON from Content-Type (no responseType set)", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    const res = await api.get("/todos/1");
    assert(
      typeof res.data === "object" && "id" in res.data,
      "Expected auto-parsed JSON object",
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  9. Body serialisation
// ─────────────────────────────────────────────────────────────────────────────

async function testBodySerialisation() {
  section("9. Body serialisation");

  await test("Plain object serialised to JSON string", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let capturedBody;

    api.onRequest((cfg) => {
      capturedBody = cfg.body;
      return cfg;
    });

    await api.post("/posts", { title: "test", userId: 1 });
    assert(typeof capturedBody === "string", "Body should be a JSON string");
    const parsed = JSON.parse(capturedBody);
    assert(parsed.title === "test", "Serialised body mismatch");
  });

  await test("FormData passed through without serialisation", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let capturedBody;

    api.onRequest((cfg) => {
      capturedBody = cfg.body;
      return cfg;
    });

    const form = new FormData();
    form.append("name", "velocity");
    await api.post("/posts", form).catch(() => {}); // ignore HTTP error
    assert(
      capturedBody instanceof FormData,
      "FormData should pass through as-is",
    );
  });

  await test("URLSearchParams passed through without serialisation", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let capturedBody;

    api.onRequest((cfg) => {
      capturedBody = cfg.body;
      return cfg;
    });

    const params = new URLSearchParams({ name: "velocity" });
    await api.post("/posts", params).catch(() => {});
    assert(
      capturedBody instanceof URLSearchParams,
      "URLSearchParams should pass through as-is",
    );
  });

  await test("Content-Type removed on bodyless GET (no CORS preflight)", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let headers;

    api.onRequest((cfg) => {
      headers = new Headers(cfg.headers);
      return cfg;
    });

    await api.get("/todos/1");
    assert(
      !headers.has("content-type"),
      "Content-Type should be absent on bodyless requests",
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  10. Retry
// ─────────────────────────────────────────────────────────────────────────────

async function testRetry() {
  section("10. Retry");

  await test("Retries the configured number of times on matching status", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let callCount = 0;

    api.onRequest((cfg) => {
      callCount++;
      return cfg;
    });

    try {
      await api.get("/this-does-not-exist-404", {
        retry: { attempts: 2, delay: 0, statuses: [404] },
      });
    } catch {}

    // initial + 2 retries = 3 total
    assert(
      callCount === 3,
      `Expected 3 calls (1 + 2 retries), got ${callCount}`,
    );
  });

  await test("Does NOT retry on status codes not in the list", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let callCount = 0;

    api.onRequest((cfg) => {
      callCount++;
      return cfg;
    });

    try {
      await api.get("/this-does-not-exist-404", {
        retry: { attempts: 3, delay: 0, statuses: [500] }, // 404 not in list
      });
    } catch {}

    assert(
      callCount === 1,
      `Expected 1 call (no retry for 404), got ${callCount}`,
    );
  });

  await test("Custom shouldRetry predicate controls retries", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let callCount = 0;

    api.onRequest((cfg) => {
      callCount++;
      return cfg;
    });

    try {
      await api.get("/this-does-not-exist-404", {
        retry: {
          attempts: 3,
          delay: 0,
          shouldRetry: (res) => res.status === 404,
        },
      });
    } catch {}

    assert(
      callCount === 4,
      `Expected 4 calls (1 + 3 retries), got ${callCount}`,
    );
  });

  await test("Does not retry CancelError", async () => {
    const api = new Velocity();
    let callCount = 0;
    const controller = new AbortController();

    api.onRequest((cfg) => {
      callCount++;
      controller.abort();
      return cfg;
    });

    try {
      await api.get(BASE_URL, {
        signal: controller.signal,
        retry: { attempts: 3, delay: 0 },
      });
    } catch (err) {
      assertError(err, "CancelError");
    }

    assert(
      callCount === 1,
      `CancelError should not be retried, got ${callCount} calls`,
    );
  });

  await test("Does not retry TimeoutError", async () => {
    const api = new Velocity();
    let callCount = 0;

    api.onRequest((cfg) => {
      callCount++;
      return cfg;
    });

    try {
      await api.get(BASE_URL, {
        timeout: 1,
        retry: { attempts: 3, delay: 0 },
      });
    } catch (err) {
      assertError(err, "TimeoutError");
    }

    assert(
      callCount === 1,
      `TimeoutError should not be retried, got ${callCount} calls`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  11. Polling
// ─────────────────────────────────────────────────────────────────────────────

async function testPolling() {
  section("11. Polling");

  await test("Polls until validate() returns true", async () => {
    const api = new Velocity();
    let attemptCount = 0;

    const res = await api.get(BASE_URL, {
      poll: {
        interval: 100,
        maxAttempts: 10,
        validate: (_data, _res, attempt) => {
          attemptCount = attempt;
          return attempt >= 3; // stop after 3
        },
      },
    });

    assert(attemptCount === 3, `Expected 3 poll attempts, got ${attemptCount}`);
    assert(res.ok, "Final poll response should be ok");
  });

  await test("Throws PollingError when maxAttempts exceeded", async () => {
    const api = new Velocity();

    try {
      await api.get(BASE_URL, {
        poll: {
          interval: 50,
          maxAttempts: 2,
          validate: () => false, // never resolves
        },
      });
      throw new Error("Should have thrown");
    } catch (err) {
      assertError(err, "PollingError");
      assert(
        err.message.includes("maxAttempts"),
        `Expected maxAttempts message, got: "${err.message}"`,
      );
    }
  });

  await test("cancelPolling() stops an in-progress poll with CancelError", async () => {
    const api = new Velocity();

    setTimeout(() => api.cancelPolling(), 250);

    try {
      await api.get(BASE_URL, {
        poll: {
          interval: 150,
          maxAttempts: 20,
          validate: () => false,
        },
      });
      throw new Error("Should have thrown");
    } catch (err) {
      assertError(err, "CancelError");
    }
  });

  await test("Throws PollingError if only one poll is allowed at a time", async () => {
    const api = new Velocity();
    let secondPollError;

    // Start a long-running poll
    const first = api
      .get(BASE_URL, {
        poll: { interval: 200, maxAttempts: 5, validate: () => false },
      })
      .catch(() => {});

    // Immediately try a second — should fail
    try {
      await api.get(BASE_URL, {
        poll: { interval: 200, maxAttempts: 5, validate: () => false },
      });
    } catch (err) {
      secondPollError = err;
    }

    api.cancelPolling();
    await first;

    assert(secondPollError instanceof VelocityError, "Expected VelocityError");
    assert(
      secondPollError.kind === "PollingError",
      `Expected PollingError, got ${secondPollError.kind}`,
    );
  });

  await test("Poll validate() receives data, response, and attempt number", async () => {
    const api = new Velocity();
    let capturedArgs;

    await api.get(BASE_URL, {
      poll: {
        interval: 50,
        maxAttempts: 3,
        validate: (data, response, attempt) => {
          capturedArgs = { data, response, attempt };
          return true; // stop immediately
        },
      },
    });

    assert(capturedArgs.data !== undefined, "data not passed to validate");
    assert(
      capturedArgs.response !== undefined,
      "response not passed to validate",
    );
    assert(capturedArgs.attempt === 1, "attempt should be 1 on first call");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  12. withCredentials
// ─────────────────────────────────────────────────────────────────────────────

async function testWithCredentials() {
  section("12. withCredentials");

  await test("withCredentials: true sets credentials to 'include'", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let capturedCredentials;

    api.onRequest((cfg) => {
      capturedCredentials = cfg.credentials;
      return cfg;
    });

    await api.get("/todos/1", { withCredentials: true });
    assert(
      capturedCredentials === "include",
      `Expected "include", got "${capturedCredentials}"`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  13. Instance defaults
// ─────────────────────────────────────────────────────────────────────────────

async function testInstanceDefaults() {
  section("13. Instance defaults");

  await test("baseURL prepended to relative URL", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    let capturedFinalURL;

    api.onRequest((cfg) => {
      const base = cfg.baseURL?.replace(/\/$/, "") ?? "";
      const path = (cfg.url ?? "").replace(/^\//, "");
      capturedFinalURL = base + "/" + path;
      return cfg;
    });

    await api.get("/todos/1");
    assert(
      capturedFinalURL === `${JSON_URL}/todos/1`,
      `Expected full URL, got "${capturedFinalURL}"`,
    );
  });

  await test("Instance-level headers merged into every request", async () => {
    const api = new Velocity({
      baseURL: JSON_URL,
      headers: { "X-App-ID": "velocity-test" },
    });
    let appHeader;

    api.onRequest((cfg) => {
      appHeader = new Headers(cfg.headers).get("x-app-id");
      return cfg;
    });

    await api.get("/todos/1");
    assert(
      appHeader === "velocity-test",
      `Expected "velocity-test", got "${appHeader}"`,
    );
  });

  await test("Per-request headers override instance headers", async () => {
    const api = new Velocity({
      baseURL: JSON_URL,
      headers: { "X-Override": "instance" },
    });
    let headerValue;

    api.onRequest((cfg) => {
      headerValue = new Headers(cfg.headers).get("x-override");
      return cfg;
    });

    await api.get("/todos/1", { headers: { "X-Override": "request" } });
    assert(
      headerValue === "request",
      `Expected "request", got "${headerValue}"`,
    );
  });

  await test("Absolute URL in get() ignores baseURL", async () => {
    const api = new Velocity({
      baseURL: "https://should-be-ignored.example.com",
    });
    // If baseURL is incorrectly prepended this will fail with a network error
    const res = await api.get(BASE_URL);
    assert(res.ok, "Absolute URL should bypass baseURL");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  14. Error properties
// ─────────────────────────────────────────────────────────────────────────────

async function testErrorProperties() {
  section("14. Error properties");

  await test("All VelocityErrors have .kind, .config, .message, .name", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    try {
      await api.get("/not-found-404");
    } catch (err) {
      assert(err instanceof VelocityError, "Not a VelocityError");
      assert(typeof err.kind === "string", "Missing .kind");
      assert(typeof err.message === "string", "Missing .message");
      assert(typeof err.name === "string", "Missing .name");
      assert(err.config !== undefined, "Missing .config");
    }
  });

  await test("HTTPError has .response with .status and .data", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    try {
      await api.get("/not-found-404");
    } catch (err) {
      assert(
        err instanceof VelocityError && err.kind === "HTTPError",
        "Not HTTPError",
      );
      assert(err.response !== undefined, "Missing .response");
      assert(err.response.status === 404, "Wrong status");
      assert(err.response.data !== undefined, "Missing .response.data");
    }
  });

  await test("VelocityError is instanceof Error", async () => {
    const api = new Velocity({ baseURL: JSON_URL });
    try {
      await api.get("/not-found-404");
    } catch (err) {
      assert(err instanceof Error, "VelocityError should extend Error");
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Run everything
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════");
console.log("  Velocity HTTP Client — Test Suite");
console.log("══════════════════════════════════════════════════════════");

// await testBasicMethods();
// await testTimeout();
// await testCancellation();
// await testHTTPErrors();
// await testRequestInterceptors();
// await testResponseInterceptors();
// await testQueryParams();
// await testResponseTypes();
await testBodySerialisation();
// await testRetry();
// await testPolling();
// await testWithCredentials();
// await testInstanceDefaults();
// await testErrorProperties();

// ── Summary ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log("\n══════════════════════════════════════════════════════════");
console.log(`  Results: ${passed}/${total} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════════════");

if (failed > 0) {
  console.log("\nFailed tests:");
  results
    .filter((r) => r.status === "fail")
    .forEach((r) => console.log(`  ✗ ${r.name}\n    ${r.error}`));
  process.exit(1);
} else {
  console.log("\n  ✅  All tests passed\n");
}

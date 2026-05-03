# Velocity HTTP 🚀

**The high-performance, zero-dependency HTTP client for modern web applications.**

Velocity is a lightweight (under 3KB gzipped), universal HTTP client built on the native Fetch API. It brings production-grade features like **Sequential Polling**, **Automatic Retries**, and **Request Interceptors** to your application with zero external dependencies.

[**Explore Documentation**](https://velocity-http.vercel.app/) • [**Live Playground**](https://velocity-http.vercel.app/#playground)

[![NPM Version](https://img.shields.io/npm/v/velocity-http.svg?style=flat-square)](https://www.npmjs.com/package/velocity-http)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/velocity-http.svg?style=flat-square)](https://bundlephobia.com/package/velocity-http)
[![License](https://img.shields.io/npm/l/velocity-http.svg?style=flat-square)](./LICENSE)

---

## ✨ Features

- **⚡ Ultralight**: < 3KB gzipped. Zero dependencies. Native performance.
- **🔄 Sequential Polling**: Built-in engine to handle long-running background tasks safely.
- **🔁 Smart Retries**: Automatic exponential backoff and custom retry strategies.
- **🛡️ Interceptors**: Global `onRequest` and `onResponse` hooks for auth, logging, and error handling.
- **🔷 TypeScript First**: Deep generic support and exported types for every configuration.
- **🌍 Universal**: Seamlessly runs in Browser, Node.js, and Edge environments.
- **🛠️ Flexible Parsing**: Native support for JSON, Blob, Text, and ArrayBuffer.

---

## 📦 Installation

```bash
# Using NPM
npm install velocity-http

# Using PNPM
pnpm add velocity-http

# Using Yarn
yarn add velocity-http
```

---

## 🚀 Quick Start

### 1. Simple Instance
Create a centralized API client with base configurations.

```typescript
import Velocity from "velocity-http";

const api = new Velocity({
  baseURL: "https://api.example.com/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 10000
});
```

### 2. Request Interceptors (Middleware)
Perfect for injecting Auth tokens or global error handling.

```typescript
// Add Bearer token to every request
api.onRequest((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Global error logger
api.onResponse((response) => {
  if (!response.ok) {
    console.error(`API Error: ${response.status}`);
  }
  return response;
});
```

### 3. Making Requests
Full support for TypeScript generics for end-to-end type safety.

```typescript
interface User {
  id: string;
  name: string;
}

// Type-safe GET
const { data } = await api.get<User>("/me");
console.log(data.name);

// POST with body
await api.post("/users", { name: "Kamlesh Sahani" });
```

---

## 🌀 Advanced Usage

### Sequential Polling
Wait for a background process to finish without manually managing intervals or memory leaks.

```typescript
const result = await api.get("/status/task_123", {
  poll: {
    interval: 2000,
    maxAttempts: 10,
    validate: (data) => data.status === "COMPLETED"
  }
});
```

### Automatic Retries
Handle flaky networks with ease.

```typescript
await api.get("/flaky-service", {
  retry: {
    attempts: 3,
    delay: 1000,
    statuses: [500, 502, 503, 504]
  }
});
```

---

## 🛠 API Reference

### Configuration Options
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `baseURL` | `string` | `""` | Base URL for all requests |
| `headers` | `HeadersInit` | `{}` | Default headers |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `retry` | `RetryOptions` | `null` | Automatic retry configuration |
| `poll` | `PollOptions` | `null` | Sequential polling configuration |

---

## 📄 License

MIT © [Kamlesh Sahani](https://github.com/kamlesh-Sahani)

Built with ❤️ for the modern web.

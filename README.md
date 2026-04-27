# Velocity HTTP 🚀

**The lightweight, universal HTTP client for modern web applications.**

Velocity is a tiny (under 2kb), zero-dependency HTTP client that brings sanity to network requests. It simplifies common patterns like request/response interception, sequential polling, and path normalization into a beginner-friendly API.

[![NPM Version](https://img.shields.io/npm/v/velocity-http.svg?style=flat-square)](https://www.npmjs.com/package/velocity-http)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/velocity-http.svg?style=flat-square)](https://bundlephobia.com/package/velocity-http)
[![License](https://img.shields.io/npm/l/velocity-http.svg?style=flat-square)](https://github.com/kamlesh-Sahani/velocity-http/blob/main/LICENSE)

---

## ✨ Features

- **⚡ Lightweight**: Under 2kb gzipped. No bloat, just the essentials.
- **🛡️ Simple Hooks**: Easy `onRequest` and `onResponse` hooks for auth, logging, and error handling.
- **🔄 Sequential Polling**: Built-in logic to retry requests until a condition is met, with automatic safety locks.
- **🔷 TypeScript First**: Full type safety for requests, responses, and configuration.
- **🌍 Universal**: Works seamlessly in the browser, Node.js, and edge environments.
- **📦 Zero Dependencies**: No hidden overhead.

---

## 📦 Installation

```bash
npm install velocity-http
# or
yarn add velocity-http
# or
pnpm add velocity-http
```

---

## 🚀 Quick Start

### 1. Initialize Instance

Create a reusable instance with your base configuration.

```typescript
import Velocity from "velocity-http";

const api = new Velocity({
  baseURL: "https://api.example.com",
  timeout: 10000,
  headers: { "X-App-ID": "my-velocity-app" },
});
```

### 2. Add Hooks (Checkpoints)

Hooks are simple functions that run automatically before or after every call.

```typescript
// Run this BEFORE every request (e.g., adding an Auth token)
api.onRequest((config) => {
  return {
    ...config,
    headers: {
      ...config.headers,
      Authorization: "Bearer YOUR_TOKEN",
    },
  };
});

// Run this AFTER every response (e.g., catching errors globally)
api.onResponse((response) => {
  if (response.status === 401) {
    console.error("Session expired!");
  }
  return response;
});
```

### 3. Make Requests

Standard HTTP methods return typed JSON data by default.

```typescript
// Simple GET
const users = await api.get("/users");

// POST with data
const newUser = await api.post("/users", {
  name: "Kamlesh Sahani",
});
```

---

## 🔄 Sequential Polling

Velocity includes a smart polling engine that handles retries for you. It even has a **busy lock** to prevent overlapping network calls if a poll is already in progress.

```typescript
const result = await api.get("/check-status", {
  poll: {
    interval: 2000, // Wait 2 seconds between retries
    maxAttempts: 5, // Stop after 5 tries
    validate: (data) => {
      // Return true when condition is met
      return data.status === "READY";
    },
  },
});
```

---

## 🛠 API Reference

### Methods

- `api.get(url, config)`
- `api.post(url, data, config)`
- `api.put(url, data, config)`
- `api.patch(url, data, config)`
- `api.delete(url, config)`
- `api.head(url, config)`
- `api.options(url, config)`

### Config Options

- `baseURL`: Prefix added to all URLs.
- `timeout`: Request timeout in milliseconds.
- `headers`: Default headers for all requests.
- `params`: Query parameters object.
- `poll`: Polling configuration (`interval`, `maxAttempts`, `validate`).

---

## 📄 License

MIT © [Kamlesh Sahani](https://github.com/kamlesh-Sahani)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/kamlesh-Sahani/velocity-http/issues).

---

Built with ❤️ by [Kamlesh Sahani](https://www.linkedin.com/in/kamlesh-sahani)

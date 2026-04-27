# Velocity HTTP 🚀

**The lightweight, universal HTTP client for modern web applications.**

Velocity is a tiny (under 2kb), zero-dependency HTTP client that simplifies request interception, sequential polling, and path normalization into a beginner-friendly API.

[**Documentation & Playground**](https://velocity-http.vercel.app/)

[![NPM Version](https://img.shields.io/npm/v/velocity-http.svg?style=flat-square)](https://www.npmjs.com/package/velocity-http)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/velocity-http.svg?style=flat-square)](https://bundlephobia.com/package/velocity-http)

---

## ✨ Features

- **⚡ Lightweight**: Under 2kb gzipped. Zero dependencies.
- **🛡️ Simple Hooks**: Easy `onRequest` and `onResponse` checkpoints.
- **🔄 Smart Polling**: Built-in sequential polling with automatic busy-locks.
- **🔷 TypeScript**: Full type safety for requests and responses.
- **🌍 Universal**: Works in Browser, Node.js, and Edge.

---

## 📦 Installation

```bash
npm install velocity-http
```

---

## 🚀 Quick Start

### 1. Initialize

```typescript
import Velocity from "velocity-http";

const api = new Velocity({ baseURL: "https://api.example.com" });
```

### 2. Add a Hook (Checkpoints)

```typescript
// Add a token to every request
api.onRequest((config) => ({
  ...config,
  headers: { ...config.headers, Authorization: "Bearer TOKEN" },
}));
```

### 3. Make Requests

```typescript
// Simple GET
const users = await api.get("/users");

// POST with data
await api.post("/users", { name: "Kamlesh Sahani" });

// Polling until ready
const job = await api.get("/job/1", {
  poll: { interval: 2000, validate: (data) => data.status === "DONE" },
});
```

---

## 🛠 API Reference

- `api.get(url, config)`
- `api.post(url, data, config)`
- `api.put(url, data, config)`
- `api.patch(url, data, config)`
- `api.delete(url, config)`

**Full documentation available at [velocity-http.vercel.app](https://velocity-http.vercel.app/)**

---

## 📄 License

MIT © [Kamlesh Sahani](https://github.com/kamlesh-Sahani)

Built with ❤️ by [Kamlesh Sahani](https://www.linkedin.com/in/kamlesh-sahani)

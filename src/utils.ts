export function buildURL(
  url: string = "",
  params?: Record<string, any>,
): string {
  if (!params) return url;
  const serialized = Object.entries(params || {})
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
  return serialized
    ? `${url}${url.includes("?") ? "&" : "?"}${serialized}`
    : url;
}

export const isNotEmptObject = (obj: unknown) =>
  obj != null && typeof obj === "object" && !!Object.keys(obj).length;

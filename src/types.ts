export type Method =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export interface PollOptions<T = any> {
  interval: number;
  validate: (data: T) => boolean;
  maxAttempts?: number;
}

export interface VelocityConfig extends Omit<RequestInit, "method"> {
  baseURL?: string;
  url?: string;
  method?: Method;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  poll?: PollOptions;
}

export interface VelocityResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: VelocityConfig;
}

export type RequestHook = (
  config: VelocityConfig,
) => VelocityConfig | Promise<VelocityConfig>;

export type ResponseHook = (
  response: VelocityResponse,
) => VelocityResponse | Promise<VelocityResponse>;

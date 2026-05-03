export interface FetchAdapterConfig extends RequestInit {
  url: string;
}

export async function fetchAdapter(
  config: FetchAdapterConfig,
): Promise<Response> {
  const { url, ...rest } = config;

  return fetch(url, rest);
}

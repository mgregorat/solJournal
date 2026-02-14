type TokenGetter = () => Promise<string | null | undefined>;
type RequestWithHeaders = {
  headers: {
    get: (name: string) => string | null;
  };
};

function withAuthHeaders(
  initHeaders: HeadersInit | undefined,
  token?: string | null,
  requestId?: string | null
): Headers {
  const headers = new Headers(initHeaders);
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  if (requestId) {
    headers.set("x-request-id", requestId);
  }
  return headers;
}

export async function authedFetchClient(
  getAccessToken: TokenGetter,
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = (await getAccessToken()) || null;
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[authedFetchClient] Missing Privy access token", {
        url: typeof input === "string" ? input : input.toString(),
      });
    }
    throw new Error("Missing Privy access token");
  }
  return fetch(input, {
    ...init,
    headers: withAuthHeaders(init.headers, token, null),
    cache: init.cache ?? "no-store",
  });
}

export async function authedFetchFromRequest(
  req: RequestWithHeaders,
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: withAuthHeaders(
      init.headers,
      req.headers.get("authorization"),
      req.headers.get("x-request-id")
    ),
    cache: init.cache ?? "no-store",
  });
}

export async function parseApiResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body?.error?.message ||
      body?.error ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return (body?.data ?? body) as T;
}

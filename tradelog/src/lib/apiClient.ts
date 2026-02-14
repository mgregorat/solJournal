export type ApiMeta = {
  requestId: string;
  durationMs?: number;
  route?: string;
  method?: string;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
};

export type ApiSuccessEnvelope<T> = {
  ok: true;
  data: T;
  meta: ApiMeta;
};

export type ApiErrorEnvelope = {
  ok: false;
  error: ApiErrorPayload;
  meta: ApiMeta;
};

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export class ApiClientError extends Error {
  status: number;
  code: string;
  meta?: ApiMeta;

  constructor(message: string, status: number, code: string, meta?: ApiMeta) {
    super(message);
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

export type ApiClientConfig = {
  getAccessToken?: () => Promise<string | null | undefined>;
};

export function createApiClient(config: ApiClientConfig = {}) {
  async function request<T>(
    input: RequestInfo | URL,
    init: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(init.headers || {});
    if (config.getAccessToken) {
      const token = await config.getAccessToken();
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
    }

    const response = await fetch(input, {
      ...init,
      headers,
      cache: init.cache ?? "no-store",
    });

    const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;
    const envelope = body as ApiEnvelope<T> | null;

    if (envelope && typeof envelope === "object" && "ok" in envelope) {
      if (envelope.ok) {
        return envelope.data;
      }
      const errorEnvelope = envelope as ApiErrorEnvelope;
      throw new ApiClientError(
        errorEnvelope.error?.message || "Request failed",
        response.status,
        errorEnvelope.error?.code || "unknown_error",
        errorEnvelope.meta
      );
    }

    if (!response.ok) {
      throw new ApiClientError(
        `Request failed with status ${response.status}`,
        response.status,
        "http_error"
      );
    }

    return body as T;
  }

  return {
    get: <T>(input: RequestInfo | URL, init: RequestInit = {}) =>
      request<T>(input, { ...init, method: "GET" }),
    post: <T>(input: RequestInfo | URL, body?: unknown, init: RequestInit = {}) =>
      request<T>(input, {
        ...init,
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(init.headers || {}),
        },
        body: body !== undefined ? JSON.stringify(body) : init.body,
      }),
    patch: <T>(input: RequestInfo | URL, body?: unknown, init: RequestInit = {}) =>
      request<T>(input, {
        ...init,
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(init.headers || {}),
        },
        body: body !== undefined ? JSON.stringify(body) : init.body,
      }),
    del: <T>(input: RequestInfo | URL, body?: unknown, init: RequestInit = {}) =>
      request<T>(input, {
        ...init,
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          ...(init.headers || {}),
        },
        body: body !== undefined ? JSON.stringify(body) : init.body,
      }),
  };
}

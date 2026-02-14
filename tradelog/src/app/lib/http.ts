import { NextRequest, NextResponse } from "next/server";
import { API_ERROR_CODES, ApiErrorCode } from "@/app/lib/errorCodes";

export type ApiMeta = {
  requestId: string;
  durationMs?: number;
  route?: string;
  method?: string;
};

export function getRequestId(req: NextRequest): string {
  const headerRequestId = req.headers.get("x-request-id")?.trim();
  if (headerRequestId) return headerRequestId;
  return crypto.randomUUID();
}

export function ok<T>(
  data: T,
  meta?: ApiMeta,
  init?: ResponseInit
): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      data,
      meta: meta ?? { requestId: "unknown" },
    },
    init
  );
}

export function fail(
  code: ApiErrorCode,
  message: string,
  status: number,
  meta?: ApiMeta,
  init?: ResponseInit
): NextResponse {
  let safeCode: ApiErrorCode = code;
  let safeMessage = message;
  let safeStatus = status;
  if (!API_ERROR_CODES.includes(code)) {
    safeCode = "internal_error";
    safeMessage = "Internal error";
    safeStatus = 500;
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: safeCode,
        message: safeMessage,
      },
      meta: meta ?? { requestId: "unknown" },
    },
    {
      status: safeStatus,
      ...init,
    }
  );
}

export class HttpError extends Error {
  code: ApiErrorCode;
  status: number;
  safeMessage: string;
  meta?: Partial<ApiMeta>;

  constructor(
    code: ApiErrorCode,
    safeMessage: string,
    status: number,
    meta?: Partial<ApiMeta>
  ) {
    super(safeMessage);
    this.code = code;
    this.status = status;
    this.safeMessage = safeMessage;
    this.meta = meta;
  }
}

export function throwHttp(
  code: ApiErrorCode,
  safeMessage: string,
  status: number,
  meta?: Partial<ApiMeta>
): never {
  throw new HttpError(code, safeMessage, status, meta);
}

export function handleRouteError(
  err: unknown,
  meta: ApiMeta
): NextResponse {
  if (err instanceof HttpError) {
    return fail(err.code, err.safeMessage, err.status, {
      ...meta,
      ...(err.meta || {}),
    });
  }
  return fail("internal_error", "Internal error", 500, meta);
}

type TimedHandlerResult<T> = {
  data: T;
  meta?: Partial<ApiMeta>;
  init?: ResponseInit;
};

export async function withTiming<T>(
  req: NextRequest,
  handler: (meta: ApiMeta) => Promise<TimedHandlerResult<T> | T>
): Promise<NextResponse> {
  const start = Date.now();
  const requestId = getRequestId(req);
  const route = new URL(req.url).pathname;
  const method = req.method;

  try {
    const result = await handler({ requestId, route, method });
    const durationMs = Date.now() - start;

    if (
      typeof result === "object" &&
      result !== null &&
      "data" in result
    ) {
      const typedResult = result as TimedHandlerResult<T>;
      return ok(typedResult.data, {
        requestId,
        route,
        method,
        durationMs,
        ...(typedResult.meta || {}),
      }, typedResult.init);
    }

    return ok(result as T, {
      requestId,
      route,
      method,
      durationMs,
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    return handleRouteError(err, { requestId, route, method, durationMs });
  }
}

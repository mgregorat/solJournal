export const API_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "bad_request",
  "not_found",
  "conflict",
  "wallet_validation_failed",
  "provider_unavailable",
  "provider_timeout",
  "rate_limited",
  "internal_error",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

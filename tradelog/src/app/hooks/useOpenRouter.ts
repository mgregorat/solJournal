"use client";

import { useCallback, useState } from "react";

type OpenRouterSuccess = {
  text: string;
  model: string;
};

type OpenRouterError = {
  error: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSuccess(value: unknown): OpenRouterSuccess | null {
  if (!isRecord(value)) return null;
  if (typeof value.text !== "string") return null;
  if (typeof value.model !== "string") return null;
  return { text: value.text, model: value.model };
}

function parseError(value: unknown): OpenRouterError | null {
  if (!isRecord(value)) return null;
  if (typeof value.error !== "string") return null;
  return { error: value.error };
}

export function useOpenRouter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  const run = useCallback(async (prompt: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/openrouter-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const parsedError = parseError(payload);
        throw new Error(parsedError?.error || `Request failed with status ${response.status}`);
      }

      const parsed = parseSuccess(payload);
      if (!parsed) {
        throw new Error("Invalid response format.");
      }

      setText(parsed.text);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setText(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, text, run };
}


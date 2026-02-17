type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterChatRequest = {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  signal?: AbortSignal;
};

type OpenRouterResponse = {
  ok: boolean;
  status: number;
  json: unknown;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function openRouterChatCompletion(
  request: OpenRouterChatRequest
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const referer = process.env.OPENROUTER_SITE_URL;
  const appName = process.env.OPENROUTER_APP_NAME;
  if (referer) headers["HTTP-Referer"] = referer;
  if (appName) headers["X-Title"] = appName;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
    }),
    signal: request.signal,
  });

  const json = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

import { NextRequest, NextResponse } from "next/server";
import { openrouter } from "@/lib/openrouter";

function getPromptFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  return typeof record.prompt === "string" ? record.prompt : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const prompt = getPromptFromBody(body);

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const completion = await openrouter.chat.completions.create({
      model: "meta-llama/llama-4-scout",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content;
    const text = typeof content === "string" ? content : "";

    return NextResponse.json({
      text,
      model: completion.model,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

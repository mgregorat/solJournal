"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOpenRouter } from "@/app/hooks/useOpenRouter";

export function OpenRouterPanel() {
  const [prompt, setPrompt] = useState("");
  const { loading, error, text, run } = useOpenRouter();

  const handleRun = async () => {
    if (!prompt.trim()) return;
    await run(prompt.trim());
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>OpenRouter Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Enter a prompt..."
          rows={6}
        />

        <Button onClick={() => void handleRun()} disabled={loading || !prompt.trim()}>
          {loading ? "Running..." : "Run"}
        </Button>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {text && (
          <div className="rounded-md border border-border bg-background/40 p-3 text-sm whitespace-pre-wrap">
            {text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


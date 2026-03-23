import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  try {
    const { tokens, title, body, data } = await req.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return new Response(JSON.stringify({ error: "No tokens provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages: PushMessage[] = tokens
      .filter((token: string) => token && token.startsWith("ExponentPushToken"))
      .map((token: string) => ({
        to: token,
        title,
        body,
        ...(data ? { data } : {}),
      }));

    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Expo Push API supports batches of up to 100
    const batchSize = 100;
    let totalSent = 0;

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error("Expo Push API error:", await response.text());
      } else {
        totalSent += batch.length;
      }
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

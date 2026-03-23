import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all players with push tokens
    const { data: players, error } = await supabase
      .from("players")
      .select("expo_push_token")
      .not("expo_push_token", "is", null);

    if (error) throw error;

    const tokens = (players ?? [])
      .map((p: { expo_push_token: string | null }) => p.expo_push_token)
      .filter(Boolean) as string[];

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens to notify" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call the send-push function
    const { error: invokeError } = await supabase.functions.invoke(
      "send-push",
      {
        body: {
          tokens,
          title: "FIFA Queue",
          body: "Queue is open! Tap to join",
        },
      }
    );

    if (invokeError) throw invokeError;

    return new Response(
      JSON.stringify({ message: `Notified ${tokens.length} players` }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

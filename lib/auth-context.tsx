import React, { createContext, useContext, useEffect, useState } from "react";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";
import type { Player } from "./types";
import type { Session } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri();

interface AuthContextType {
  player: Player | null;
  session: Session | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  player: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchPlayer(userId: string): Promise<Player | null> {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) return;

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) return;
  return data.session;
}

async function fetchOrCreatePlayer(user: Session["user"]): Promise<Player | null> {
  let p = await fetchPlayer(user.id);
  console.log("[Auth] Fetched player:", p?.id ?? "null");
  if (!p) {
    const meta = user.user_metadata;
    const email = user.email ?? meta.email;
    // Check for a pre-created player (admin "add by email") by google_id matching the email
    if (email) {
      const { data: preCreated } = await supabase
        .from("players")
        .select("*")
        .eq("google_id", email)
        .maybeSingle();
      if (preCreated) {
        // Update the pre-created record to use the real auth uid and Google metadata
        console.log("[Auth] Found pre-created player, updating:", preCreated.id, "->", user.id);
        await supabase
          .from("players")
          .update({
            id: user.id,
            google_id: meta.sub ?? meta.provider_id ?? user.id,
            name: meta.full_name ?? meta.name ?? preCreated.name,
            avatar_url: meta.avatar_url ?? meta.picture ?? preCreated.avatar_url,
          })
          .eq("id", preCreated.id);
        p = await fetchPlayer(user.id);
        if (p) return p;
      }
    }
    console.log("[Auth] Creating player for:", user.id, meta);
    const { error: insertError } = await supabase.from("players").insert({
      id: user.id,
      google_id: meta.sub ?? meta.provider_id ?? user.id,
      name: meta.full_name ?? meta.name ?? meta.email ?? "Player",
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
    });
    console.log("[Auth] Insert result:", insertError ? insertError.message : "success");
    if (insertError) {
      console.error("Failed to create player:", JSON.stringify(insertError));
    }
    p = await fetchPlayer(user.id);
    console.log("[Auth] Re-fetched player:", p?.id ?? "still null");
  }
  return p;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen for auth state changes (including INITIAL_SESSION)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      console.log("[Auth] State changed:", _event, s?.user?.id);
      setSession(s);
      if (_event === "INITIAL_SESSION" || _event === "SIGNED_IN" || _event === "SIGNED_OUT") {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch/create player when session changes (outside the lock)
  useEffect(() => {
    if (session?.user) {
      fetchOrCreatePlayer(session.user).then(setPlayer);
    } else {
      setPlayer(null);
    }
  }, [session?.user?.id]);

  // Handle deep link callback from OAuth
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      if (event.url) {
        await createSessionFromUrl(event.url);
      }
    };

    const subscription = Linking.addEventListener("url", handleUrl);

    // Check if app was opened via a deep link
    Linking.getInitialURL().then((url) => {
      if (url) createSessionFromUrl(url);
    });

    return () => subscription.remove();
  }, []);

  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) return;

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo
    );

    if (result.type === "success" && result.url) {
      await createSessionFromUrl(result.url);
    }
  };

  const signOut = async () => {
    // Clear local state immediately so UI updates even if API call fails
    setSession(null);
    setPlayer(null);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.log("[Auth] signOut API error (ignored):", e);
    }
  };

  return (
    <AuthContext.Provider value={{ player, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

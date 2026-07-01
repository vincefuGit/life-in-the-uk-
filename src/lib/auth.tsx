"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getStoredSessionId } from "./session";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const CLAIM_FLAG_KEY = "life-in-uk-history-claimed";

// The very first time this account signs in on a device that has pre-login
// history (attempts recorded under the old device-local session id), adopt
// those rows so the user's existing progress isn't stranded. Guarded by a
// localStorage flag so it only runs once per device.
async function claimDeviceHistory(userId: string) {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(CLAIM_FLAG_KEY)) return;

  const deviceSessionId = getStoredSessionId();
  if (deviceSessionId) {
    const { error } = await supabase
      .from("attempts")
      .update({ user_id: userId })
      .eq("session_id", deviceSessionId)
      .is("user_id", null);
    if (error) {
      // Non-fatal: worst case the old device-local rows just aren't imported.
      console.error("Failed to import device history:", error);
      return;
    }
  }
  window.localStorage.setItem(CLAIM_FLAG_KEY, "1");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) claimDeviceHistory(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
      if (next?.user) claimDeviceHistory(next.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

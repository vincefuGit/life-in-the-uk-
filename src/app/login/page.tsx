"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const { user, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  if (user) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">You&apos;re signed in</h1>
        <p className="text-black/60 dark:text-white/50">{user.email}</p>
        <p className="text-black/60 dark:text-white/50 max-w-sm">
          Your progress now syncs to this account. Sign in with the same email on
          any device to pick up where you left off.
        </p>
        <div className="flex gap-4">
          <Link
            href="/progress"
            className="rounded-md bg-blue-600 text-white px-4 py-2"
          >
            View my progress
          </Link>
          <button
            onClick={() => signOut()}
            className="rounded-md border border-black/15 dark:border-white/20 px-4 py-2"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-black/60 dark:text-white/50 max-w-sm text-center">
        Enter your email and we&apos;ll send you a magic link. No password. Sign
        in on each device with the same email to sync your progress.
      </p>

      {status === "sent" ? (
        <div className="max-w-sm text-center flex flex-col gap-3">
          <p className="text-green-600 font-medium">Check your email</p>
          <p className="text-black/60 dark:text-white/50">
            We sent a magic link to <span className="font-medium">{email}</span>.
            Open it on this device to finish signing in.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="text-sm underline text-black/60 dark:text-white/50"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="w-full max-w-sm flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-4 py-2"
          />
          <button
            type="submit"
            disabled={status === "sending" || email.trim() === ""}
            className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-40"
          >
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {status === "error" && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
        </form>
      )}

      <Link
        href="/"
        className="text-sm underline text-black/60 dark:text-white/50"
      >
        ← Back home
      </Link>
    </main>
  );
}

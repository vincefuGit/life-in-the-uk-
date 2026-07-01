"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// The magic link lands here. supabase-js (PKCE) sends a `?code=`; we exchange it
// for a session ourselves. We also handle the `?token_hash=` (email OTP) shape
// and surface any error the provider returned, then bounce to /progress.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function complete() {
      const url = new URL(window.location.href);
      const errorDescription =
        url.searchParams.get("error_description") ??
        new URLSearchParams(url.hash.replace(/^#/, "")).get("error_description");
      if (errorDescription) {
        setError(errorDescription);
        return;
      }

      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as "email" | "magiclink" | null) ?? "email",
          });
          if (error) throw error;
        } else {
          throw new Error("This sign-in link is missing its token.");
        }
        router.replace("/progress");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      }
    }
    complete();
  }, [router]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      {error ? (
        <>
          <h1 className="text-xl font-semibold">Couldn&apos;t sign you in</h1>
          <p className="text-black/60 dark:text-white/50 max-w-sm">{error}</p>
          <p className="text-black/50 dark:text-white/40 text-sm max-w-sm">
            Magic links expire and can only be used once — open the newest email,
            on the same device you requested it from.
          </p>
          <Link href="/login" className="rounded-md bg-blue-600 text-white px-4 py-2">
            Try again
          </Link>
        </>
      ) : (
        <p className="text-black/60 dark:text-white/50">Signing you in…</p>
      )}
    </main>
  );
}

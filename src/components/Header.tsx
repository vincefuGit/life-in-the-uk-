"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function Header() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm border-b border-black/10 dark:border-white/10">
      <Link href="/" className="font-semibold">
        Life in the UK
      </Link>
      <div className="flex items-center gap-3">
        {loading ? null : user ? (
          <>
            <span className="text-black/60 dark:text-white/50 truncate max-w-[160px] sm:max-w-[240px]">
              {user.email}
            </span>
            <button
              onClick={() => signOut()}
              className="underline text-black/60 dark:text-white/50"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="underline text-black/60 dark:text-white/50"
          >
            Sign in to sync
          </Link>
        )}
      </div>
    </header>
  );
}

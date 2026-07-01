"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";
import type { Attempt, Subsection } from "@/lib/types";

type SubsectionStats = {
  subsection: Subsection;
  total: number;
  correct: number;
  lastAttempt: string;
};

export default function ProgressPage() {
  const [stats, setStats] = useState<SubsectionStats[] | null>(null);
  const [totalAttempts, setTotalAttempts] = useState(0);

  useEffect(() => {
    async function loadProgress() {
      const sessionId = getSessionId();
      const [{ data: attempts }, { data: subsections }] = await Promise.all([
        supabase
          .from("attempts")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false }),
        supabase.from("subsections").select("*"),
      ]);

      const attemptRows = (attempts ?? []) as Attempt[];
      const subsectionById = new Map(
        (subsections ?? []).map((s: Subsection) => [s.id, s])
      );

      setTotalAttempts(attemptRows.length);

      const bySubsection = new Map<string, SubsectionStats>();
      for (const a of attemptRows) {
        const subsection = subsectionById.get(a.subsection_id);
        if (!subsection) continue;
        const existing = bySubsection.get(a.subsection_id);
        if (existing) {
          existing.total += 1;
          if (a.correct) existing.correct += 1;
        } else {
          bySubsection.set(a.subsection_id, {
            subsection,
            total: 1,
            correct: a.correct ? 1 : 0,
            lastAttempt: a.created_at,
          });
        }
      }

      const rows = [...bySubsection.values()].sort(
        (a, b) => a.correct / a.total - b.correct / b.total
      );
      setStats(rows);
    }
    loadProgress();
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-bold">My progress</h1>
      <Link href="/" className="text-sm underline text-black/60 dark:text-white/50">
        ← Back home
      </Link>

      {stats === null ? (
        <p>Loading…</p>
      ) : stats.length === 0 ? (
        <p className="text-black/60 dark:text-white/50">
          No attempts yet on this device — take a practice session or mock test first.
        </p>
      ) : (
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <p className="text-sm text-black/60 dark:text-white/50">
            {totalAttempts} questions answered on this device, across{" "}
            {stats.length} topic{stats.length === 1 ? "" : "s"}. Weakest topics first.
          </p>
          <div className="flex flex-col gap-2">
            {stats.map((s) => {
              const pct = Math.round((s.correct / s.total) * 100);
              return (
                <div
                  key={s.subsection.id}
                  className="rounded-md border border-black/10 dark:border-white/15 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.subsection.title}</span>
                    <span
                      className={
                        pct < 60
                          ? "text-red-600 font-semibold"
                          : pct < 80
                            ? "text-yellow-600 font-semibold"
                            : "text-green-600 font-semibold"
                      }
                    >
                      {pct}%
                    </span>
                  </div>
                  <p className="text-xs text-black/50 dark:text-white/40 mt-1">
                    {s.correct} / {s.total} correct
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

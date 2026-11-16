"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Question, Subsection } from "@/lib/types";
import {
  MISSED_DRILL_LIMIT,
  selectMissedQuestions,
  type RecentAttempt,
} from "@/lib/adaptive";
import QuizRunner from "@/components/QuizRunner";

// Supabase caps a single response at 1,000 rows, so page through the user's
// whole answer history. RLS scopes attempts to the signed-in user.
async function fetchAllAttempts(): Promise<RecentAttempt[]> {
  const pageSize = 1000;
  const all: RecentAttempt[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("attempts")
      .select("question_id, correct")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

export default function PracticePage() {
  const { user } = useAuth();
  const [subsections, setSubsections] = useState<Subsection[]>([]);
  // Questions the signed-in user keeps missing; null until loaded.
  const [missed, setMissed] = useState<Question[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubsections() {
      const { data } = await supabase
        .from("subsections")
        .select("*")
        .eq("quizzable", true)
        .order("order");
      setSubsections(data ?? []);
      setLoading(false);
    }
    loadSubsections();
  }, []);

  useEffect(() => {
    if (!user) {
      setMissed(null);
      return;
    }
    let cancelled = false;
    Promise.all([supabase.from("questions").select("*"), fetchAllAttempts()]).then(
      ([{ data: allQuestions }, attempts]) => {
        if (!cancelled) setMissed(selectMissedQuestions(allQuestions ?? [], attempts, Infinity));
      }
    );
    return () => {
      cancelled = true;
    };
    // Re-run after each drill/practice session so fixed questions drop out.
  }, [user, questions]);

  function toggleSubsection(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function startPractice() {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .in("subsection_id", selectedIds);
    setQuestions(data ?? []);
  }

  if (questions) {
    return (
      <main className="flex-1 flex flex-col items-center gap-6 p-8">
        <QuizRunner questions={questions} />
        <button
          onClick={() => {
            setQuestions(null);
            setSelectedIds([]);
          }}
          className="text-sm underline text-black/60 dark:text-white/50"
        >
          Choose different topics
        </button>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Practice by topic</h1>
      <Link href="/" className="text-sm underline text-black/60 dark:text-white/50">
        ← Back home
      </Link>

      {missed && missed.length > 0 && (
        <div className="w-full max-w-xl rounded-lg border border-red-600/30 bg-red-600/5 p-4 flex flex-col gap-2">
          <p className="font-semibold">Drill my misses</p>
          <p className="text-sm text-black/60 dark:text-white/50">
            {missed.length} question{missed.length === 1 ? "" : "s"} you got wrong
            last time or keep missing
            {missed.length > MISSED_DRILL_LIMIT
              ? ` — each session drills the ${MISSED_DRILL_LIMIT} most urgent`
              : ""}
            . Answer them correctly and they drop off the list.
          </p>
          <button
            onClick={() => setQuestions(missed.slice(0, MISSED_DRILL_LIMIT))}
            className="self-start rounded-md bg-red-600 text-white px-6 py-3"
          >
            Drill {Math.min(missed.length, MISSED_DRILL_LIMIT)} missed question
            {Math.min(missed.length, MISSED_DRILL_LIMIT) === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {loading ? (
        <p>Loading topics…</p>
      ) : (
        <div className="flex flex-col gap-2 w-full max-w-xl">
          {subsections.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-3 rounded-md border border-black/10 dark:border-white/15 px-4 py-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(s.id)}
                onChange={() => toggleSubsection(s.id)}
              />
              <span>
                <span className="text-black/50 dark:text-white/40 mr-2">
                  {s.id.split("-")[0]}
                </span>
                {s.title}
              </span>
            </label>
          ))}
        </div>
      )}

      <button
        onClick={startPractice}
        disabled={selectedIds.length === 0}
        className="rounded-md bg-blue-600 text-white px-6 py-3 disabled:opacity-40"
      >
        Start practice ({selectedIds.length} topic{selectedIds.length === 1 ? "" : "s"})
      </button>
    </main>
  );
}

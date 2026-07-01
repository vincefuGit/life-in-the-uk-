"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Question, Subsection } from "@/lib/types";
import QuizRunner from "@/components/QuizRunner";

export default function PracticePage() {
  const [subsections, setSubsections] = useState<Subsection[]>([]);
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Question } from "@/lib/types";
import { sample } from "@/lib/shuffle";
import QuizRunner from "@/components/QuizRunner";

const TEST_QUESTION_COUNT = 24;
const TEST_TIME_LIMIT_SECONDS = 45 * 60;
const PASS_THRESHOLD = 0.75;

export default function TestPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    async function loadTest() {
      // Every question is already tied to a quizzable subsection (see data/questions.json),
      // so the full table is the sampling pool.
      const { data } = await supabase.from("questions").select("*");
      setQuestions(sample(data ?? [], TEST_QUESTION_COUNT));
    }
    loadTest();
  }, [started]);

  if (started && questions === null) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p>Preparing your test…</p>
      </main>
    );
  }

  if (started && questions) {
    return (
      <main className="flex-1 flex flex-col items-center gap-6 p-8">
        <QuizRunner
          questions={questions}
          timeLimitSeconds={TEST_TIME_LIMIT_SECONDS}
          passThreshold={PASS_THRESHOLD}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">Mock test</h1>
      <p className="max-w-md text-black/60 dark:text-white/50">
        {TEST_QUESTION_COUNT} questions, randomly drawn from every topic, with a
        45-minute timer — just like the real test. You need {Math.round(PASS_THRESHOLD * 100)}%
        to pass. No two tests are the same.
      </p>
      <button
        onClick={() => setStarted(true)}
        className="rounded-md bg-blue-600 text-white px-6 py-3"
      >
        Start mock test
      </button>
      <Link href="/" className="text-sm underline text-black/60 dark:text-white/50">
        ← Back home
      </Link>
    </main>
  );
}

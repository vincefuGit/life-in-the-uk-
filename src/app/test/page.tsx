"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Attempt, Question } from "@/lib/types";
import { sample } from "@/lib/shuffle";
import {
  describeSelection,
  selectMockQuestions,
  RECENT_SEEN_WINDOW,
  type RecentAttempt,
} from "@/lib/adaptive";
import QuizRunner, { type QuizSummary } from "@/components/QuizRunner";

const TEST_QUESTION_COUNT = 24;
const TEST_TIME_LIMIT_SECONDS = 45 * 60;
const PASS_THRESHOLD = 0.75;
// Completed standard mock tests needed to unlock the weakest-topics test.
const WEAK_TEST_UNLOCK_COUNT = 50;

type TestKind = "mock" | "weak";

// Rank the user's attempted topics from worst accuracy up and pull questions
// from the weakest ones until a full test can be drawn. Topics never practised
// are unknown -- their own kind of weak -- so they pad the pool if the
// attempted topics alone are too few.
function buildWeakPool(
  attempts: Pick<Attempt, "subsection_id" | "correct">[],
  questions: Question[]
): Question[] {
  const statsBySub = new Map<string, { total: number; correct: number }>();
  for (const a of attempts) {
    const s = statsBySub.get(a.subsection_id) ?? { total: 0, correct: 0 };
    s.total += 1;
    if (a.correct) s.correct += 1;
    statsBySub.set(a.subsection_id, s);
  }

  const questionsBySub = new Map<string, Question[]>();
  for (const q of questions) {
    const list = questionsBySub.get(q.subsection_id);
    if (list) list.push(q);
    else questionsBySub.set(q.subsection_id, [q]);
  }

  const weakestFirst = [...statsBySub.entries()]
    .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
    .map(([id]) => id);

  const pool: Question[] = [];
  for (const id of weakestFirst) {
    pool.push(...(questionsBySub.get(id) ?? []));
    if (pool.length >= TEST_QUESTION_COUNT) return pool;
  }
  for (const [id, qs] of questionsBySub) {
    if (statsBySub.has(id)) continue;
    pool.push(...qs);
    if (pool.length >= TEST_QUESTION_COUNT) return pool;
  }
  return pool;
}

export default function TestPage() {
  const { user, loading: authLoading } = useAuth();
  const [kind, setKind] = useState<TestKind | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [calibrationNote, setCalibrationNote] = useState<string | undefined>();
  const [mockTestCount, setMockTestCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setMockTestCount(null);
      return;
    }
    supabase
      .from("mock_tests")
      .select("*", { count: "exact", head: true })
      .eq("kind", "mock")
      .then(({ count }) => setMockTestCount(count ?? 0));
  }, [user]);

  async function startTest(nextKind: TestKind) {
    setKind(nextKind);
    if (nextKind === "mock") {
      // Every question is already tied to a quizzable subsection (see data/questions.json),
      // so the full table is the sampling pool. The difficulty mix adapts to the
      // signed-in user's recent accuracy; signed-out users get the standard mix.
      const [{ data }, { data: recent }] = await Promise.all([
        supabase.from("questions").select("*"),
        user
          ? supabase
              .from("attempts")
              .select("question_id, correct")
              .order("created_at", { ascending: false })
              .limit(RECENT_SEEN_WINDOW)
          : Promise.resolve({ data: [] as RecentAttempt[] }),
      ]);
      const selection = selectMockQuestions(
        data ?? [],
        recent ?? [],
        TEST_QUESTION_COUNT
      );
      setCalibrationNote(describeSelection(selection));
      setQuestions(selection.questions);
    } else {
      // RLS already scopes attempts to the signed-in user.
      const [{ data: attempts }, { data: allQuestions }] = await Promise.all([
        supabase.from("attempts").select("subsection_id, correct"),
        supabase.from("questions").select("*"),
      ]);
      setQuestions(
        sample(buildWeakPool(attempts ?? [], allQuestions ?? []), TEST_QUESTION_COUNT)
      );
    }
  }

  function recordTestResult(summary: QuizSummary) {
    if (!user || !kind) return;
    // supabase-js query builders are lazy "thenables" -- the request is only sent
    // once .then()/await runs, so this must be chained (not just constructed) to fire.
    supabase
      .from("mock_tests")
      .insert({
        user_id: user.id,
        kind,
        correct: summary.correct,
        total: summary.total,
      })
      .then(({ error }) => {
        if (error) console.error("Failed to record test:", error);
        else if (kind === "mock") setMockTestCount((c) => (c ?? 0) + 1);
      });
  }

  if (kind && questions === null) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p>Preparing your test…</p>
      </main>
    );
  }

  if (kind && questions) {
    return (
      <main className="flex-1 flex flex-col items-center gap-6 p-8">
        <QuizRunner
          questions={questions}
          timeLimitSeconds={TEST_TIME_LIMIT_SECONDS}
          passThreshold={PASS_THRESHOLD}
          calibrationNote={kind === "mock" ? calibrationNote : undefined}
          onFinish={recordTestResult}
        />
      </main>
    );
  }

  const unlocked = user !== null && (mockTestCount ?? 0) >= WEAK_TEST_UNLOCK_COUNT;
  const unlockPct = Math.min(
    100,
    Math.round(((mockTestCount ?? 0) / WEAK_TEST_UNLOCK_COUNT) * 100)
  );

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">Mock test</h1>
      <p className="max-w-md text-black/60 dark:text-white/50">
        {TEST_QUESTION_COUNT} questions, randomly drawn from every topic, with a
        45-minute timer — just like the real test. You need {Math.round(PASS_THRESHOLD * 100)}%
        to pass. No two tests are the same, and the difficulty mix adapts to
        your recent results.
      </p>
      <button
        onClick={() => startTest("mock")}
        className="rounded-md bg-blue-600 text-white px-6 py-3"
      >
        Start mock test
      </button>

      <div className="w-full max-w-md rounded-lg border border-black/10 dark:border-white/15 p-4 flex flex-col gap-2 text-left">
        <p className="font-semibold">Weakest topics test</p>
        {unlocked ? (
          <>
            <p className="text-sm text-black/60 dark:text-white/50">
              Same format, but every question is drawn from the topics you get
              wrong most often.
            </p>
            <button
              onClick={() => startTest("weak")}
              className="rounded-md bg-red-600 text-white px-6 py-3"
            >
              Start weakest topics test
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-black/60 dark:text-white/50">
              🔒 Unlocks after {WEAK_TEST_UNLOCK_COUNT} completed mock tests
              {user && mockTestCount !== null
                ? ` — ${mockTestCount} of ${WEAK_TEST_UNLOCK_COUNT} so far.`
                : "."}
            </p>
            {user && mockTestCount !== null ? (
              <div className="h-2 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-blue-600"
                  style={{ width: `${unlockPct}%` }}
                />
              </div>
            ) : !authLoading && !user ? (
              <p className="text-sm text-black/60 dark:text-white/50">
                <Link href="/login" className="underline">
                  Sign in
                </Link>{" "}
                so your mock tests count toward the unlock.
              </p>
            ) : null}
          </>
        )}
      </div>

      <Link href="/" className="text-sm underline text-black/60 dark:text-white/50">
        ← Back home
      </Link>
    </main>
  );
}

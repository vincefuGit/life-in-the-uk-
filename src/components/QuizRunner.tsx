"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { shuffle } from "@/lib/shuffle";
import type { Question } from "@/lib/types";

type ShuffledQuestion = {
  question: Question;
  options: { text: string; originalIndex: number }[];
};

type Props = {
  questions: Question[];
  timeLimitSeconds?: number;
  passThreshold?: number;
  onFinish?: () => void;
};

function shuffleQuestion(question: Question): ShuffledQuestion {
  const options = shuffle(
    question.options.map((text, originalIndex) => ({ text, originalIndex }))
  );
  return { question, options };
}

// Highlights the right answer(s) plus the contextual source fact. Shown whenever
// an answer was wrong -- both instantly after checking and in the end review.
function CorrectAnswerNote({ question }: { question: Question }) {
  const correctAnswers = question.correct_answers.map((i) => question.options[i]);
  return (
    <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="font-medium text-amber-800 dark:text-amber-300">
        Correct answer{correctAnswers.length > 1 ? "s" : ""}:{" "}
        {correctAnswers.join(", ")}
      </p>
      {question.source_fact && (
        <p className="mt-1 text-black/70 dark:text-white/70">{question.source_fact}</p>
      )}
    </div>
  );
}

export default function QuizRunner({
  questions,
  timeLimitSeconds,
  passThreshold,
  onFinish,
}: Props) {
  const { user } = useAuth();

  const shuffledQuestions = useMemo(
    () => shuffle(questions).map(shuffleQuestion),
    [questions]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<
    { question: Question; selectedOriginalIndices: number[]; correct: boolean }[]
  >([]);
  const [finished, setFinished] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds ?? null);

  const current = shuffledQuestions[currentIndex];

  function finishQuiz() {
    setFinished(true);
    onFinish?.();
  }

  useEffect(() => {
    if (secondsLeft === null || finished) return;
    if (secondsLeft <= 0) {
      const id = setTimeout(finishQuiz, 0);
      return () => clearTimeout(id);
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, finished]);

  function toggleOption(originalIndex: number) {
    if (revealed) return;
    if (current.question.multi_select) {
      setSelected((prev) =>
        prev.includes(originalIndex)
          ? prev.filter((i) => i !== originalIndex)
          : [...prev, originalIndex]
      );
    } else {
      setSelected([originalIndex]);
    }
  }

  function isCorrectSelection(question: Question, selectedIndices: number[]) {
    const correctSet = new Set(question.correct_answers);
    const selectedSet = new Set(selectedIndices);
    if (correctSet.size !== selectedSet.size) return false;
    for (const i of correctSet) if (!selectedSet.has(i)) return false;
    return true;
  }

  function checkAnswer() {
    const correct = isCorrectSelection(current.question, selected);
    setResults((prev) => [
      ...prev,
      { question: current.question, selectedOriginalIndices: selected, correct },
    ]);

    // Only signed-in answers are recorded, keyed to the account so progress
    // syncs across devices. Signed-out practice still works, it just isn't saved.
    if (user) {
      // supabase-js query builders are lazy "thenables" -- the request is only sent
      // once .then()/await runs, so this must be chained (not just constructed) to fire.
      supabase
        .from("attempts")
        .insert({
          user_id: user.id,
          question_id: current.question.id,
          subsection_id: current.question.subsection_id,
          correct,
        })
        .then(({ error }) => {
          if (error) console.error("Failed to record attempt:", error);
        });
    }

    setRevealed(true);
  }

  function goNext() {
    setRevealed(false);
    setSelected([]);
    if (currentIndex + 1 >= shuffledQuestions.length) {
      finishQuiz();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  if (finished) {
    const correctCount = results.filter((r) => r.correct).length;
    const total = questions.length;
    const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passed = passThreshold != null ? correctCount / total >= passThreshold : null;

    return (
      <div className="flex flex-col gap-6 max-w-2xl w-full">
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-6">
          <h2 className="text-xl font-semibold">
            Score: {correctCount} / {total} ({scorePct}%)
          </h2>
          {passed !== null && (
            <p
              className={`mt-2 font-medium ${
                passed ? "text-green-600" : "text-red-600"
              }`}
            >
              {passed ? "Pass" : "Fail"} (threshold: {Math.round(passThreshold! * 100)}%)
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-semibold">Review</h3>
          {results.map((r, idx) => {
            return (
              <div
                key={r.question.id}
                className={`rounded-lg border p-4 ${
                  r.correct
                    ? "border-green-600/30"
                    : "border-red-600/40 bg-red-600/5"
                }`}
              >
                <p className="font-medium">
                  {idx + 1}. {r.question.question}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {r.question.options.map((opt, i) => {
                    const isCorrect = r.question.correct_answers.includes(i);
                    const wasSelected = r.selectedOriginalIndices.includes(i);
                    return (
                      <li
                        key={i}
                        className={
                          isCorrect
                            ? "text-green-700 dark:text-green-400 font-medium"
                            : wasSelected
                              ? "text-red-700 dark:text-red-400"
                              : ""
                        }
                      >
                        {isCorrect ? "✓ " : wasSelected ? "✗ " : "  "}
                        {opt}
                      </li>
                    );
                  })}
                </ul>
                {r.correct ? (
                  r.question.source_fact && (
                    <p className="mt-2 text-xs text-black/60 dark:text-white/50">
                      {r.question.source_fact}
                    </p>
                  )
                ) : (
                  <CorrectAnswerNote question={r.question} />
                )}
              </div>
            );
          })}
        </div>

        <Link
          href="/"
          className="self-start rounded-md bg-blue-600 text-white px-6 py-3 text-center"
        >
          Back to home
        </Link>
      </div>
    );
  }

  if (!current) {
    return <p>No questions available.</p>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl w-full">
      {!user && (
        <p className="rounded-md border border-yellow-600/30 bg-yellow-600/10 px-4 py-2 text-sm text-yellow-800 dark:text-yellow-300">
          You&apos;re not signed in, so this session won&apos;t be saved.{" "}
          <Link href="/login" className="underline font-medium">
            Sign in
          </Link>{" "}
          to track your progress across devices.
        </p>
      )}
      <div className="flex items-center justify-between text-sm text-black/60 dark:text-white/50">
        <span>
          Question {currentIndex + 1} of {shuffledQuestions.length}
        </span>
        {secondsLeft !== null && (
          <span className="font-mono">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-black/10 dark:border-white/15 p-6">
        <p className="text-lg font-medium">{current.question.question}</p>
        {current.question.multi_select && (
          <p className="mt-1 text-xs text-black/60 dark:text-white/50">
            Select {current.question.correct_answers.length} answers.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {current.options.map(({ text, originalIndex }) => {
            const isSelected = selected.includes(originalIndex);
            const isCorrect =
              current.question.correct_answers.includes(originalIndex);
            let optionClass: string;
            if (revealed) {
              if (isCorrect) {
                optionClass =
                  "border-green-600 bg-green-600/10 text-green-800 dark:text-green-300";
              } else if (isSelected) {
                optionClass =
                  "border-red-600 bg-red-600/10 text-red-700 dark:text-red-400";
              } else {
                optionClass = "border-black/15 dark:border-white/20 opacity-60";
              }
            } else if (isSelected) {
              optionClass = "border-blue-600 bg-blue-600/10";
            } else {
              optionClass =
                "border-black/15 dark:border-white/20 hover:border-black/30 dark:hover:border-white/40";
            }
            return (
              <button
                key={originalIndex}
                onClick={() => toggleOption(originalIndex)}
                disabled={revealed}
                className={`text-left rounded-md border px-4 py-2 transition-colors ${optionClass}`}
              >
                {revealed && isCorrect ? "✓ " : revealed && isSelected ? "✗ " : ""}
                {text}
              </button>
            );
          })}
        </div>

        {revealed &&
          (isCorrectSelection(current.question, selected) ? (
            <div className="mt-4 rounded-md border border-green-600/40 bg-green-600/10 p-3 text-sm">
              <p className="font-medium text-green-700 dark:text-green-400">
                Correct ✓
              </p>
              {current.question.source_fact && (
                <p className="mt-1 text-black/70 dark:text-white/70">
                  {current.question.source_fact}
                </p>
              )}
            </div>
          ) : (
            <CorrectAnswerNote question={current.question} />
          ))}

        {revealed ? (
          <button
            onClick={goNext}
            className="mt-6 rounded-md bg-blue-600 text-white px-4 py-2"
          >
            {currentIndex + 1 >= shuffledQuestions.length ? "Finish" : "Next"}
          </button>
        ) : (
          <button
            onClick={checkAnswer}
            disabled={selected.length === 0}
            className="mt-6 rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-40"
          >
            Check answer
          </button>
        )}
      </div>
    </div>
  );
}

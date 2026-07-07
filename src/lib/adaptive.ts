import type { Attempt, Difficulty, Question } from "@/lib/types";
import { shuffle } from "@/lib/shuffle";

// Rolling window used to measure recent accuracy (~2 full mock tests).
const CALIBRATION_WINDOW = 48;
// Below this many recorded answers the accuracy signal is too noisy to act on.
const MIN_ATTEMPTS_FOR_CALIBRATION = 24;
// Questions answered within this many recent attempts (~6 tests) are avoided.
export const RECENT_SEEN_WINDOW = 150;

export type RecentAttempt = Pick<Attempt, "question_id" | "correct">;

export type Calibration = {
  // Questions per difficulty tier, indexed by [easy, medium, hard]; sums to the test size.
  quota: [number, number, number];
  label: string;
  // Fraction correct over the calibration window, or null when uncalibrated.
  accuracy: number | null;
};

const DEFAULT_QUOTA: [number, number, number] = [7, 11, 6];

// Attempts must be ordered newest first (the caller queries with
// `order("created_at", { ascending: false })`).
export function computeQuota(recentAttempts: RecentAttempt[]): Calibration {
  if (recentAttempts.length < MIN_ATTEMPTS_FOR_CALIBRATION) {
    return { quota: DEFAULT_QUOTA, label: "standard mix", accuracy: null };
  }
  const window = recentAttempts.slice(0, CALIBRATION_WINDOW);
  const accuracy = window.filter((a) => a.correct).length / window.length;

  if (accuracy < 0.6)
    return { quota: [10, 10, 4], label: "building foundations", accuracy };
  if (accuracy < 0.75)
    return { quota: [8, 10, 6], label: "approaching pass level", accuracy };
  if (accuracy < 0.9)
    return { quota: [5, 10, 9], label: "exam-ready", accuracy };
  return { quota: [3, 8, 13], label: "mastery — hardest mix", accuracy };
}

// Round-robin across chapters (shuffled within each chapter) so a draw from
// one tier still spans the whole handbook instead of clustering in a chapter.
function interleaveByChapter(questions: Question[]): Question[] {
  const byChapter = new Map<number, Question[]>();
  for (const q of questions) {
    const chapter = parseInt(q.subsection_id, 10);
    const bucket = byChapter.get(chapter);
    if (bucket) bucket.push(q);
    else byChapter.set(chapter, [q]);
  }
  const buckets = shuffle([...byChapter.values()].map((b) => shuffle(b)));
  const result: Question[] = [];
  for (let i = 0; result.length < questions.length; i++) {
    for (const bucket of buckets) {
      if (i < bucket.length) result.push(bucket[i]);
    }
  }
  return result;
}

export type MockSelection = Calibration & { questions: Question[] };

// Picks the set of questions for a mock test: fills each difficulty quota with
// questions the user hasn't seen recently (chapter-interleaved), topping up
// with the longest-unseen ones, and spilling unmet quota into other tiers so a
// full test always comes back whenever the bank is big enough.
export function selectMockQuestions(
  allQuestions: Question[],
  recentAttempts: RecentAttempt[],
  count = 24
): MockSelection {
  const calibration = computeQuota(recentAttempts);

  // Recency rank: lower = seen more recently (attempts are newest first).
  const seenRank = new Map<string, number>();
  recentAttempts.slice(0, RECENT_SEEN_WINDOW).forEach((a, i) => {
    if (!seenRank.has(a.question_id)) seenRank.set(a.question_id, i);
  });

  const picked: Question[] = [];
  const pickedIds = new Set<string>();

  const drawTier = (tier: Difficulty, wanted: number): number => {
    if (wanted <= 0) return 0;
    const candidates = allQuestions.filter(
      (q) => q.difficulty === tier && !pickedIds.has(q.id)
    );
    const fresh = interleaveByChapter(candidates.filter((q) => !seenRank.has(q.id)));
    const stale = candidates
      .filter((q) => seenRank.has(q.id))
      .sort((a, b) => seenRank.get(b.id)! - seenRank.get(a.id)!);
    const take = [...fresh, ...stale].slice(0, wanted);
    for (const q of take) {
      picked.push(q);
      pickedIds.add(q.id);
    }
    return take.length;
  };

  const tiers: Difficulty[] = [1, 2, 3];
  let shortfall = 0;
  tiers.forEach((tier, i) => {
    shortfall += calibration.quota[i] - drawTier(tier, calibration.quota[i]);
  });
  // Spill unmet quota into whichever tiers still have questions, nearest first.
  for (const tier of [2, 3, 1] as Difficulty[]) {
    if (shortfall <= 0) break;
    shortfall -= drawTier(tier, shortfall);
  }

  return { ...calibration, questions: picked.slice(0, count) };
}

export function describeSelection(selection: MockSelection): string {
  const [easy, medium, hard] = selection.quota;
  const mix = `${easy} easy · ${medium} medium · ${hard} hard`;
  if (selection.accuracy === null) {
    return `Standard mix: ${mix}`;
  }
  const pct = Math.round(selection.accuracy * 100);
  return `Calibrated to your recent accuracy (${pct}%) — ${selection.label}: ${mix}`;
}

export type Subsection = {
  id: string;
  chapter: number;
  chapter_title: string;
  title: string;
  order: number;
  quizzable: boolean;
};

// 1 = easy (headline facts), 2 = medium (secondary facts),
// 3 = hard (niche exam-trap material: exact dates, counts, minor figures).
export type Difficulty = 1 | 2 | 3;

export type Question = {
  id: string;
  subsection_id: string;
  question: string;
  options: string[];
  correct_answers: number[];
  multi_select: boolean;
  source_fact: string | null;
  difficulty: Difficulty;
};

export type Attempt = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  question_id: string;
  subsection_id: string;
  correct: boolean;
  created_at: string;
};

export type MockTest = {
  id: string;
  user_id: string;
  kind: "mock" | "weak";
  correct: number;
  total: number;
  created_at: string;
};

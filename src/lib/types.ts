export type Subsection = {
  id: string;
  chapter: number;
  chapter_title: string;
  title: string;
  order: number;
  quizzable: boolean;
};

export type Question = {
  id: string;
  subsection_id: string;
  question: string;
  options: string[];
  correct_answers: number[];
  multi_select: boolean;
  source_fact: string | null;
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

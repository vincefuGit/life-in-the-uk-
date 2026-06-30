create table if not exists subsections (
  id text primary key,
  chapter int not null,
  chapter_title text not null,
  title text not null,
  "order" int not null,
  quizzable boolean not null default true
);

create table if not exists questions (
  id text primary key,
  subsection_id text not null references subsections(id),
  question text not null,
  options jsonb not null,
  correct_answers jsonb not null,
  multi_select boolean not null default false,
  source_fact text
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  question_id text not null references questions(id),
  subsection_id text not null references subsections(id),
  correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists attempts_session_id_idx on attempts(session_id);
create index if not exists questions_subsection_id_idx on questions(subsection_id);

alter table subsections enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;

drop policy if exists "subsections_select_anon" on subsections;
create policy "subsections_select_anon" on subsections for select to anon using (true);

drop policy if exists "questions_select_anon" on questions;
create policy "questions_select_anon" on questions for select to anon using (true);

drop policy if exists "attempts_select_anon" on attempts;
create policy "attempts_select_anon" on attempts for select to anon using (true);

drop policy if exists "attempts_insert_anon" on attempts;
create policy "attempts_insert_anon" on attempts for insert to anon with check (true);

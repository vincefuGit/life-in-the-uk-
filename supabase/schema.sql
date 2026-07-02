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
  -- Owned by an auth user so progress follows the account across devices.
  -- session_id is a legacy/pre-login device marker, kept only for migration.
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  question_id text not null references questions(id),
  subsection_id text not null references subsections(id),
  correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_id_idx on attempts(user_id);
create index if not exists attempts_session_id_idx on attempts(session_id);
create index if not exists questions_subsection_id_idx on questions(subsection_id);

alter table subsections enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;

-- Public reference data: readable by both anonymous and signed-in users.
-- (Scoping these `to anon` alone would hide them from authenticated users.)
drop policy if exists "subsections_select_anon" on subsections;
drop policy if exists "subsections_select_all" on subsections;
create policy "subsections_select_all" on subsections
  for select to anon, authenticated using (true);

drop policy if exists "questions_select_anon" on questions;
drop policy if exists "questions_select_all" on questions;
create policy "questions_select_all" on questions
  for select to anon, authenticated using (true);

-- Attempts are private to the signed-in user who created them.
drop policy if exists "attempts_select_anon" on attempts;
drop policy if exists "attempts_insert_anon" on attempts;

drop policy if exists "attempts_select_own" on attempts;
create policy "attempts_select_own" on attempts
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "attempts_insert_own" on attempts;
create policy "attempts_insert_own" on attempts
  for insert to authenticated
  with check (auth.uid() = user_id);

-- One-time migration aid: lets a signed-in user adopt still-unowned rows
-- (their pre-login, device-local history). Only ever touches unowned rows and
-- only to set the owner to the caller; inert once all rows are claimed.
drop policy if exists "attempts_claim_orphans" on attempts;
create policy "attempts_claim_orphans" on attempts
  for update to authenticated
  using (user_id is null)
  with check (auth.uid() = user_id);

-- One row per completed test sitting. Gates the weakest-topics test unlock
-- (the client counts kind='mock' rows for the signed-in user).
create table if not exists mock_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'mock' check (kind in ('mock', 'weak')),
  correct int not null,
  total int not null,
  created_at timestamptz not null default now()
);

create index if not exists mock_tests_user_id_idx on mock_tests(user_id);

alter table mock_tests enable row level security;

drop policy if exists "mock_tests_select_own" on mock_tests;
create policy "mock_tests_select_own" on mock_tests
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "mock_tests_insert_own" on mock_tests;
create policy "mock_tests_insert_own" on mock_tests
  for insert to authenticated
  with check (auth.uid() = user_id);

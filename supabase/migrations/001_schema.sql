-- Enable extensions (pg_cron and pg_net may not be available on all plans)
-- gen_random_uuid() is built-in to Postgres 13+

-- ============================================================
-- Tables
-- ============================================================

create table players (
  id uuid primary key default gen_random_uuid(),
  google_id text unique not null,
  name text not null,
  avatar_url text,
  elo integer not null default 1000,
  is_admin boolean not null default false,
  expo_push_token text,
  created_at timestamptz default now()
);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table queue_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) not null,
  season_id uuid references seasons(id) not null,
  date date not null default current_date,
  position integer not null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'done')),
  joined_at timestamptz default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id) not null,
  date date not null default current_date,
  started_at timestamptz default now(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed'))
);

create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) not null,
  player_id uuid references players(id) not null,
  team integer not null check (team in (1, 2)),
  elo_before integer not null,
  elo_after integer
);

create table game_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) unique not null,
  team1_goals integer not null,
  team2_goals integer not null,
  submitted_by uuid references players(id) not null,
  submitted_at timestamptz default now()
);

create table elo_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) not null,
  game_id uuid references games(id) not null,
  elo_before integer not null,
  elo_after integer not null,
  delta integer not null,
  recorded_at timestamptz default now()
);

-- ============================================================
-- Default Season
-- ============================================================

insert into seasons (name) values ('Season 1');

-- ============================================================
-- Indexes
-- ============================================================

create index idx_queue_entries_date_position on queue_entries(date, position);
create index idx_queue_entries_date_status on queue_entries(date, status);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table players enable row level security;
alter table seasons enable row level security;
alter table queue_entries enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table game_results enable row level security;
alter table elo_history enable row level security;

-- All authenticated users can SELECT on all tables
create policy "Authenticated users can read players"
  on players for select to authenticated using (true);

create policy "Authenticated users can read seasons"
  on seasons for select to authenticated using (true);

create policy "Authenticated users can read queue_entries"
  on queue_entries for select to authenticated using (true);

create policy "Authenticated users can read games"
  on games for select to authenticated using (true);

create policy "Authenticated users can read game_players"
  on game_players for select to authenticated using (true);

create policy "Authenticated users can read game_results"
  on game_results for select to authenticated using (true);

create policy "Authenticated users can read elo_history"
  on elo_history for select to authenticated using (true);

-- Players can INSERT queue_entries only for themselves
create policy "Players can insert own queue_entries"
  on queue_entries for insert to authenticated
  with check (player_id = auth.uid());

-- Players can INSERT game_results only if they are in game_players for that game
create policy "Game players can insert game_results"
  on game_results for insert to authenticated
  with check (
    exists (
      select 1 from game_players
      where game_players.game_id = game_results.game_id
        and game_players.player_id = auth.uid()
    )
  );

-- Players can UPDATE their own player row (for expo_push_token)
create policy "Players can update own record"
  on players for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Players can DELETE their own queue_entries (leave queue)
create policy "Players can delete own queue_entries"
  on queue_entries for delete to authenticated
  using (player_id = auth.uid());

-- Admin policies: admins can INSERT/UPDATE/DELETE on players, seasons, and override game_results
create policy "Admins can insert players"
  on players for insert to authenticated
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update any player"
  on players for update to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can delete players"
  on players for delete to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can insert seasons"
  on seasons for insert to authenticated
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update seasons"
  on seasons for update to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can delete seasons"
  on seasons for delete to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update game_results"
  on game_results for update to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can delete game_results"
  on game_results for delete to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

-- Admins can manage queue_entries (for reset queue)
create policy "Admins can update queue_entries"
  on queue_entries for update to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can delete queue_entries"
  on queue_entries for delete to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

-- Admins can manage games
create policy "Admins can insert games"
  on games for insert to authenticated
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update games"
  on games for update to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

-- Admins can manage game_players
create policy "Admins can insert game_players"
  on game_players for insert to authenticated
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update game_players"
  on game_players for update to authenticated
  using (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

-- Admins can insert elo_history
create policy "Admins can insert elo_history"
  on elo_history for insert to authenticated
  with check (
    exists (select 1 from players where id = auth.uid() and is_admin = true)
  );

-- ============================================================
-- Non-admin RLS policies for game flow (startGame, submitResult)
-- ============================================================

-- Users can create their own player record on first sign-in
create policy "Users can create their own player record"
  on players for insert to authenticated
  with check (id = auth.uid());

-- Any authenticated user can start a game
create policy "Authenticated users can start games"
  on games for insert to authenticated with check (true);

-- Any authenticated user can insert game_players (part of starting a game)
create policy "Authenticated users can insert game_players"
  on game_players for insert to authenticated with check (true);

-- Game participants can update game_players in their game (for elo_after)
create policy "Game participants can update game_players"
  on game_players for update to authenticated
  using (game_id in (select gp.game_id from game_players gp where gp.player_id = auth.uid()));

-- Game participants can update game status to completed
create policy "Game participants can update games"
  on games for update to authenticated
  using (id in (select gp.game_id from game_players gp where gp.player_id = auth.uid()));

-- Authenticated users can update queue_entries (for game flow - status changes, position reordering)
create policy "Authenticated users can update queue_entries"
  on queue_entries for update to authenticated using (true);

-- Authenticated users can insert elo_history (for result submission)
create policy "Authenticated users can insert elo_history"
  on elo_history for insert to authenticated with check (true);

-- Players can update other players' ELO (needed for result submission flow)
create policy "Game participants can update player elo"
  on players for update to authenticated
  using (true)
  with check (true);

-- ============================================================
-- pg_cron: open queue at 11:00 Mon-Fri Europe/Reykjavik
-- ============================================================
-- Note: Replace <project> and <service_role_key> with actual values
-- This must be run after the Supabase project is set up

-- select cron.schedule(
--   'open-queue',
--   '0 11 * * 1-5',
--   $$
--   select net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/open-queue',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   )
--   $$
-- );

-- Atomic submit_result RPC: handles result insertion, ELO calculation,
-- game completion, and queue rotation in a single transaction.
create or replace function submit_result(
  p_game_id uuid,
  p_team1_goals integer,
  p_team2_goals integer,
  p_submitted_by uuid
) returns void language plpgsql security definer as $$
declare
  v_game record;
  v_gp record;
  v_winning_team integer;
  v_team1_avg_elo numeric;
  v_team2_avg_elo numeric;
  v_opponent_elo numeric;
  v_expected numeric;
  v_new_elo integer;
  v_delta integer;
  v_pos integer := 1;
  v_entry record;
begin
  -- Validate draw
  if p_team1_goals = p_team2_goals then
    raise exception 'Draws are not allowed';
  end if;

  -- Validate submitter is in the game
  if not exists (
    select 1 from game_players where game_id = p_game_id and player_id = p_submitted_by
  ) then
    raise exception 'Only players in the game can submit results';
  end if;

  -- Validate game is active
  select * into v_game from games where id = p_game_id and status = 'active';
  if not found then
    raise exception 'Game not found or already completed';
  end if;

  -- Insert game result
  insert into game_results (game_id, team1_goals, team2_goals, submitted_by)
  values (p_game_id, p_team1_goals, p_team2_goals, p_submitted_by);

  -- Determine winning team
  v_winning_team := case when p_team1_goals > p_team2_goals then 1 else 2 end;

  -- Calculate team average ELOs
  select coalesce(avg(elo_before), 1000) into v_team1_avg_elo
  from game_players where game_id = p_game_id and team = 1;

  select coalesce(avg(elo_before), 1000) into v_team2_avg_elo
  from game_players where game_id = p_game_id and team = 2;

  -- Update ELO for each player
  for v_gp in select * from game_players where game_id = p_game_id loop
    v_opponent_elo := case when v_gp.team = 1 then v_team2_avg_elo else v_team1_avg_elo end;
    v_expected := 1.0 / (1.0 + power(10.0, (v_opponent_elo - v_gp.elo_before) / 400.0));
    v_new_elo := round(v_gp.elo_before + 32 * (
      case when v_gp.team = v_winning_team then 1.0 else 0.0 end - v_expected
    ));
    v_delta := v_new_elo - v_gp.elo_before;

    -- Update game_player
    update game_players set elo_after = v_new_elo where id = v_gp.id;

    -- Update player current ELO
    update players set elo = v_new_elo where id = v_gp.player_id;

    -- Insert ELO history
    insert into elo_history (player_id, game_id, elo_before, elo_after, delta)
    values (v_gp.player_id, p_game_id, v_gp.elo_before, v_new_elo, v_delta);
  end loop;

  -- Mark game as completed
  update games set status = 'completed', ended_at = now() where id = p_game_id;

  -- Rotate queue: winners to front, losers to back
  -- 1. Set winners to front positions
  for v_gp in select * from game_players where game_id = p_game_id and team = v_winning_team loop
    update queue_entries
    set status = 'waiting', position = v_pos
    where player_id = v_gp.player_id
      and date = v_game.date
      and status = 'playing';
    v_pos := v_pos + 1;
  end loop;

  -- 2. Shift existing waiting entries
  for v_entry in
    select id from queue_entries
    where season_id = v_game.season_id
      and date = v_game.date
      and status = 'waiting'
      and player_id not in (
        select player_id from game_players where game_id = p_game_id
      )
    order by position asc
  loop
    update queue_entries set position = v_pos where id = v_entry.id;
    v_pos := v_pos + 1;
  end loop;

  -- 3. Set losers to back
  for v_gp in select * from game_players where game_id = p_game_id and team != v_winning_team loop
    update queue_entries
    set status = 'waiting', position = v_pos
    where player_id = v_gp.player_id
      and date = v_game.date
      and status = 'playing';
    v_pos := v_pos + 1;
  end loop;
end;
$$;

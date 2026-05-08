-- Migration 008: admin overrides for submit_result, reject_game RPC, cancelled game status.

-- 1. Allow 'cancelled' as a games.status value.
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check
  CHECK (status IN ('active', 'completed', 'cancelled'));

-- 2. Replace submit_result so admins can also submit. Body is identical to
-- migration 005 except the submitter validation also accepts admins.
CREATE OR REPLACE FUNCTION submit_result(
  p_game_id uuid,
  p_team1_goals integer,
  p_team2_goals integer,
  p_submitted_by uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game record;
  v_gp record;
  v_is_draw boolean;
  v_winning_team integer;
  v_team1_avg_elo numeric;
  v_team2_avg_elo numeric;
  v_opponent_elo numeric;
  v_expected numeric;
  v_new_elo integer;
  v_delta integer;
  v_goal_diff integer;
  v_multiplier numeric;
  v_k numeric;
BEGIN
  -- Submitter must be in the game OR be an admin.
  IF NOT EXISTS (
    SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = p_submitted_by
  ) AND NOT EXISTS (
    SELECT 1 FROM players WHERE id = p_submitted_by AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only players in the game or admins can submit results';
  END IF;

  SELECT * INTO v_game FROM games WHERE id = p_game_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found or already completed';
  END IF;

  INSERT INTO game_results (game_id, team1_goals, team2_goals, submitted_by)
  VALUES (p_game_id, p_team1_goals, p_team2_goals, p_submitted_by);

  v_is_draw := p_team1_goals = p_team2_goals;
  v_winning_team := CASE WHEN p_team1_goals > p_team2_goals THEN 1 ELSE 2 END;

  v_goal_diff := abs(p_team1_goals - p_team2_goals);
  v_multiplier := CASE
    WHEN v_goal_diff <= 1 THEN 1.0
    WHEN v_goal_diff = 2 THEN 1.25
    WHEN v_goal_diff = 3 THEN 1.5
    WHEN v_goal_diff <= 5 THEN 1.75
    ELSE 2.0
  END;
  v_k := 32 * v_multiplier;

  IF NOT v_is_draw THEN
    SELECT coalesce(avg(elo_before), 1000) INTO v_team1_avg_elo
    FROM game_players WHERE game_id = p_game_id AND team = 1;

    SELECT coalesce(avg(elo_before), 1000) INTO v_team2_avg_elo
    FROM game_players WHERE game_id = p_game_id AND team = 2;

    FOR v_gp IN SELECT * FROM game_players WHERE game_id = p_game_id LOOP
      v_opponent_elo := CASE WHEN v_gp.team = 1 THEN v_team2_avg_elo ELSE v_team1_avg_elo END;
      v_expected := 1.0 / (1.0 + power(10.0, (v_opponent_elo - v_gp.elo_before) / 400.0));
      v_new_elo := round(v_gp.elo_before + v_k * (
        CASE WHEN v_gp.team = v_winning_team THEN 1.0 ELSE 0.0 END - v_expected
      ));
      v_delta := v_new_elo - v_gp.elo_before;

      UPDATE game_players SET elo_after = v_new_elo WHERE id = v_gp.id;
      UPDATE players SET elo = v_new_elo WHERE id = v_gp.player_id;
      INSERT INTO elo_history (player_id, game_id, elo_before, elo_after, delta)
      VALUES (v_gp.player_id, p_game_id, v_gp.elo_before, v_new_elo, v_delta);
    END LOOP;
  ELSE
    FOR v_gp IN SELECT * FROM game_players WHERE game_id = p_game_id LOOP
      UPDATE game_players SET elo_after = v_gp.elo_before WHERE id = v_gp.id;
      INSERT INTO elo_history (player_id, game_id, elo_before, elo_after, delta)
      VALUES (v_gp.player_id, p_game_id, v_gp.elo_before, v_gp.elo_before, 0);
    END LOOP;
  END IF;

  UPDATE games SET status = 'completed', ended_at = now() WHERE id = p_game_id;

  UPDATE queue_entries
  SET status = 'registered', position = 0, games_today = games_today + 1
  WHERE season_id = v_game.season_id
    AND date = v_game.date
    AND status = 'playing';
END;
$$;

-- 3. New RPC: reject_game cancels an active game. No result, no ELO change.
-- Players in the game and admins are allowed.
CREATE OR REPLACE FUNCTION reject_game(
  p_game_id uuid,
  p_rejected_by uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game record;
BEGIN
  -- Caller must be in the game OR be an admin.
  IF NOT EXISTS (
    SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = p_rejected_by
  ) AND NOT EXISTS (
    SELECT 1 FROM players WHERE id = p_rejected_by AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only players in the game or admins can reject';
  END IF;

  SELECT * INTO v_game FROM games WHERE id = p_game_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found or already completed';
  END IF;

  UPDATE games
  SET status = 'cancelled', ended_at = now()
  WHERE id = p_game_id;

  UPDATE queue_entries
  SET status = 'registered', position = 0
  WHERE season_id = v_game.season_id
    AND date = v_game.date
    AND status = 'playing'
    AND player_id IN (SELECT player_id FROM game_players WHERE game_id = p_game_id);
END;
$$;

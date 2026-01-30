-- Create active_game_sessions table for persistent game state
CREATE TABLE public.active_game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game text NOT NULL,
  bet_amount numeric NOT NULL,
  game_state jsonb NOT NULL DEFAULT '{}',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, game)
);

-- Enable RLS
ALTER TABLE public.active_game_sessions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.active_game_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON public.active_game_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.active_game_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.active_game_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
  ON public.active_game_sessions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for all needed tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Add trigger for updated_at
CREATE TRIGGER update_active_game_sessions_updated_at
  BEFORE UPDATE ON public.active_game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
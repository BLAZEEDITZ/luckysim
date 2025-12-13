-- Insert game-specific win probabilities
INSERT INTO public.game_settings (setting_key, setting_value) VALUES
  ('win_probability_slots', 0.15),
  ('win_probability_roulette', 0.15),
  ('win_probability_blackjack', 0.15),
  ('win_probability_plinko', 0.15),
  ('win_probability_mines', 0.15)
ON CONFLICT (setting_key) DO NOTHING;

-- Create user-specific win probability table
CREATE TABLE IF NOT EXISTS public.user_win_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  game TEXT NOT NULL,
  win_probability NUMERIC NOT NULL DEFAULT 0.15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, game)
);

-- Enable RLS
ALTER TABLE public.user_win_rates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage user win rates
CREATE POLICY "Admins can manage user win rates"
ON public.user_win_rates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add unique constraint on setting_key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_settings_setting_key_key'
  ) THEN
    ALTER TABLE public.game_settings ADD CONSTRAINT game_settings_setting_key_key UNIQUE (setting_key);
  END IF;
END $$;

-- Trigger for updated_at
CREATE TRIGGER update_user_win_rates_updated_at
BEFORE UPDATE ON public.user_win_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
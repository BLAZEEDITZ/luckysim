-- Fix RLS so users can read their own win rates & betting controls (required for priority logic in games)

-- user_win_rates: replace RESTRICTIVE admin policy with PERMISSIVE, then allow users to SELECT their own row
DROP POLICY IF EXISTS "Admins can manage user win rates" ON public.user_win_rates;

CREATE POLICY "Admins can manage user win rates"
ON public.user_win_rates
AS PERMISSIVE
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own win rate" ON public.user_win_rates;
CREATE POLICY "Users can view own win rate"
ON public.user_win_rates
FOR SELECT
USING (auth.uid() = user_id);

-- user_betting_controls: replace RESTRICTIVE admin policy with PERMISSIVE, then allow users to SELECT their own row
DROP POLICY IF EXISTS "Admins can manage betting controls" ON public.user_betting_controls;

CREATE POLICY "Admins can manage betting controls"
ON public.user_betting_controls
AS PERMISSIVE
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own betting controls" ON public.user_betting_controls;
CREATE POLICY "Users can view own betting controls"
ON public.user_betting_controls
FOR SELECT
USING (auth.uid() = user_id);

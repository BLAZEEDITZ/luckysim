-- Create game settings table for admin to control win rates
CREATE TABLE public.game_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;

-- Insert default win probability (15% - lower as requested)
INSERT INTO public.game_settings (setting_key, setting_value) 
VALUES ('win_probability', 0.15);

-- Policies: Anyone can read, only admins can update
CREATE POLICY "Anyone can read game settings" 
ON public.game_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can update game settings" 
ON public.game_settings 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));
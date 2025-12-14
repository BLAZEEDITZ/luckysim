-- Create table for user betting controls
CREATE TABLE public.user_betting_controls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  max_profit_limit numeric DEFAULT NULL,
  forced_wins_remaining integer DEFAULT 0,
  forced_losses_remaining integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_betting_controls ENABLE ROW LEVEL SECURITY;

-- Only admins can manage betting controls
CREATE POLICY "Admins can manage betting controls"
ON public.user_betting_controls
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_betting_controls_updated_at
BEFORE UPDATE ON public.user_betting_controls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
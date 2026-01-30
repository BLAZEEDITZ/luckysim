-- Enable realtime for profiles table to get instant balance updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
-- Add nickname column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Update the handle_new_user function to extract nickname from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, nickname)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'nickname'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

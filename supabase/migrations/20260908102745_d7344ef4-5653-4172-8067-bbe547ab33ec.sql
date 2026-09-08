CREATE TABLE public.reward_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  reward_id TEXT NOT NULL,
  title TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_id)
);
GRANT SELECT, INSERT ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own redemptions" ON public.reward_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own redemptions" ON public.reward_redemptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX reward_redemptions_user_idx ON public.reward_redemptions (user_id);
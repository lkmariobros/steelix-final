-- Agent code + status on public."user" (run once)

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS agent_code text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS agent_status text DEFAULT 'pending_approval';

CREATE INDEX IF NOT EXISTS idx_user_agent_code
  ON public."user" (agent_code)
  WHERE agent_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_agent_status
  ON public."user" (agent_status);

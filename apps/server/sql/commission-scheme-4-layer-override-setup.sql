ALTER TABLE public.commission_scheme_tiers
  ADD COLUMN IF NOT EXISTS immediate_upline_override_percent numeric(6,3) NOT NULL DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS team_manager_override_percent numeric(6,3) NOT NULL DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS group_manager_override_percent numeric(6,3) NOT NULL DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS director_override_percent numeric(6,3) NOT NULL DEFAULT 0.000;

-- Migrate legacy single override % into layer 1 (immediate upline).
UPDATE public.commission_scheme_tiers
SET immediate_upline_override_percent = override_percent
WHERE COALESCE(immediate_upline_override_percent, 0) = 0
  AND COALESCE(override_percent, 0) > 0;

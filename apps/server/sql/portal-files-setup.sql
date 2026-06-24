-- Portal file drive (agent + admin). Run once on your DB.
-- Also create a private Supabase Storage bucket (default name: portal-files).
-- Or set PORTAL_FILES_BUCKET in server .env to match your bucket (e.g. profile-files).

CREATE TABLE IF NOT EXISTS public.portal_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  parent_folder_id uuid REFERENCES public.portal_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_folders_owner
  ON public.portal_folders (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_portal_folders_parent
  ON public.portal_folders (parent_folder_id);

CREATE TABLE IF NOT EXISTS public.portal_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  folder_id uuid REFERENCES public.portal_folders(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL,
  uploaded_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_portal_files_owner
  ON public.portal_files (owner_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_portal_files_folder
  ON public.portal_files (folder_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_files_storage_path
  ON public.portal_files (storage_path)
  WHERE deleted_at IS NULL;

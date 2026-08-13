-- Fix RLS policies for auditoria_logs so that:
-- 1. Any authenticated user can INSERT logs (with their own user_id or null).
-- 2. Admins can SELECT all logs; regular users see only their own logs
--    (including logs where user_id is NULL that belong to their session).

DO $$
BEGIN
  -- DROP and recreate INSERT policy to be more permissive
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auditoria_logs' AND policyname = 'audit_logs_insert_own'
  ) THEN
    DROP POLICY "audit_logs_insert_own" ON auditoria_logs;
  END IF;

  CREATE POLICY "audit_logs_insert_own"
    ON auditoria_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

  -- DROP and recreate SELECT policy so admins see all and regular users see their own
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auditoria_logs' AND policyname = 'audit_logs_select_own'
  ) THEN
    DROP POLICY "audit_logs_select_own" ON auditoria_logs;
  END IF;

  CREATE POLICY "audit_logs_select_own"
    ON auditoria_logs
    FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    );
END $$;

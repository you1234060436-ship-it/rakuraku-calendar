-- =============================================================
-- 平文パスワード + 管理者リセット (v4)
--   accounts.id が bigint（整数型）に合わせた署名。
--   v3 (uuid版) の関数は DROP してから再作成する。
--
-- ⚠ 注意: plain_password は平文。社内運用のみで使用してください。
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) 列追加（存在しなければ）
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS plain_password text;

COMMENT ON COLUMN public.accounts.plain_password IS
  '管理者が参照できる平文パスワード（社内専用）。DB流出時は同時に流出することに注意。';

-- 2) 旧署名(uuid版) の関数があれば破棄
DROP FUNCTION IF EXISTS public.admin_reset_password(uuid, text);
DROP FUNCTION IF EXISTS public.admin_set_plain_password(uuid, text);

-- 3) admin_reset_password : auth.users と accounts.plain_password 同時更新
--    accounts.id が bigint のため p_account_id を bigint で受ける
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_account_id bigint,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_target_auth uuid;
BEGIN
  IF p_new_password IS NULL OR char_length(p_new_password) < 4 THEN
    RAISE EXCEPTION 'password too short (min 4 chars)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts c
    INNER JOIN public.accounts t ON t.company_id = c.company_id
    WHERE c.auth_uid = auth.uid()
      AND c.role IN ('master', 'admin')
      AND t.id = p_account_id
  ) THEN
    RAISE EXCEPTION 'permission denied or target not in same company';
  END IF;

  v_target_auth := (
    SELECT auth_uid FROM public.accounts WHERE id = p_account_id LIMIT 1
  );

  IF v_target_auth IS NULL THEN
    RAISE EXCEPTION 'account not found';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = v_target_auth;

  UPDATE public.accounts
  SET plain_password = p_new_password
  WHERE id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_password(bigint, text) TO authenticated;

-- 4) admin_set_plain_password : 新規作成直後の平文保存用
CREATE OR REPLACE FUNCTION public.admin_set_plain_password(
  p_account_id bigint,
  p_plain_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_plain_password IS NULL OR char_length(p_plain_password) < 4 THEN
    RAISE EXCEPTION 'password too short (min 4 chars)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts c
    INNER JOIN public.accounts t ON t.company_id = c.company_id
    WHERE c.auth_uid = auth.uid()
      AND c.role IN ('master', 'admin')
      AND t.id = p_account_id
  ) THEN
    RAISE EXCEPTION 'permission denied or target not in same company';
  END IF;

  UPDATE public.accounts
  SET plain_password = p_plain_password
  WHERE id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_plain_password(bigint, text) TO authenticated;

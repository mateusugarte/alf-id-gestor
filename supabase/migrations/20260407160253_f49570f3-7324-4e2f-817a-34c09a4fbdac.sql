-- Revoke direct RPC access to has_role from authenticated and anon roles
-- RLS policies will still work as they run with elevated privileges
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, public;
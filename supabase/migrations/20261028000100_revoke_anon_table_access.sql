-- Signed-out visitors (the anon role) never read or write application tables directly:
-- sign-in and registration go through Supabase Auth, and the profile row is created by the
-- security definer trigger public.handle_new_user(). RLS already returns no rows to anon;
-- revoking the table privileges Supabase grants by default makes such access fail outright
-- (SQLSTATE 42501) as a second layer of protection.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Apply the same to tables and sequences created by later migrations.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

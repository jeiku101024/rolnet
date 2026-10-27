begin;
select plan(1);
select has_function('public','require_owner',array[]::text[],'lifecycle functions use owner guard');
select finish();
rollback;

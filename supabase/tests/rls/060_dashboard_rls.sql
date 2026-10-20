begin; select plan(1); select has_function('public','dashboard_monthly_unit_summary',array['date'],'dashboard function is protected'); select finish(); rollback;

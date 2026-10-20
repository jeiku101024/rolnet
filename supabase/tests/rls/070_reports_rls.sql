begin; select plan(1); select has_function('public','monthly_report',array['date','uuid'],'report function exists'); select finish(); rollback;

begin; select plan(6);
select has_table('public','part_replacements','parts table exists'); select has_table('public','tire_installations','tires table exists');
select has_index('public','tire_installations','current_tire_position_unique','one current tire per position'); select col_has_check('public','part_replacements','cost_centavos','part cost is nonnegative'); select col_has_check('public','tire_installations','cost_centavos','tire cost is nonnegative'); select finish(); rollback;

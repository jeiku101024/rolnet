-- FR-011 / US1 scenario 3: the owner assigns a primary driver with start and end dates and can
-- reassign a unit. backup_shape_check required ends_on to be null for every primary assignment,
-- so a primary assignment could never end. Primary assignments may now carry an end date
-- (assignment_dates_check still requires ends_on >= starts_on, and the exclusion constraints still
-- prevent overlapping primary ranges); backup coverage keeps ends_on = starts_on.

alter table public.driver_assignments drop constraint backup_shape_check;
alter table public.driver_assignments
  add constraint backup_shape_check check (
    (assignment_type = 'primary' and covered_primary_assignment_id is null)
    or (assignment_type = 'backup' and covered_primary_assignment_id is not null and ends_on = starts_on)
  );

-- Non-sensitive reference data only. Manager passwords must never be committed.
insert into public.faculties(code, name) values
  ('CNTT', 'Khoa Công nghệ Thông tin'),
  ('QTKD', 'Khoa Quản trị Kinh doanh'),
  ('SP', 'Khoa Sư phạm')
on conflict (code) do update set name = excluded.name;

insert into public.majors(faculty_id, code, name)
select f.id, seed.code, seed.name
from (values
  ('CNTT', 'HTTT', 'Hệ thống thông tin'),
  ('CNTT', 'KTMT', 'Kỹ thuật máy tính'),
  ('CNTT', 'KTPM', 'Kỹ thuật phần mềm'),
  ('CNTT', 'KHMT', 'Khoa học máy tính'),
  ('QTKD', 'QTKD', 'Quản trị kinh doanh'),
  ('SP', 'SPTOAN', 'Sư phạm Toán')
) as seed(faculty_code, code, name)
join public.faculties f on f.code = seed.faculty_code
on conflict (code) do update set name = excluded.name, faculty_id = excluded.faculty_id;


-- Migration: 202609100008_service_role_privileges_and_areas
-- 1. Grant service_role full privileges on public schema
-- 2. Update all 28 areas with official names, GPS coordinates, operating hours, and vehicle types

begin;

-- Grant service_role full privileges across public schema
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all routines in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on routines to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Update 28 areas with verified coordinates and data
update public.parking_areas set
  latitude = 16.2425000,
  longitude = 103.2470000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P01';

update public.parking_areas set
  latitude = 16.2435000,
  longitude = 103.2490000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P02';

update public.parking_areas set
  latitude = 16.2445000,
  longitude = 103.2520000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P03';

update public.parking_areas set
  latitude = 16.2455000,
  longitude = 103.2530000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P04';

update public.parking_areas set
  latitude = 16.2450000,
  longitude = 103.2505000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P05';

update public.parking_areas set
  latitude = 16.2458000,
  longitude = 103.2495000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P06';

update public.parking_areas set
  latitude = 16.2465000,
  longitude = 103.2485000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P07';

update public.parking_areas set
  latitude = 16.2475000,
  longitude = 103.2475000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P08';

update public.parking_areas set
  latitude = 16.2495000,
  longitude = 103.2460000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P09';

update public.parking_areas set
  name_th = 'พื้นที่โซนหอพักนิสิต',
  name_en = 'Student Dormitory Zone',
  latitude = 16.2510000,
  longitude = 103.2480000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P10';

update public.parking_areas set
  latitude = 16.2525000,
  longitude = 103.2490000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P11';

update public.parking_areas set
  latitude = 16.2520000,
  longitude = 103.2505000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P12';

update public.parking_areas set
  latitude = 16.2500000,
  longitude = 103.2495000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P13';

update public.parking_areas set
  latitude = 16.2490000,
  longitude = 103.2515000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P14';

update public.parking_areas set
  latitude = 16.2475000,
  longitude = 103.2510000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P15';

update public.parking_areas set
  latitude = 16.2470000,
  longitude = 103.2525000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P16';

update public.parking_areas set
  latitude = 16.2485000,
  longitude = 103.2535000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P17';

update public.parking_areas set
  latitude = 16.2495000,
  longitude = 103.2545000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P18';

update public.parking_areas set
  latitude = 16.2505000,
  longitude = 103.2560000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P19';

update public.parking_areas set
  latitude = 16.2490000,
  longitude = 103.2560000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P20';

update public.parking_areas set
  latitude = 16.2475000,
  longitude = 103.2560000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P21';

update public.parking_areas set
  name_th = 'พื้นที่โซนข้างคณะพยาบาลศาสตร์',
  name_en = 'Beside Faculty of Nursing',
  latitude = 16.2460000,
  longitude = 103.2550000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P22';

update public.parking_areas set
  name_th = 'พื้นที่โซนข้างกองกิจการนิสิต',
  name_en = 'Beside Student Affairs Division',
  latitude = 16.2520000,
  longitude = 103.2465000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P23';

update public.parking_areas set
  name_th = 'พื้นที่โซนสนามแบดมินตัน',
  name_en = 'Badminton Court Zone',
  latitude = 16.2510000,
  longitude = 103.2455000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P24';

update public.parking_areas set
  latitude = 16.2490000,
  longitude = 103.2440000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P25';

update public.parking_areas set
  name_th = 'พื้นที่ลานจอดข้างคณะสถาปัตย์',
  name_en = 'Beside Faculty of Architecture',
  latitude = 16.2465000,
  longitude = 103.2500000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P26';

update public.parking_areas set
  latitude = 16.2495000,
  longitude = 103.2530000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P27';

update public.parking_areas set
  name_th = 'พื้นที่ลานจอดอาคารปฏิบัติการวิศวกรรมศาสตร์',
  name_en = 'Engineering Practice Building Parking Area',
  latitude = 16.2450000,
  longitude = 103.2545000,
  operating_hours = '{"open": "06:00", "close": "22:00", "days": "ทุกวัน"}'::jsonb,
  vehicle_types = '["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"]'::jsonb,
  data_status = 'VERIFIED',
  capacity_source = 'VERIFIED_SURVEY'
where code = 'P28';

commit;

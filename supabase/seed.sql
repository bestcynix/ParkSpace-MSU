-- Official area labels from the MSU Building and Grounds Division announcement.
-- The only intentional mockup values are the capacity/layout: every area gets
-- 100 database-backed demo slots in rows A–G so the booking flow can be tested.
-- Area names are official-source labels; coordinates, photos, and operational
-- availability remain unverified until supplied and approved by MSU.
with official_areas(area_number, name_th, name_en) as (
  values
    (1, 'พื้นที่โซนโรงเรียนสาธิต (ฝ่ายมัธยม)', 'Demonstration School Zone (Secondary Division)'),
    (2, 'พื้นที่โซนสำนักงานอธิการบดี', 'Office of the President Zone'),
    (3, 'พื้นที่โซนสำนักพิพิธภัณฑ์', 'Museum Office Zone'),
    (4, 'พื้นที่โซนข้างคณะสิ่งแวดล้อม', 'Beside the Faculty of Environment'),
    (5, 'พื้นที่โซนข้างวิทยาลัยดุริยางคศิลป์', 'Beside the College of Music'),
    (6, 'พื้นที่โซนหลังคณะมนุษยศาสตร์', 'Behind the Faculty of Humanities'),
    (7, 'พื้นที่โซนข้างคณะมนุษยศาสตร์', 'Beside the Faculty of Humanities'),
    (8, 'พื้นที่โซนข้างอาคารราชนครินทร์', 'Beside Ratchanakharin Building'),
    (9, 'พื้นที่โซนสนามกีฬา', 'Sports Field Zone'),
    (10, 'พื้นที่โซนคณะพยาบาลศาสตร์', 'Faculty of Nursing Zone'),
    (11, 'พื้นที่โซนลานหลังตลาดน้อย', 'Behind Talat Noi Plaza'),
    (12, 'พื้นที่โซนลานหน้าตลาดน้อย', 'In front of Talat Noi Plaza'),
    (13, 'พื้นที่โซนลานเล้าไก่/MSU Space', 'Lao Kai / MSU Space Zone'),
    (14, 'พื้นที่โซนหน้า SC 3', 'In front of SC 3'),
    (15, 'พื้นที่โซนข้างสำนักวิทยบริการ', 'Beside the Academic Resource Center'),
    (16, 'พื้นที่โซนข้างสำนักคอมพิวเตอร์', 'Beside the Computer Center'),
    (17, 'พื้นที่โซนข้างคณะวิศวกรรมศาสตร์', 'Beside the Faculty of Engineering'),
    (18, 'พื้นที่โซนข้างคณะสาธารณสุขศาสตร์', 'Beside the Faculty of Public Health'),
    (19, 'พื้นที่โซนคอนโดบุคลากร', 'Personnel Residence Zone'),
    (20, 'พื้นที่โซนศูนย์วิจัยฯ', 'Research Center Zone'),
    (21, 'พื้นที่โซนหลังห้องส่งเสริมการวิจัยฯ', 'Behind the Research Promotion Office'),
    (22, 'พื้นที่โซนข้างคณะพยาบาลศาสตร์', 'Beside the Faculty of Nursing'),
    (23, 'พื้นที่โซนข้างอาคารบัณฑิตวิทยาลัย', 'Beside the Graduate School Building'),
    (24, 'พื้นที่โซนสนามบาสคณะมนุษยศาสตร์', 'Faculty of Humanities Basketball Court Zone'),
    (25, 'พื้นที่โซนสนามฟุตบอลหญ้าเทียม', 'Artificial Turf Football Field Zone'),
    (26, 'พื้นที่สนามจอดข้างคณะสถาปัตย์', 'Parking Area beside the Faculty of Architecture'),
    (27, 'พื้นที่โซนหลังคณะเทคโนโลยี', 'Behind the Faculty of Technology'),
    (28, 'พื้นที่สนามจอดอาคารปฏิบัติการวิศวกรรมศาสตร์', 'Engineering Practice Building Parking Area')
)
insert into public.parking_areas (code, name_th, name_en, description_th, description_en, data_status, capacity, capacity_source, capacity_verified, slot_mode, slot_layout_source, slot_layout_verified, vehicle_types, source_reference)
select
  'P' || lpad(area_number::text, 2, '0'),
  name_th,
  name_en,
  'ชื่อพื้นที่อ้างอิงจากประกาศกองอาคารสถานที่ มมส. พิกัด รูปภาพ ความจุ และสถานะช่องจอดรอตรวจสอบ',
  'Area name is sourced from the MSU announcement. Coordinates, photos, capacity, and slot status await verification.',
  'AWAITING_VERIFICATION',
  100,
  'MOCKUP',
  false,
  'INDIVIDUAL_SLOT',
  'MOCKUP',
  false,
  '["CAR", "MOTORCYCLE", "PICKUP", "VAN", "EV", "OTHER"]'::jsonb,
  'https://building.msu.ac.th/news-detail.php?id=23'
from official_areas
on conflict (code) do update set
  name_th = excluded.name_th,
  name_en = excluded.name_en,
  description_th = excluded.description_th,
  description_en = excluded.description_en,
  capacity = case when public.parking_areas.capacity_verified = false and public.parking_areas.data_status = 'AWAITING_VERIFICATION' then excluded.capacity else public.parking_areas.capacity end,
  capacity_source = case when public.parking_areas.capacity_verified = false and public.parking_areas.data_status = 'AWAITING_VERIFICATION' then excluded.capacity_source else public.parking_areas.capacity_source end,
  slot_mode = case when public.parking_areas.slot_layout_verified = false and public.parking_areas.data_status = 'AWAITING_VERIFICATION' then excluded.slot_mode else public.parking_areas.slot_mode end,
  slot_layout_source = case when public.parking_areas.slot_layout_verified = false and public.parking_areas.data_status = 'AWAITING_VERIFICATION' then excluded.slot_layout_source else public.parking_areas.slot_layout_source end,
  source_reference = excluded.source_reference,
  updated_at = now()
where public.parking_areas.data_status = 'AWAITING_VERIFICATION'
  and public.parking_areas.verified_at is null;

insert into public.parking_rows (parking_area_id, row_label, display_order, status, slot_type, allowed_vehicle_types, data_status, source_reference)
select a.id, layout.row_label, layout.display_order, 'AVAILABLE', layout.slot_type, layout.allowed_vehicle_types, 'MOCKUP', 'MOCKUP_LAYOUT:' || coalesce(a.source_reference, 'MSU')
from public.parking_areas a
cross join (values
  ('A', 1, 'CAR', '["CAR"]'::jsonb),
  ('B', 2, 'CAR', '["CAR"]'::jsonb),
  ('C', 3, 'MOTORCYCLE', '["MOTORCYCLE"]'::jsonb),
  ('D', 4, 'PICKUP', '["PICKUP"]'::jsonb),
  ('E', 5, 'EV', '["EV"]'::jsonb),
  ('F', 6, 'VAN', '["VAN"]'::jsonb),
  ('G', 7, 'OTHER', '["OTHER"]'::jsonb)
) as layout(row_label, display_order, slot_type, allowed_vehicle_types)
on conflict (parking_area_id, row_label) do nothing;

-- Requested demo layout: 100 real database slot rows per area, grouped into
-- rows A–G. The layout/capacity is Mockup, but bookings and time-based status
-- are real records and are never reset by this seed.
insert into public.parking_slots (parking_area_id, row_id, slot_code, row_label, "position", slot_type, status, source_reference, data_status)
select
  a.id,
  r.id,
  a.code || '-' || chr(65 + ((slot_number - 1) % 7)) || '-' || lpad((((slot_number - 1) / 7) + 1)::text, 2, '0'),
  chr(65 + ((slot_number - 1) % 7)),
  ((slot_number - 1) / 7) + 1,
  r.slot_type,
  'AVAILABLE',
  'MOCKUP_LAYOUT:' || a.source_reference,
  'MOCKUP'
from public.parking_areas a
cross join generate_series(1, 100) as generated(slot_number)
join public.parking_rows r
  on r.parking_area_id = a.id
 and r.row_label = chr(65 + ((slot_number - 1) % 7))
where a.data_status = 'AWAITING_VERIFICATION'
  and a.slot_layout_verified = false
on conflict (parking_area_id, slot_code) do nothing;

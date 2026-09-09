-- Official area labels from the MSU Building and Grounds Division announcement.
-- Capacity, coordinates, photos, slot labels, and live availability remain
-- unverified until supplied and approved by MSU.
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
insert into public.parking_areas (code, name_th, name_en, description_th, description_en, data_status, capacity_source, capacity_verified, slot_mode, source_reference)
select
  'P' || lpad(area_number::text, 2, '0'),
  name_th,
  name_en,
  'ชื่อพื้นที่อ้างอิงจากประกาศกองอาคารสถานที่ มมส. พิกัด รูปภาพ ความจุ และสถานะช่องจอดรอตรวจสอบ',
  'Area name is sourced from the MSU announcement. Coordinates, photos, capacity, and slot status await verification.',
  'AWAITING_VERIFICATION',
  'UNVERIFIED',
  false,
  'AREA_ONLY',
  'https://building.msu.ac.th/news-detail.php?id=23'
from official_areas
on conflict (code) do update set
  name_th = excluded.name_th,
  name_en = excluded.name_en,
  description_th = excluded.description_th,
  description_en = excluded.description_en,
  source_reference = excluded.source_reference,
  updated_at = now()
where public.parking_areas.data_status = 'AWAITING_VERIFICATION'
  and public.parking_areas.verified_at is null;

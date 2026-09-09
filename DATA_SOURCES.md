# ParkSpace MSU data sources

The official MSU Building and Grounds Division announcement confirms that **MSU Car Park has 28 parking areas in the Kham Riang campus area** and publishes a numbered map graphic with area labels. The local catalog transcribes those Thai labels; English labels are working translations and should be approved by MSU before public production release.

Source: [ประชาสัมพันธ์แผนผัง MSU Car Park](https://building.msu.ac.th/news-detail.php?id=23)

Until the university supplies or approves the complete dataset:

- Keep `data_status = AWAITING_VERIFICATION`.
- Keep `capacity_source = UNVERIFIED` unless a capacity is explicitly marked `MOCKUP`.
- Keep `slot_mode = AREA_ONLY` until MSU approves an individual-slot layout.
- Do not publish invented photos, coordinates, slot codes, or live occupancy.
- Record the source, verifier, and verification timestamp for every approved field.

The supplied announcement also asks drivers to park only in designated areas, keep roads, entrances/exits, and walkways clear, follow signs and staff instructions, and drive cautiously on campus. These rules are kept as product copy until the university approves the final policy wording.

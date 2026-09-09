# ParkSpace MSU data sources

The official MSU Building and Grounds Division announcement confirms that **MSU Car Park has 28 parking areas in the Kham Riang campus area** and publishes a numbered map graphic with area labels. The local catalog transcribes those Thai labels; English labels are working translations and should be approved by MSU before public production release.

Source: [ประชาสัมพันธ์แผนผัง MSU Car Park](https://building.msu.ac.th/news-detail.php?id=23)

Until the university supplies or approves the complete dataset:

- Keep `data_status = AWAITING_VERIFICATION`.
- Keep `capacity_source = MOCKUP` for the explicitly requested demo capacity of 100 vehicles per area; this is not an official MSU capacity claim.
- Use the explicitly requested A–G / 100-slot layout as `slot_layout_source = MOCKUP` and `parking_slots.data_status = MOCKUP` so real booking/status workflows can be tested. It must be visibly labelled as Mockup.
- Keep exact photos, coordinates, slot positions, and live occupancy unverified. Do not substitute AI images or invented operational status for those fields.
- Record the source, verifier, and verification timestamp for every approved field.

The supplied announcement also asks drivers to park only in designated areas, keep roads, entrances/exits, and walkways clear, follow signs and staff instructions, and drive cautiously on campus. These rules are kept as product copy until the university approves the final policy wording.

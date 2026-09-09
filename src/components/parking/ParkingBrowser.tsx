"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { parkingAreas, type ParkingStatus } from "@/lib/parking/demo-data";
import { ParkingCard } from "@/components/parking/ParkingCard";

export function ParkingBrowser({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ParkingStatus>("all");
  const filtered = useMemo(() => parkingAreas.filter((area) => {
    const matchQuery = !query.trim() || [area.code, area.th, area.en].some((value) => value.toLowerCase().includes(query.toLowerCase().trim()));
    const matchFilter = filter === "all" || area.status === filter;
    return matchQuery && matchFilter;
  }), [filter, query]);
  const filters = [
    ["all", t.all],
    ["available", t.available],
    ["reserved", t.reserved],
    ["occupied", t.occupied],
    ["closed", t.closed],
  ] as const;

  return (
    <section>
      <div className="search-box"><Search size={19} color="#727b86" /><input aria-label={t.searchPlaceholder} placeholder={t.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="chip-row">{filters.map(([key, label]) => <button className={`filter-chip ${filter === key ? "active" : ""}`} key={key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <div className="parking-grid" style={{ marginTop: 18 }}>{filtered.map((area) => <ParkingCard area={area} locale={locale} key={area.id} />)}</div>
      {!filtered.length ? <div className="empty-card"><div><div className="empty-icon"><Search size={25} /></div><h2>{t.noResults}</h2><p>{t.realDataNote}</p></div></div> : null}
    </section>
  );
}

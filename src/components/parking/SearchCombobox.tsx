"use client";

import { useMemo, useState } from "react";
import { Building2, MapPin, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { getAreaDetail, getAreaName, parkingAreas } from "@/lib/parking/demo-data";

export function SearchCombobox({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const t = getCopy(locale);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return parkingAreas.slice(0, 5);
    return parkingAreas.filter((area) => [area.code, area.th, area.en, area.detailTh, area.detailEn].some((value) => value.toLowerCase().includes(normalized))).slice(0, 7);
  }, [query]);

  function selectArea(id: string) {
    setOpen(false);
    router.push(`/${locale}/parking/${id}`);
  }

  return (
    <div className="relative">
      <div className="search-box" role="combobox" aria-expanded={open} aria-controls="parking-search-results" aria-haspopup="listbox">
        <Search size={20} color="#727b86" />
        <input
          aria-label={compact ? t.searchPlaceholderShort : t.searchPlaceholder}
          placeholder={compact ? t.searchPlaceholderShort : t.searchPlaceholder}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0))); }
            if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(index - 1, 0)); }
            if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); selectArea(results[activeIndex].id); }
          }}
        />
        {query ? <button className="search-clear" aria-label={t.clear} onClick={() => { setQuery(""); setActiveIndex(0); setOpen(true); }}><X size={14} /></button> : null}
      </div>
      {open ? (
        <div className="search-results" id="parking-search-results" role="listbox">
          <div style={{ padding: "11px 15px 6px", color: "#9aa1aa", fontSize: 10, fontWeight: 800 }}>
            {query ? t.parking : t.selectDestination}
          </div>
          {results.length ? results.map((area) => (
            <button className="search-result" key={area.id} onMouseEnter={() => setActiveIndex(results.findIndex((result) => result.id === area.id))} onClick={() => selectArea(area.id)} role="option" aria-selected={results[activeIndex]?.id === area.id}>
              <span className="result-icon"><MapPin size={16} /></span>
              <span className="result-copy"><strong>{highlight(`${area.code} · ${getAreaName(area, locale)}`, query)}</strong><span><Building2 size={11} style={{ verticalAlign: "-2px" }} /> {getAreaDetail(area, locale)}</span></span>
            </button>
          )) : <div style={{ padding: "18px 15px", color: "#6b7280", fontSize: 12 }}>{t.noResults}</div>}
        </div>
      ) : null}
    </div>
  );
}

function highlight(value: string, query: string) {
  const needle = query.trim();
  if (!needle) return value;
  const index = value.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return value;
  return <>{value.slice(0, index)}<mark style={{ borderRadius: 3, background: "#fff0a8", color: "inherit" }}>{value.slice(index, index + needle.length)}</mark>{value.slice(index + needle.length)}</>;
}

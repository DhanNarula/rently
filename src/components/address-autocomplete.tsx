"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface AddressResult {
  display: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

interface Props {
  value: string;
  onChange: (result: AddressResult) => void;
  placeholder?: string;
}

function parseNominatim(item: Record<string, unknown>): AddressResult {
  const addr = (item.address || {}) as Record<string, string>;

  const streetNumber = addr.house_number || "";
  const street = addr.road || addr.street || "";
  const unit = addr.unit || "";
  const addressLine = [unit, streetNumber, street].filter(Boolean).join(" ");

  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    "";

  const provinceMap: Record<string, string> = {
    Ontario: "ON", "British Columbia": "BC", Alberta: "AB", Quebec: "QC",
    Manitoba: "MB", Saskatchewan: "SK", "Nova Scotia": "NS",
    "New Brunswick": "NB", "Newfoundland and Labrador": "NL",
    "Prince Edward Island": "PE", "Northwest Territories": "NT",
    Nunavut: "NU", Yukon: "YT",
  };
  const rawProvince = addr.state || addr.province || "";
  const province = provinceMap[rawProvince] || rawProvince.slice(0, 2).toUpperCase();

  const postalCode = addr.postcode || "";

  return {
    display: String(item.display_name || ""),
    address: addressLine,
    city,
    province,
    postalCode,
  };
}

export function AddressAutocomplete({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && value !== query) setQuery(value);
  }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.length < 4) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=ca&limit=5`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      const parsed = (data as Record<string, unknown>[]).map(parseNominatim).filter((r) => r.address);
      setResults(parsed);
      setOpen(parsed.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setSelected(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 400);
  }

  function handleSelect(result: AddressResult) {
    setQuery(result.address);
    setSelected(true);
    setOpen(false);
    onChange(result);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && !selected && setOpen(true)}
          placeholder={placeholder || "Start typing an address..."}
          style={{
            width: "100%",
            padding: "10px 13px",
            borderRadius: 10,
            border: selected ? "1px solid #86efac" : "1px solid #e2e8f0",
            background: selected ? "#f0fdf4" : "#ffffff",
            color: "#0f172a",
            fontSize: 13.5,
            outline: "none",
            fontFamily: "inherit",
          }}
          className={cn("")}
        />
        {loading && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
            <div style={{ width: 14, height: 14, border: "2px solid #ddd6fe", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}
        {selected && !loading && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#059669" }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: "absolute",
          zIndex: 50,
          marginTop: 6,
          width: "100%",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        }}>
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "11px 14px",
                background: "transparent",
                border: "none",
                borderBottom: i < results.length - 1 ? "1px solid #f1f5f9" : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                color: "#0f172a",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f5f3ff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{ marginTop: 2, color: "#7c3aed", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.address}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{r.city}{r.province ? `, ${r.province}` : ""}{r.postalCode ? ` · ${r.postalCode}` : ""}</div>
              </div>
            </button>
          ))}
          <div style={{ padding: "8px 14px", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
            <p style={{ fontSize: 10, color: "#cbd5e1" }}>Powered by OpenStreetMap</p>
          </div>
        </div>
      )}
    </div>
  );
}

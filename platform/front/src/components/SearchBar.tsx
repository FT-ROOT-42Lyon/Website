"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: Props) {
  return (
    <div className="search-bar-wrap">
      <span className="search-bar-prefix">$</span>
      <input
        type="search"
        className="search-bar"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "rechercher..."}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

// Case-insensitive substring match, tolerant of accents (NFD normalize).
// Returns true when `query` is empty so callers can use it directly in
// `.filter`.
export function searchMatch(haystacks: Array<string | null | undefined>, query: string): boolean {
  if (!query) return true;
  const needle = normalize(query);
  return haystacks.some((h) => (h ? normalize(h).includes(needle) : false));
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

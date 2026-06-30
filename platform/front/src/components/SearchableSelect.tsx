"use client";

import { useState } from "react";
import { SearchBar, searchMatch } from "./SearchBar";

export interface SearchableOption {
  value: string;
  label: string;
  // Strings the query is matched against (case + accent insensitive).
  search: string[];
}

interface Props {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
}

// Two-step picker: type in the search to narrow the list, click a row to set
// it as the selected value. The caller commits the selection with its own
// "+ Add" button so adjacent inputs (e.g. an optional date) can be part of
// the same workflow.
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyText = "Aucun résultat",
}: Props) {
  const [query, setQuery] = useState("");
  const filtered = options.filter((o) => searchMatch(o.search, query));
  const selected = options.find((o) => o.value === value);

  return (
    <div className="searchable-select">
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder={placeholder}
      />
      <div className="searchable-select-list">
        {filtered.length === 0 ? (
          <p className="searchable-select-empty">{emptyText}</p>
        ) : (
          filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`searchable-select-row${o.value === value ? " is-selected" : ""}`}
              onClick={() => onChange(o.value)}
            >
              <span className="searchable-select-label">{o.label}</span>
              {o.value === value && (
                <span className="searchable-select-check">✓</span>
              )}
            </button>
          ))
        )}
      </div>
      {selected && (
        <p className="searchable-select-current">
          // sélectionné : <span>{selected.label}</span>
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import data from "@emoji-mart/data";
import { init, SearchIndex } from "emoji-mart";

// Initialize emoji-mart search index
init({ data });

interface EmojiSkin {
  unified: string;
  native: string;
}

interface EmojiEntry {
  id: string;
  name: string;
  keywords: string[];
  skins: EmojiSkin[];
}

const CATEGORIES = [
  { id: "people", icon: "😀", label: "People" },
  { id: "nature", icon: "🌿", label: "Nature" },
  { id: "foods", icon: "🍔", label: "Food" },
  { id: "activity", icon: "⚽", label: "Activity" },
  { id: "places", icon: "✈️", label: "Travel" },
  { id: "objects", icon: "💡", label: "Objects" },
  { id: "symbols", icon: "💜", label: "Symbols" },
  { id: "flags", icon: "🏁", label: "Flags" },
];

const EMOJIS_PER_ROW = 8;

interface PartyEmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export default function PartyEmojiPicker({ onSelect }: PartyEmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState("people");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EmojiEntry[] | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Build category → emoji[] map once
  const categoryEmojis = useMemo(() => {
    const map: Record<string, EmojiEntry[]> = {};
    const emojis = (data as any).emojis as Record<string, EmojiEntry>;
    for (const cat of (data as any).categories) {
      map[cat.id] = cat.emojis
        .map((id: string) => emojis[id])
        .filter(Boolean);
    }
    return map;
  }, []);

  // Search handler
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    SearchIndex.search(query).then((results: EmojiEntry[]) => {
      if (!cancelled) setSearchResults(results ?? []);
    });
    return () => { cancelled = true; };
  }, [query]);

  // Reset scroll when category changes
  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, [activeCategory, searchResults]);

  // Focus search on mount
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handleClick = useCallback((native: string) => {
    onSelect(native);
  }, [onSelect]);

  const emojisToShow = searchResults ?? categoryEmojis[activeCategory] ?? [];

  return (
    <div
      className="w-[280px] rounded-xl overflow-hidden shadow-lg"
      style={{ backgroundColor: "var(--party-surface)", border: "1px solid rgb(from var(--party-fg) r g b / 0.05)" }}
    >
      {/* Search */}
      <div className="px-2.5 pt-2.5 pb-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--party-fg)/30" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg
                       bg-(--party-bg)/30
                       text-(--party-fg) placeholder:text-(--party-fg)/30
                       focus:outline-none"
            style={{ border: "1px solid rgb(from var(--party-fg) r g b / 0.05)" }}
          />
        </div>
      </div>

      {/* Category tabs */}
      {!searchResults && (
        <div className="flex px-1.5 pb-1 gap-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              title={cat.label}
              className={`flex-1 flex items-center justify-center py-1 rounded-md text-sm transition-colors
                ${activeCategory === cat.id
                  ? "bg-(--party-fg)/10"
                  : "hover:bg-(--party-fg)/5"
                }`}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div
        ref={gridRef}
        className="h-[220px] overflow-y-auto px-1.5 pb-2
          [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-(--party-fg)/10 [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        {emojisToShow.length === 0 && (
          <p className="text-xs text-(--party-fg)/40 text-center mt-8">
            No emoji found
          </p>
        )}
        <div
          className="grid gap-0"
          style={{ gridTemplateColumns: `repeat(${EMOJIS_PER_ROW}, 1fr)` }}
        >
          {emojisToShow.map((emoji) => (
            <button
              key={emoji.id}
              onClick={() => handleClick(emoji.skins[0].native)}
              title={emoji.name}
              className="flex items-center justify-center w-full aspect-square rounded-md
                         text-2xl hover:bg-(--party-fg)/10 transition-colors"
            >
              {emoji.skins[0].native}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

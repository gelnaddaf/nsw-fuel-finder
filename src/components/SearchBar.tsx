import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, LocateFixed, Loader2 } from 'lucide-react';
import { fetchSuburbs } from '../api/fuel';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: (query?: string) => void;
  onUseLocation: () => void;
  isLoading: boolean;
  isLocating: boolean;
}

export default function SearchBar({
  searchQuery,
  onSearchChange,
  onSearch,
  onUseLocation,
  isLoading,
  isLocating,
}: SearchBarProps) {
  const [suburbs, setSuburbs] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load suburb list once on mount
  useEffect(() => {
    fetchSuburbs()
      .then(setSuburbs)
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      onSearchChange(value);
      setHighlightIndex(-1);
      if (value.trim().length >= 2 && suburbs.length > 0) {
        const query = value.trim().toLowerCase();
        const matches = suburbs
          .filter((s) => s.toLowerCase().includes(query))
          .slice(0, 8);
        setSuggestions(matches);
        setShowDropdown(matches.length > 0);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    },
    [onSearchChange, suburbs]
  );

  const selectSuggestion = useCallback(
    (suburb: string) => {
      onSearchChange(suburb);
      setShowDropdown(false);
      setSuggestions([]);
      setHighlightIndex(-1);
      // Pass suburb directly to avoid stale closure on searchQuery
      onSearch(suburb);
    },
    [onSearchChange, onSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || suggestions.length === 0) {
        if (e.key === 'Enter') onSearch();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIndex >= 0) {
          selectSuggestion(suggestions[highlightIndex]);
        } else {
          setShowDropdown(false);
          onSearch();
        }
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    },
    [showDropdown, suggestions, highlightIndex, onSearch, selectSuggestion]
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1" ref={wrapperRef}>
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by suburb or postcode..."
          value={searchQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          autoComplete="off"
          className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm shadow-sm transition-colors focus:border-nsw-blue focus:outline-none focus:ring-2 focus:ring-nsw-blue/20"
        />

        {/* Autocomplete dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            {suggestions.map((suburb, i) => (
              <li
                key={suburb}
                onMouseDown={() => selectSuggestion(suburb)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                  i === highlightIndex
                    ? 'bg-nsw-blue/10 text-nsw-blue font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {suburb}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSearch()}
          disabled={isLoading || !searchQuery.trim()}
          className="flex items-center gap-2 rounded-xl bg-nsw-blue px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-nsw-blue/90 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Search
        </button>
        <button
          onClick={onUseLocation}
          disabled={isLocating}
          className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          title="Use my location"
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LocateFixed className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Near me</span>
        </button>
      </div>
    </div>
  );
}

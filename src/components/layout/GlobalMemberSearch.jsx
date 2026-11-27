import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatusBadge from '../ui/StatusBadge';
import { displayValue, getMemberStatusVariant } from '../../utils/formatters';

/**
 * Debounced header search bar that queries `public.member_overview` by full_name,
 * phone, or device_pin and lets admins jump directly to /admin/members/:id.
 */
export default function GlobalMemberSearch({ value, onChange }) {
  const navigate = useNavigate();

  const containerRef = useRef(null);
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError('');

      try {
        const safeQuery = trimmed.replace(/[(),]/g, ' ').trim();
        const numericCandidate = safeQuery.replace(/^(sn|#)/i, '');
        const orFilters = [
          `full_name.ilike.%${safeQuery}%`,
          `phone.ilike.%${safeQuery}%`,
        ];

        if (/^\d+$/.test(numericCandidate)) {
          orFilters.push(`device_pin.eq.${Number(numericCandidate)}`);
        }

        const { data, error } = await supabase
          .from('member_overview')
          .select('id, full_name, device_pin, phone, status')
          .or(orFilters.join(','))
          .order('full_name', { ascending: true })
          .limit(8);

        if (cancelled) return;

        if (error) {
          setSearchError(error.message || 'Search failed');
          setResults([]);
        } else {
          const rows = data || [];
          setResults(rows);
          setHighlightedIndex(rows.length > 0 ? 0 : -1);
        }
        setIsOpen(true);
      } catch (err) {
        if (!cancelled) {
          setSearchError(err.message || 'Unable to search members');
          setResults([]);
          setIsOpen(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  function handleInputChange(nextValue) {
    onChange(nextValue);
    if (!nextValue.trim()) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      setSearchError('');
      setHighlightedIndex(-1);
    }
  }

  function handleSelectMember(member) {
    if (!member?.id) return;
    setIsOpen(false);
    setHighlightedIndex(-1);
    onChange('');
    navigate(`/admin/members/${member.id}`);
  }

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % results.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setHighlightedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
      return;
    }

    if (e.key === 'Enter' && results.length > 0) {
      const target = results[highlightedIndex >= 0 ? highlightedIndex : 0];
      if (target) {
        e.preventDefault();
        handleSelectMember(target);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (value.trim() && (results.length > 0 || searchError)) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search Member Name, Phone, or PIN..."
          aria-label="Global member search"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-9 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500" />
        )}
      </div>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          {searchError ? (
            <div className="px-4 py-3 text-xs text-rose-600">{searchError}</div>
          ) : loading && results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-500">Searching members...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-center text-xs text-slate-500">
              No members found for &ldquo;{value.trim()}&rdquo;
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {results.map((member, idx) => {
                const isHighlighted = idx === highlightedIndex;
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelectMember(member)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition ${
                        isHighlighted ? 'bg-indigo-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                          <User className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-900">
                              {displayValue(member.full_name)}
                            </span>
                            {member.device_pin !== null && member.device_pin !== undefined && (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                                PIN {member.device_pin}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-500">
                            {displayValue(member.phone)}
                          </p>
                        </div>
                      </div>

                      <StatusBadge
                        variant={getMemberStatusVariant(member.status)}
                        className="shrink-0 capitalize"
                      >
                        {displayValue(member.status, 'unknown')}
                      </StatusBadge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

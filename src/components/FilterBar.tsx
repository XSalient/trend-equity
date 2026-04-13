import React, { useState, useRef, useEffect } from 'react';
import {
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
  Sparkles,
  Search,
  RotateCcw,
  Download,
  Check,
  ArrowUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FilterState, Tier } from '../types';

interface FilterBarProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  tier: Tier;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  resultCount?: number;
  totalCount?: number;
  onUpgrade?: () => void;
}

const INDUSTRIES = [
  'AI/SaaS',
  'FinTech',
  'HealthTech',
  'EdTech',
  'Climate/Sustainability',
  'Consumer Apps',
  'Hardware',
  'Deep-Tech/Moonshot',
  'Service/Local/On-Demand',
  'Other',
];

const RISK_LEVELS = ['Low', 'Medium', 'High'];
const EFFORT_LEVELS = ['Low', 'Medium', 'High'];
const MARKET_FOCUS = [
  'Local Market',
  'Global',
  'US-centric',
  'EU-focused',
  'Emerging Markets',
  'Hyper-local/Regional',
];
const TEAM_SIZE = ['Solo-friendly', 'Small team (2–5)', 'Needs co-founder/funding round'];
const PRODUCT_TYPES = ['Digital', 'Physical'];

// ── Reusable custom dropdown ─────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

function DropdownSelect({
  value,
  onChange,
  options,
  icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  icon?: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-sm text-zinc-300 hover:text-white hover:border-zinc-600 hover:bg-zinc-800 transition-all"
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-zinc-500" />}
        <span className="font-medium">{current?.label ?? 'Select'}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute top-full mt-1.5 left-0 min-w-[180px] bg-zinc-900 border border-zinc-700/70 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 py-1"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-4 ${
                  opt.value === value
                    ? 'text-white bg-zinc-800'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <span>{opt.label}</span>
                {opt.value === value && (
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Action dropdown (no persistent selection, e.g. Export) ───────────────────

interface ActionOption {
  label: string;
  onClick: () => void;
}

function DropdownAction({
  label,
  icon: Icon,
  options,
}: {
  label: string;
  icon: React.ElementType;
  options: ActionOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-sm text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-800 transition-all"
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="font-medium">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute top-full mt-1.5 right-0 min-w-[150px] bg-zinc-900 border border-zinc-700/70 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 py-1"
          >
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => {
                  opt.onClick();
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main FilterBar ────────────────────────────────────────────────────────────

export function FilterBar({
  filters,
  setFilters,
  tier,
  onExportCSV,
  onExportPDF,
  resultCount,
  totalCount,
  onUpgrade,
}: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isFree = tier === 'free';
  const isPro = tier === 'pro';
  const isBuilder = tier === 'builder';

  const resetFilters = () => {
    setFilters({
      industries: [],
      productTypes: [],
      riskLevels: [],
      effortLevels: [],
      marketFocus: [],
      teamSize: [],
      excludeCategories: [],
      customKeywords: '',
      sortBy: 'revenue',
    });
  };

  const toggleFilter = (key: keyof FilterState, value: string) => {
    if (isFree) {
      onUpgrade?.();
      return;
    }
    const current = (filters[key] as string[]) || [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setFilters({ ...filters, [key]: next });
  };

  const activeCount =
    (filters.industries?.length || 0) +
    (filters.productTypes?.length || 0) +
    (filters.riskLevels?.length || 0) +
    (filters.effortLevels?.length || 0) +
    (filters.marketFocus?.length || 0) +
    (filters.teamSize?.length || 0) +
    (filters.customKeywords ? 1 : 0);

  return (
    <div className="w-full bg-zinc-900/50 border-y border-white/5 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 bg-emerald-500 text-black text-[10px] font-bold rounded-full">
                  {activeCount}
                </span>
              )}
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <div className="w-px h-4 bg-zinc-800" />

            <DropdownSelect
              value={filters.sortBy}
              onChange={(v) => setFilters({ ...filters, sortBy: v as any })}
              icon={ArrowUpDown}
              options={[
                { value: 'revenue', label: 'Sort by Potential' },
                { value: 'newest', label: 'Newest First' },
                { value: 'effort', label: 'Lowest Effort' },
              ]}
            />

            {activeCount > 0 && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}

            {activeCount > 0 && resultCount !== undefined && totalCount !== undefined && (
              <span className="text-xs font-medium text-zinc-400">
                <span className={resultCount === 0 ? 'text-amber-400' : 'text-emerald-400'}>
                  {resultCount}
                </span>
                <span className="text-zinc-600"> / {totalCount}</span>
              </span>
            )}
          </div>

          <DropdownAction
            label="Export"
            icon={Download}
            options={[
              { label: 'Export as CSV', onClick: () => onExportCSV?.() },
              { label: 'Export as PDF', onClick: () => onExportPDF?.() },
            ]}
          />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 border-t border-white/5 mt-3">
                {/* Industry Filter */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-500">Industry</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRIES.map((industry) => (
                        <button
                          key={industry}
                          onClick={() => toggleFilter('industries', industry)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                            filters.industries.includes(industry)
                              ? 'bg-emerald-500 text-black font-medium'
                              : isFree
                                ? 'bg-zinc-800/30 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {industry}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-500">Product Type</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex gap-2">
                      {PRODUCT_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => toggleFilter('productTypes', type)}
                          className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                            filters.productTypes.includes(type)
                              ? 'bg-emerald-500 text-black font-medium'
                              : isFree
                                ? 'bg-zinc-800/30 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Risk & Effort */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-500">Risk / Ambition</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex gap-2">
                      {RISK_LEVELS.map((level) => (
                        <button
                          key={level}
                          onClick={() => toggleFilter('riskLevels', level)}
                          className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                            filters.riskLevels.includes(level)
                              ? 'bg-emerald-500 text-black font-medium'
                              : isFree
                                ? 'bg-zinc-800/30 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-500">Capital / Effort</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex gap-2">
                      {EFFORT_LEVELS.map((level) => (
                        <button
                          key={level}
                          onClick={() => toggleFilter('effortLevels', level)}
                          className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                            filters.effortLevels.includes(level)
                              ? 'bg-emerald-500 text-black font-medium'
                              : isFree
                                ? 'bg-zinc-800/30 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Market & Team */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-500">Market Focus</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MARKET_FOCUS.map((market) => (
                        <button
                          key={market}
                          disabled={isPro && market.includes('Emerging')}
                          onClick={() => toggleFilter('marketFocus', market)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1.5 ${
                            filters.marketFocus.includes(market)
                              ? 'bg-emerald-500 text-black font-medium'
                              : isFree || (isPro && market.includes('Emerging'))
                                ? 'bg-zinc-800/30 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {market}
                          {isPro && market.includes('Emerging') && <Sparkles className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-500">Team Setup</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TEAM_SIZE.map((size) => (
                        <button
                          key={size}
                          onClick={() => toggleFilter('teamSize', size)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                            filters.teamSize.includes(size)
                              ? 'bg-emerald-500 text-black font-medium'
                              : isFree
                                ? 'bg-zinc-800/30 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Builder Advanced */}
                {isBuilder && (
                  <div className="lg:col-span-3 pt-6 border-t border-white/5 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <Sparkles className="w-4 h-4" />
                      <h4 className="text-xs font-semibold">Builder Personalization</h4>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Custom keywords (e.g. 'agent governance', 'solar')"
                          value={filters.customKeywords}
                          onChange={(e) =>
                            setFilters({ ...filters, customKeywords: e.target.value })
                          }
                          className="w-full bg-zinc-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 italic">
                        <Sparkles className="w-3 h-3" />
                        Feed will prioritize ideas matching your keywords and saved library.
                      </div>
                    </div>
                  </div>
                )}

                {/* Free Teaser */}
                {isFree && (
                  <div className="lg:col-span-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Unlock Advanced Filters</p>
                        <p className="text-xs text-zinc-400">
                          Pro & Builder users can filter by industry, risk, effort, and more.
                        </p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-emerald-500 text-black text-xs font-bold rounded-lg hover:bg-emerald-400 transition-colors">
                      Upgrade Now
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

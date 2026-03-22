import React, { useState } from 'react';
import { 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Lock, 
  Sparkles,
  Search,
  RotateCcw,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FilterState, Tier } from '../types';

interface FilterBarProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  tier: Tier;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

const INDUSTRIES = [
  'AI/SaaS', 'FinTech', 'HealthTech', 'EdTech', 'Climate/Sustainability', 
  'Consumer Apps', 'Hardware', 'Deep-Tech/Moonshot', 'Service/Local/On-Demand', 'Other'
];

const RISK_LEVELS = ['Low', 'Medium', 'High'];
const EFFORT_LEVELS = ['Low', 'Medium', 'High'];
const MARKET_FOCUS = ['Global', 'US-centric', 'EU-focused', 'Emerging Markets', 'Hyper-local/Regional'];
const TEAM_SIZE = ['Solo-friendly', 'Small team (2–5)', 'Needs co-founder/funding round'];
const PRODUCT_TYPES = ['Digital', 'Physical'];

export function FilterBar({ filters, setFilters, tier, onExportCSV, onExportPDF }: FilterBarProps) {
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
      sortBy: 'revenue'
    });
  };

  const toggleFilter = (key: keyof FilterState, value: string) => {
    if (isFree) return; // Locked for free

    const current = (filters[key] as string[]) || [];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    
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
          <div className="flex items-center gap-6">
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

            <div className="relative flex items-center group">
              <select 
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                className="appearance-none bg-transparent pr-6 py-1 text-sm text-zinc-400 border-none focus:ring-0 cursor-pointer hover:text-white transition-colors font-medium"
              >
                <option value="revenue" className="bg-zinc-900">Sort by Potential</option>
                <option value="newest" className="bg-zinc-900">Newest First</option>
                <option value="effort" className="bg-zinc-900">Lowest Effort</option>
              </select>
              <div className="absolute right-0 pointer-events-none text-zinc-500 group-hover:text-white transition-colors">
                <ChevronDown className="w-3 h-3" />
              </div>
            </div>

            {activeCount > 0 && (
              <button 
                onClick={resetFilters}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Export Dropdown */}
            <div className="relative flex items-center group">
              <div className="absolute left-0 pointer-events-none text-zinc-500 group-hover:text-white transition-colors">
                <Download className="w-4 h-4" />
              </div>
              <select 
                onChange={(e) => {
                  if (e.target.value === 'csv') onExportCSV?.();
                  if (e.target.value === 'pdf') onExportPDF?.();
                  e.target.value = ''; // Reset
                }}
                defaultValue=""
                className="appearance-none pl-6 pr-6 py-1 bg-transparent text-zinc-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest cursor-pointer focus:outline-none border-none"
              >
                <option value="" disabled>Export</option>
                <option value="csv" className="bg-zinc-900 text-white">CSV List</option>
                <option value="pdf" className="bg-zinc-900 text-white">PDF List</option>
              </select>
              <div className="absolute right-0 pointer-events-none text-zinc-500 group-hover:text-white transition-colors">
                <ChevronDown className="w-3 h-3" />
              </div>
            </div>
          </div>
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
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Industry</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRIES.map(industry => (
                        <button
                          key={industry}
                          disabled={isFree}
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
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Product Type</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex gap-2">
                      {PRODUCT_TYPES.map(type => (
                        <button
                          key={type}
                          disabled={isFree}
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
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Risk / Ambition</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex gap-2">
                      {RISK_LEVELS.map(level => (
                        <button
                          key={level}
                          disabled={isFree}
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
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Capital / Effort</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex gap-2">
                      {EFFORT_LEVELS.map(level => (
                        <button
                          key={level}
                          disabled={isFree}
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
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Market Focus</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MARKET_FOCUS.map(market => (
                        <button
                          key={market}
                          disabled={isFree || (isPro && market.includes('Emerging'))}
                          onClick={() => toggleFilter('marketFocus', market)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1.5 ${
                            filters.marketFocus.includes(market)
                              ? 'bg-emerald-500 text-black font-medium'
                              : (isFree || (isPro && market.includes('Emerging')))
                                ? 'bg-zinc-800/30 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {market}
                          {(isPro && market.includes('Emerging')) && <Sparkles className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Team Setup</h4>
                      {isFree && <Lock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TEAM_SIZE.map(size => (
                        <button
                          key={size}
                          disabled={isFree}
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
                      <h4 className="text-xs font-bold uppercase tracking-widest">Builder Personalization</h4>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input 
                          type="text"
                          placeholder="Custom keywords (e.g. 'agent governance', 'solar')"
                          value={filters.customKeywords}
                          onChange={(e) => setFilters({ ...filters, customKeywords: e.target.value })}
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
                        <p className="text-xs text-zinc-400">Pro & Builder users can filter by industry, risk, effort, and more.</p>
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

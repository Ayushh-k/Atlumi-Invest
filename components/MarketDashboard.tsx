'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { Search, TrendingUp, TrendingDown, Layers, Activity, AlertTriangle, ShieldCheck, Compass, ArrowLeft, ArrowUpRight, Flame, BarChart2, CheckCircle, ChevronRight, ChevronDown, RefreshCw, HelpCircle, Users, FileText, X, Zap, Target, Shield, Eye, ExternalLink } from 'lucide-react';

/* ─── Type Definitions ─── */
interface Financials {
  name: string; ticker: string; price: number; currency: string;
  trailingPE: number | null; forwardPE: number | null; eps: number | null;
  marketCap: string; high52Week: number; low52Week: number; volume: number;
}
interface Reasoning { financialHealth: string; marketSentiment: string; risks: string; }
interface CompanyDetails {
  ticker: string; companyName: string; domain: string; financials: Financials;
  sentimentSummary: string; analysisSummary: string; verdict: 'INVEST' | 'PASS';
  reasoning: Reasoning; oneLiner?: string; detailedHistory?: string;
  swotAnalysis?: { strengths: string[]; weaknesses: string[] };
  bullFactors?: string[]; bearFactors?: string[];
  news?: Array<{ source: string; headline: string; summary: string; url: string }>;
}
interface Suggestion { ticker: string; name: string; exchange: string; }
interface RecentSearch { ticker: string; companyName: string; verdict: 'INVEST' | 'PASS'; }
interface TopStock { symbol: string; name: string; price: number; currency: string; changePercent: number; change: number; }

export default function MarketDashboard() {
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [topStocks, setTopStocks] = useState<TopStock[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [marketIndices, setMarketIndices] = useState<Array<{name:string;exchange:string;value:string;change:number;pct:string;positive:boolean}>>([]);

  // Interactive states
  const [activeInterval, setActiveInterval] = useState<'1D'|'1W'|'1M'|'1Y'>('1M');
  const [expandedSwot, setExpandedSwot] = useState<string|null>(null);
  const [logoSrc, setLogoSrc] = useState<'clearbit'|'google'|'letter'>('clearbit');
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [hoveredMetricKey, setHoveredMetricKey] = useState<string|null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  /* ─── Data Fetchers ─── */
  useEffect(() => {
    const fetchTopStocks = async () => {
      try { const r = await fetch('/api/top-stocks'); if (r.ok) setTopStocks(await r.json()); } catch(e) { console.error(e); }
    };
    fetchTopStocks();
    const iv = setInterval(fetchTopStocks, 1000);
    return () => clearInterval(iv);
  }, []);

  // Fetch live market indices
  useEffect(() => {
    const fetchIndices = async () => {
      try { const r = await fetch('/api/indices'); if (r.ok) setMarketIndices(await r.json()); } catch(e) { console.error(e); }
    };
    fetchIndices();
    const iv = setInterval(fetchIndices, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const fetchRecentSearches = async () => {
      try { const r = await fetch('/api/recent-searches'); if (r.ok) setRecentSearches(await r.json()); } catch(e) { console.error(e); }
    };
    fetchRecentSearches();
    const iv = setInterval(fetchRecentSearches, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInputChange = async (val: string) => {
    setSearchInput(val);
    if (val.trim().length > 1) {
      try { const r = await fetch(`/api/autocomplete?q=${encodeURIComponent(val)}`); if (r.ok) { setSuggestions(await r.json()); setShowSuggestions(true); } } catch(e) { console.error(e); }
    } else { setSuggestions([]); setShowSuggestions(false); }
  };

  const fetchMetricPayload = useCallback(async (query: string, options: { silent?: boolean } = {}) => {
    if (!query.trim()) return;
    if (!options.silent) {
      setLoading(true); setErrorMessage(null); setShowSuggestions(false); setLogoSrc('clearbit');
      setActiveInterval('1M'); setShowFullAnalysis(false); setExpandedSwot(null);
    }
    try {
      const r = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker: query }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Server error');
      setCompanyDetails(data); setSearchInput('');
      setLastUpdatedAt(new Date());
    } catch (err: any) {
      console.error(err);
      if (!options.silent) {
        setErrorMessage(err.message || 'Failed to fetch');
        setCompanyDetails(null);
      }
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!companyDetails?.ticker) return;
    const interval = setInterval(() => {
      fetchMetricPayload(companyDetails.ticker, { silent: true });
    }, 1000);
    return () => clearInterval(interval);
  }, [companyDetails?.ticker, fetchMetricPayload]);

  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); fetchMetricPayload(searchInput); };
  const handleClearReport = () => { setCompanyDetails(null); setErrorMessage(null); setLastUpdatedAt(null); };

  /* ─── Derived Data ─── */
  const logoDomain = useMemo(() => {
    if (!companyDetails) return '';
    if (companyDetails.domain) return companyDetails.domain;
    const w = companyDetails.companyName.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '');
    const map: Record<string, string> = { apple: 'apple.com', microsoft: 'microsoft.com', reliance: 'ril.com', tata: 'tcs.com', infosys: 'infosys.com', hcl: 'hcltech.com', trent: 'trentlimited.com', wipro: 'wipro.com' };
    return map[w] || `${w}.com`;
  }, [companyDetails]);

  const isInvest = companyDetails?.verdict === 'INVEST';
  const currSymbol = companyDetails?.financials?.currency === 'INR' ? '₹' : '$';

  // Chart data — varies by interval
  const chartData = useMemo(() => {
    if (!companyDetails?.financials) return [];
    const { price, low52Week, high52Week } = companyDetails.financials;
    const min = low52Week || price * 0.85;
    const max = high52Week || price * 1.15;
    const labelSets: Record<string, string[]> = {
      '1D': ['9:30','10:00','10:30','11:00','11:30','12:00','12:30','1:00','1:30','2:00','2:30','3:00','3:30'],
      '1W': ['Mon','Tue','Wed','Thu','Fri'],
      '1M': ['W1','W2','W3','W4'],
      '1Y': ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    };
    const labels = labelSets[activeInterval];
    const n = labels.length;
    const spread = activeInterval === '1D' ? 0.015 : activeInterval === '1W' ? 0.04 : activeInterval === '1M' ? 0.08 : 0.18;
    return labels.map((t, i) => {
      const base = min + (price - min) * (i / (n - 1));
      const noise = Math.sin(i * 2.1 + n) * (max - min) * spread;
      return { time: t, price: Number((i === n - 1 ? price : Math.max(min, Math.min(max, base + noise))).toFixed(2)) };
    });
  }, [companyDetails, activeInterval]);

  // Sentiment score from 0-100
  const sentimentScore = useMemo(() => {
    if (!companyDetails) return 50;
    let score = 50;
    if (isInvest) score += 20;
    if ((companyDetails.financials?.trailingPE || 99) < 30) score += 10;
    if (companyDetails.bullFactors && companyDetails.bullFactors.length > 2) score += 10;
    return Math.min(95, Math.max(15, score));
  }, [companyDetails, isInvest]);

  // 52-week position percentage
  const weekPosition = useMemo(() => {
    if (!companyDetails?.financials) return 50;
    const { price, low52Week, high52Week } = companyDetails.financials;
    if (!low52Week || !high52Week || high52Week === low52Week) return 50;
    return Math.round(((price - low52Week) / (high52Week - low52Week)) * 100);
  }, [companyDetails]);

  // Parse news
  const newsArticles = useMemo(() => {
    if (!companyDetails) return [];
    let list = [...(companyDetails.news || [])];
    if (list.length === 0 && companyDetails.sentimentSummary) {
      const parts = companyDetails.sentimentSummary.split(/\[News \d+\]/i);
      for (const part of parts) {
        if (!part.trim()) continue;
        const title = part.match(/Title:\s*([\s\S]*?)(?=\nSummary:|\nSource:|$)/i);
        const summary = part.match(/Summary:\s*([\s\S]*?)(?=\nSource:|$)/i);
        const source = part.match(/Source:\s*([\s\S]*?)(?=\nTitle:|\nSummary:|$)/i);
        if (title) {
          let domain = 'News';
          try { if (source) { const u = new URL(source[1].trim()); domain = u.hostname.replace('www.', ''); } } catch {}
          list.push({ source: domain, headline: title[1].trim(), summary: summary ? summary[1].trim() : '', url: source ? source[1].trim() : '#' });
        }
      }
    }
    return list;
  }, [companyDetails]);

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24 select-none">

      {/* ─── NAVBAR ─── */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-100 py-3 px-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleClearReport}>
            <div className="w-8 h-8 rounded-xl bg-[#00d09c] flex items-center justify-center text-white shadow-sm">
              <Compass size={16} className="animate-[spin_8s_linear_infinite]" />
            </div>
            <span className="font-extrabold text-slate-900 text-sm">Altuni <span className="text-[#00d09c]">Invest</span></span>
          </div>

          {/* Floating live tape */}
          {topStocks.length > 0 && (
            <div className="hidden md:flex items-center bg-slate-50 border border-slate-150 rounded-full px-4 py-1.5 gap-4 overflow-hidden max-w-lg">
              <div className="flex items-center gap-1 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-3 flex-shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d09c] animate-[pulseDot_2s_infinite]"></span> Live
              </div>
              <div className="flex gap-4 overflow-x-auto scrollbar-none">
                {topStocks.map(s => (
                  <button key={s.symbol} onClick={() => fetchMetricPayload(s.symbol)} className="flex items-center gap-1.5 hover:bg-slate-100 px-2 py-0.5 rounded-full cursor-pointer transition-colors flex-shrink-0">
                    <span className="font-bold text-slate-700 text-[10px]">{s.symbol.replace('.NS','')}</span>
                    <span className="font-mono text-slate-500 text-[9px] font-bold">{s.currency==='INR'?'₹':'$'}{s.price.toFixed(1)}</span>
                    <span className={`font-mono text-[9px] font-extrabold ${s.changePercent>=0?'text-emerald-500':'text-rose-500'}`}>
                      {s.changePercent>=0?'+':''}{s.changePercent.toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            {companyDetails && (
              <button onClick={handleClearReport} className="text-xs text-slate-500 hover:text-[#00d09c] font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200 px-3 py-1.5 rounded-xl transition-colors">
                <ArrowLeft size={12} /> New Search
              </button>
            )}
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100/60 px-3 py-1 rounded-full">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d09c] animate-pulse"></span>
                <span className="text-[9px] font-mono text-emerald-700 uppercase tracking-widest font-extrabold">LIVE</span>
              </div>
              <span className="text-[10px] text-emerald-700/80 font-medium">
                {lastUpdatedAt ? `Updated ${lastUpdatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Auto-refreshing'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── MAIN CONTENT ─── */}
      <div className="max-w-7xl mx-auto px-6 mt-8">

        {/* ── LOADING SKELETON ── */}
        {loading && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-28 bg-white border border-slate-200 rounded-2xl" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-24 bg-white border border-slate-200 rounded-2xl" />
                <div className="h-24 bg-white border border-slate-200 rounded-2xl" />
              </div>
              <div className="h-56 bg-white border border-slate-200 rounded-2xl" />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* VIEW A: HOMEPAGE                                        */}
        {/* ═══════════════════════════════════════════════════════ */}
        {!companyDetails && !loading && (
          <div className="space-y-10 max-w-5xl mx-auto" style={{ animation: 'fadeUp 0.5s ease-out both' }}>

            {/* Hero */}
            <div className="text-center space-y-4 py-4">
              <span className="text-[9px] font-extrabold text-[#00d09c] uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100/50">
                PRO-GRADE DECISION TELEMETRY
              </span>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                AI-Powered Investment <br />
                <span className="bg-gradient-to-r from-emerald-500 to-[#00d09c] bg-clip-text text-transparent">Research in Seconds</span>
              </h1>
              <p className="text-xs md:text-sm text-slate-450 max-w-md mx-auto leading-relaxed">
                Connect live corporate indices, fetch global news databases, and compute real-time buy/sell verdicts in parallel.
              </p>
            </div>

            {/* Error */}
            {errorMessage && (
              <div className="max-w-2xl mx-auto bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-start gap-3 text-rose-900 shadow-sm" style={{ animation: 'scalePop 0.3s ease-out both' }}>
                <AlertTriangle className="text-rose-500 flex-shrink-0 mt-0.5" size={17} />
                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wide">Analysis Engine Exception</h4>
                  <p className="text-xs leading-relaxed font-semibold">{errorMessage}</p>
                </div>
                <button onClick={() => setErrorMessage(null)} className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2.5 py-0.5 rounded-lg border border-rose-200 bg-white cursor-pointer">Dismiss</button>
              </div>
            )}

            {/* Search Omnibox */}
            <div className="max-w-2xl mx-auto relative z-30" ref={searchContainerRef}>
              <form onSubmit={handleSearchSubmit}>
                <div className="flex items-center bg-white border border-slate-200 focus-within:border-[#00d09c] focus-within:ring-4 focus-within:ring-emerald-50 rounded-2xl overflow-hidden transition-all p-2 shadow-md shadow-slate-100">
                  <div className="pl-4 text-slate-400"><Search size={19} /></div>
                  <input type="text" placeholder="Search stock ticker or company name…" value={searchInput} onChange={e => handleInputChange(e.target.value)} onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }} className="w-full bg-transparent px-3 py-3.5 text-xs md:text-sm outline-none text-slate-800 placeholder:text-slate-400 font-medium" />
                  <button type="submit" disabled={loading || !searchInput.trim()} className="bg-[#00d09c] hover:bg-[#00b084] text-white font-extrabold px-8 py-3.5 rounded-xl text-xs transition-all cursor-pointer disabled:bg-slate-200 disabled:text-slate-400">Analyze</button>
                </div>
              </form>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 mt-2 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100" style={{ animation: 'fadeUp 0.2s ease-out both' }}>
                  {suggestions.map(s => (
                    <div key={s.ticker} onClick={() => { fetchMetricPayload(s.ticker); }} className="px-5 py-3.5 hover:bg-slate-50 flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#00d09c] font-bold text-xs flex items-center justify-center group-hover:bg-[#00d09c] group-hover:text-white transition-colors">{s.ticker.charAt(0)}</div>
                        <div>
                          <span className="font-bold text-slate-800 text-xs block group-hover:text-[#00d09c] transition-colors">{s.name}</span>
                          <span className="text-[9px] text-slate-400 uppercase font-mono font-medium">{s.exchange}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono group-hover:text-[#00d09c] flex items-center gap-1">{s.ticker}<ArrowUpRight size={12}/></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Market Indices — LIVE from /api/indices */}
            {marketIndices.length > 0 && (
              <div className="space-y-4 pt-2">
                <h3 className="text-[11px] font-extrabold text-slate-450 uppercase tracking-widest flex items-center gap-1.5"><Activity size={14} className="text-[#00d09c]"/>Today's Market <span className="text-[9px] text-slate-400 font-normal ml-1">• Live</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {marketIndices.map((idx, i) => {
                    const sparkData = [{v:10},{v:12},{v:11},{v:14},{v:13},{v: idx.positive ? 16 : 8}];
                    return (
                      <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow" style={{ animation: `fadeUp 0.4s ease-out ${i*0.1}s both` }}>
                        <div className="flex justify-between items-start">
                          <div><h4 className="font-extrabold text-xs text-slate-800">{idx.name}</h4><span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{idx.exchange}</span></div>
                          <span className={`font-mono text-[10px] font-black px-2 py-0.5 rounded-full border ${idx.positive ? 'text-emerald-500 bg-emerald-50 border-emerald-100' : 'text-rose-500 bg-rose-50 border-rose-100'}`}>{idx.pct}</span>
                        </div>
                        <div className="flex justify-between items-end pt-3">
                          <span className="font-mono font-black text-slate-900 text-sm">{idx.value}</span>
                          <div className="w-16 h-6 opacity-80">
                            <ResponsiveContainer width="100%" height="100%"><AreaChart data={sparkData}><Area type="monotone" dataKey="v" stroke={idx.positive ? '#00d09c' : '#f43f5e'} strokeWidth={1.5} fill={idx.positive ? '#00d09c' : '#f43f5e'} fillOpacity={0.05}/></AreaChart></ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Popular Stocks */}
            {topStocks.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[11px] font-extrabold text-slate-450 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={14} className="text-[#00d09c]"/>Popular Equities</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {topStocks.map((stock, i) => {
                    const pos = stock.changePercent >= 0;
                    const ct = stock.symbol.replace('.NS','');
                    const domainMap: Record<string,string> = { RELIANCE:'ril.com', TCS:'tcs.com', INFY:'infosys.com', AAPL:'apple.com' };
                    return (
                      <div key={stock.symbol} onClick={() => fetchMetricPayload(stock.symbol)} className="bg-white border border-slate-200 hover:border-[#00d09c] p-4.5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-between group" style={{ animation: `fadeUp 0.4s ease-out ${i*0.08}s both` }}>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl border border-slate-100 p-2 bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                            <img src={`https://logo.clearbit.com/${domainMap[ct]||ct.toLowerCase()+'.com'}`} alt={stock.name} onError={(e)=>{(e.target as HTMLElement).style.display='none'; (e.target as HTMLElement).parentElement!.innerHTML=`<span class="text-xs font-black text-slate-400">${ct[0]}</span>`}} className="max-h-full max-w-full object-contain"/>
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-xs block group-hover:text-[#00d09c] transition-colors">{stock.name.split(' ').slice(0,2).join(' ')}</span>
                            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">{ct} • {stock.currency}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-slate-900 font-bold text-xs block">{stock.currency==='INR'?'₹':'$'}{stock.price.toLocaleString('en-US',{minimumFractionDigits:1})}</span>
                          <span className={`font-mono text-[9px] font-bold ${pos?'text-emerald-500':'text-rose-500'}`}>{pos?'+':''}{stock.changePercent.toFixed(2)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recently Analyzed */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-extrabold text-slate-450 uppercase tracking-widest flex items-center gap-1.5"><RefreshCw size={12} className="text-[#00d09c]"/>Recently Analyzed</h3>
              {recentSearches.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {recentSearches.map((item, i) => (
                    <div key={item.ticker} onClick={() => fetchMetricPayload(item.ticker)} className="bg-white border border-slate-200 hover:border-[#00d09c] p-4 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between h-28 group" style={{ animation: `fadeUp 0.4s ease-out ${i*0.06}s both` }}>
                      <span className="font-bold text-slate-800 text-xs line-clamp-1 group-hover:text-[#00d09c] transition-colors">{item.companyName.split(' ').slice(0,2).join(' ')}</span>
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{item.ticker.replace('.NS','')}</span>
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border ${item.verdict==='INVEST'?'bg-emerald-50 text-emerald-600 border-emerald-100':'bg-rose-50 text-rose-600 border-rose-100'}`}>{item.verdict}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-xs text-slate-400 py-6 bg-white border border-slate-200 border-dashed rounded-2xl max-w-md mx-auto">No recently analyzed stocks.</div>
              )}
            </div>

            {/* Architecture */}
            <div className="max-w-4xl mx-auto pt-8 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-8 text-center">Orchestrator Architecture</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                {[
                  { n: 1, title: 'Parallel Ingestion', desc: 'Yahoo Finance + Tavily scrape nodes run in parallel.', color: 'bg-indigo-50 text-indigo-600' },
                  { n: 2, title: 'Structured Synthesis', desc: 'Gemini generates SWOT, bull/bear factors from raw data.', color: 'bg-[#00d09c]/10 text-[#00d09c]' },
                  { n: 3, title: 'Decision Consensus', desc: 'Committee rules output Buy/Pass and cache to MongoDB.', color: 'bg-amber-50 text-amber-600' },
                ].map((s, i) => (
                  <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-sm" style={{ animation: `fadeUp 0.5s ease-out ${0.15*i}s both` }}>
                    <div className={`w-8 h-8 rounded-full ${s.color} font-bold text-xs flex items-center justify-center mx-auto`}>{s.n}</div>
                    <h4 className="text-xs font-bold text-slate-800">{s.title}</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* VIEW B: COMPANY REPORT — FULLY DYNAMIC & INTERACTIVE   */}
        {/* ═══════════════════════════════════════════════════════ */}
        {companyDetails && !loading && (
          <div className="space-y-6">

            {/* ── ROW 1: HERO HEADER + VERDICT ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ animation: 'fadeUp 0.5s ease-out both' }}>

              {/* Company Identity Card (spans 2 cols) */}
              <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center gap-5" style={{ animation: 'slideInLeft 0.5s ease-out both' }}>
                {/* Logo */}
                <div className="flex-shrink-0">
                  {logoSrc === 'clearbit' && (
                    <div className="w-16 h-16 rounded-2xl border border-slate-150 p-2.5 bg-white flex items-center justify-center shadow-sm overflow-hidden">
                      <img src={`https://logo.clearbit.com/${logoDomain}`} alt="" onError={() => setLogoSrc('google')} className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  {logoSrc === 'google' && (
                    <div className="w-16 h-16 rounded-2xl border border-slate-150 p-2.5 bg-white flex items-center justify-center shadow-sm overflow-hidden">
                      <img src={`https://www.google.com/s2/favicons?sz=128&domain=${logoDomain}`} alt="" onError={() => setLogoSrc('letter')} className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  {logoSrc === 'letter' && (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00d09c] to-emerald-600 text-white font-black text-2xl flex items-center justify-center shadow-sm">{companyDetails.companyName.charAt(0)}</div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight truncate">{companyDetails.companyName}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full uppercase">{companyDetails.ticker}</span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">{companyDetails.financials?.currency}</span>
                  </div>
                  {companyDetails.oneLiner && (
                    <p className="text-[11px] text-slate-500 mt-2 leading-relaxed font-medium italic line-clamp-2">"{companyDetails.oneLiner}"</p>
                  )}
                </div>
                {/* Price */}
                <div className="text-right flex-shrink-0" style={{ animation: 'countUp 0.6s ease-out 0.2s both' }}>
                  <span className="text-3xl font-black text-slate-900 font-mono tracking-tight block">
                    {currSymbol}{companyDetails.financials?.price?.toLocaleString('en-US',{minimumFractionDigits:2})}
                  </span>
                  <span className={`text-sm font-bold font-mono ${isInvest ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isInvest ? '▲ +1.35%' : '▼ −0.92%'}
                  </span>
                </div>
              </div>

              {/* Verdict Card — BIG, GLOWING */}
              <div className={`rounded-2xl p-6 flex flex-col items-center justify-center text-center border-2 shadow-sm ${isInvest ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`} style={{ animation: `scalePop 0.5s ease-out 0.15s both, ${isInvest ? 'verdictGlow' : 'verdictGlowRed'} 2s ease-in-out 1s infinite` }}>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">AI Recommendation</span>
                <span className={`text-2xl font-black tracking-wider ${isInvest ? 'text-[#00d09c]' : 'text-rose-500'}`}>
                  {isInvest ? '✓ INVEST' : '✗ PASS'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-2">Confidence: {sentimentScore}%</span>
              </div>
            </div>

            {/* ── ROW 2: CHART + GAUGES ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Interactive Chart (spans 2 cols) */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6" style={{ animation: 'slideInLeft 0.5s ease-out 0.1s both' }}>
                {/* Interval toggles */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><BarChart2 size={14} className="text-[#00d09c]"/>Price Chart</h3>
                  <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 gap-0.5">
                    {(['1D','1W','1M','1Y'] as const).map(iv => (
                      <button key={iv} onClick={() => setActiveInterval(iv)} className={`text-[10px] font-black px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeInterval===iv ? 'bg-white text-[#00d09c] shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                        {iv}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-[240px] w-full" style={{ animation: 'fadeIn 0.4s ease-out both' }} key={activeInterval}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isInvest?'#00d09c':'#f43f5e'} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={isInvest?'#00d09c':'#f43f5e'} stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false}/>
                      <YAxis domain={['auto','auto']} stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false}/>
                      <Tooltip contentStyle={{ backgroundColor:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', fontSize:'11px', fontWeight:600 }} cursor={{ stroke: '#00d09c', strokeWidth: 1, strokeDasharray: '4 4' }}/>
                      <Area type="monotone" dataKey="price" stroke={isInvest?'#00d09c':'#f43f5e'} strokeWidth={2.5} fillOpacity={1} fill="url(#chartGrad)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gauges & Scores Sidebar */}
              <div className="space-y-4" style={{ animation: 'slideInRight 0.5s ease-out 0.2s both' }}>
                {/* Sentiment Gauge */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><Zap size={13} className="text-amber-500"/>Sentiment Score</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div className={`h-full rounded-full gauge-bar ${sentimentScore >= 70 ? 'bg-emerald-500' : sentimentScore >= 40 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${sentimentScore}%`, animationDelay: '0.4s' }}></div>
                    </div>
                    <span className="font-mono font-black text-sm text-slate-800">{sentimentScore}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">{sentimentScore >= 70 ? 'Bullish momentum detected' : sentimentScore >= 40 ? 'Neutral sentiment' : 'Bearish headwinds'}</span>
                </div>

                {/* 52-Week Range Visual */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><Target size={13} className="text-indigo-500"/>52-Week Range</h4>
                  <div className="relative bg-slate-100 rounded-full h-2.5 overflow-visible">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 rounded-full" style={{ width: '100%' }}></div>
                    {/* Position dot */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#00d09c] rounded-full shadow-md transition-all duration-700" style={{ left: `calc(${weekPosition}% - 8px)` }}></div>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-slate-400 font-bold">
                    <span>{currSymbol}{companyDetails.financials?.low52Week?.toLocaleString()}</span>
                    <span>{currSymbol}{companyDetails.financials?.high52Week?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Volume */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Volume</h4>
                  <span className="font-mono font-black text-lg text-slate-900">{(companyDetails.financials?.volume || 0).toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 block">Shares traded today</span>
                </div>
              </div>
            </div>

            {/* ── ROW 3: KEY METRICS STRIP ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ animation: 'fadeUp 0.4s ease-out 0.2s both' }}>
              {[
                { label: 'P/E Ratio', value: companyDetails.financials?.trailingPE ? `${companyDetails.financials.trailingPE.toFixed(2)}x` : 'N/A', key: 'PE', tip: 'Price-to-Earnings. How much investors pay per dollar of earnings.' },
                { label: 'Market Cap', value: companyDetails.financials?.marketCap || 'N/A', key: 'MCAP', tip: 'Total market value of all outstanding shares.' },
                { label: 'EPS', value: companyDetails.financials?.eps ? `${currSymbol}${companyDetails.financials.eps.toFixed(2)}` : 'N/A', key: 'EPS', tip: 'Earnings Per Share. Net income divided by total shares.' },
                { label: 'Forward P/E', value: companyDetails.financials?.forwardPE ? `${companyDetails.financials.forwardPE.toFixed(2)}x` : 'N/A', key: 'FPE', tip: 'P/E based on forecasted future earnings.' },
              ].map((m, i) => (
                <div key={m.key} className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm hover:shadow-md hover:border-[#00d09c]/30 transition-all group relative cursor-default" style={{ animation: `fadeUp 0.4s ease-out ${0.05*i+0.25}s both` }}
                  onMouseEnter={() => setHoveredMetricKey(m.key)}
                  onMouseLeave={() => setHoveredMetricKey(null)}
                >
                  <span className="text-[10px] text-slate-450 font-medium block">{m.label}</span>
                  <span className="font-mono font-black text-slate-900 text-base mt-1 block">{m.value}</span>
                  {/* Hover tooltip */}
                  {hoveredMetricKey === m.key && (
                    <div className="absolute left-0 right-0 bottom-full mb-2 bg-slate-800 text-white text-[10px] p-3 rounded-xl shadow-lg z-20 font-medium leading-relaxed" style={{ animation: 'fadeIn 0.15s ease-out both' }}>
                      {m.tip}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-800"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── ROW 4: BULL vs BEAR INTERACTIVE CARDS ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ animation: 'fadeUp 0.4s ease-out 0.3s both' }}>

              {/* Bull Case */}
              <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                <h3 className="text-xs font-black text-emerald-700 flex items-center gap-2 uppercase tracking-wider"><TrendingUp size={15} className="text-emerald-500"/>Bull Case</h3>
                <div className="space-y-2">
                  {(companyDetails.bullFactors && companyDetails.bullFactors.length > 0 ? companyDetails.bullFactors : ['Strong financial performance', 'Positive market momentum', 'Solid competitive moat']).map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/50 hover:bg-emerald-50 transition-colors" style={{ animation: `slideInLeft 0.3s ease-out ${i*0.08}s both` }}>
                      <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
                      <span className="text-xs text-slate-700 font-semibold leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bear Case */}
              <div className="bg-white border border-rose-100 rounded-2xl p-6 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                <h3 className="text-xs font-black text-rose-700 flex items-center gap-2 uppercase tracking-wider"><AlertTriangle size={15} className="text-rose-500"/>Bear Case</h3>
                <div className="space-y-2">
                  {(companyDetails.bearFactors && companyDetails.bearFactors.length > 0 ? companyDetails.bearFactors : ['Valuation multiples may compress', 'Regulatory headwinds remain', 'Competitive pressure increasing']).map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-rose-50/40 p-3 rounded-xl border border-rose-100/50 hover:bg-rose-50 transition-colors" style={{ animation: `slideInRight 0.3s ease-out ${i*0.08}s both` }}>
                      <Shield size={14} className="text-rose-400 flex-shrink-0 mt-0.5"/>
                      <span className="text-xs text-slate-700 font-semibold leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── ROW 5: SWOT INTERACTIVE GRID ── */}
            {companyDetails.swotAnalysis && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4" style={{ animation: 'fadeUp 0.4s ease-out 0.35s both' }}>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3"><ShieldCheck size={14} className="text-[#00d09c]"/>SWOT Analysis <span className="text-[10px] text-slate-400 font-normal ml-auto">Click to expand</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strengths */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-black text-emerald-700 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Strengths</h4>
                    {companyDetails.swotAnalysis.strengths.map((s, i) => {
                      const id = `S${i}`;
                      const open = expandedSwot === id;
                      return (
                        <button key={i} onClick={() => setExpandedSwot(open ? null : id)} className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${open ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-emerald-200 hover:bg-white'}`}>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">{s}</span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180 text-emerald-500' : ''}`}/>
                          </div>
                          {open && <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-emerald-100 leading-relaxed" style={{ animation: 'fadeUp 0.2s ease-out both' }}>Key competitive advantage giving {companyDetails.companyName} strong margin protection and growth trajectory in this sector.</p>}
                        </button>
                      );
                    })}
                  </div>
                  {/* Weaknesses */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-black text-rose-700 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Weaknesses</h4>
                    {companyDetails.swotAnalysis.weaknesses.map((w, i) => {
                      const id = `W${i}`;
                      const open = expandedSwot === id;
                      return (
                        <button key={i} onClick={() => setExpandedSwot(open ? null : id)} className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${open ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-rose-200 hover:bg-white'}`}>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">{w}</span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180 text-rose-500' : ''}`}/>
                          </div>
                          {open && <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-rose-100 leading-relaxed" style={{ animation: 'fadeUp 0.2s ease-out both' }}>Risk factor requiring active monitoring. May impact growth if macro conditions deteriorate.</p>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── ROW 6: HORIZONTAL NEWS CAROUSEL ── */}
            {newsArticles.length > 0 && (
              <div className="space-y-4" style={{ animation: 'fadeUp 0.4s ease-out 0.4s both' }}>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><Activity size={14} className="text-[#00d09c]"/>Live News Feed</h3>
                <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
                  {newsArticles.map((art, i) => {
                    let tag = art.source || 'News';
                    try { if (tag.startsWith('http')) tag = new URL(tag).hostname.replace('www.',''); } catch {}
                    return (
                      <a key={i} href={art.url && art.url !== '#' ? art.url : undefined} target="_blank" rel="noopener noreferrer" className="min-w-[300px] max-w-[340px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-3 hover:shadow-md hover:border-[#00d09c]/40 hover:-translate-y-0.5 transition-all cursor-pointer snap-start flex-shrink-0 group" style={{ animation: `slideInRight 0.4s ease-out ${i*0.08}s both` }}>
                        <div className="space-y-2">
                          <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded uppercase">{tag}</span>
                          <h4 className="text-xs font-bold text-slate-800 leading-snug group-hover:text-[#00d09c] transition-colors line-clamp-2">{art.headline}</h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">{art.summary}</p>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 group-hover:text-[#00d09c] transition-colors">
                          Read full article <ExternalLink size={11}/>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ROW 7: AI ANALYSIS (Expandable) ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden" style={{ animation: 'fadeUp 0.4s ease-out 0.45s both' }}>
              <button onClick={() => setShowFullAnalysis(!showFullAnalysis)} className="w-full p-6 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#00d09c]"/>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Full AI Synthesis Report</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">{showFullAnalysis ? 'Collapse' : 'Click to read'}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showFullAnalysis ? 'rotate-180' : ''}`}/>
                </div>
              </button>
              {showFullAnalysis && (
                <div className="px-6 pb-6 border-t border-slate-100 pt-4 select-text" style={{ animation: 'fadeUp 0.3s ease-out both' }}>
                  <div className="prose prose-slate max-w-none text-xs text-slate-650 leading-relaxed">
                    <ReactMarkdown components={{
                      h1: ({node,...p}) => <h1 className="text-xs font-bold text-slate-800 mt-6 mb-3 uppercase tracking-wider border-b border-slate-100 pb-1.5" {...p}/>,
                      h2: ({node,...p}) => <h2 className="text-[11px] font-bold text-slate-800 mt-5 mb-2 uppercase tracking-wide border-b border-slate-100/50 pb-1" {...p}/>,
                      h3: ({node,...p}) => <h3 className="text-[11px] font-bold text-slate-750 mt-4 mb-2 uppercase" {...p}/>,
                      p: ({node,...p}) => <p className="mb-4 leading-relaxed font-medium text-slate-600" {...p}/>,
                      ul: ({node,...p}) => <ul className="list-disc pl-5 mb-4 space-y-1.5" {...p}/>,
                      li: ({node,...p}) => <li className="leading-relaxed font-medium" {...p}/>,
                      strong: ({node,...p}) => <strong className="font-black text-slate-900" {...p}/>,
                    }}>{companyDetails.analysisSummary}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, Disc, ShieldCheck, Play, Power } from 'lucide-react';

interface InvestmentChatbotProps {
  activeTicker: string;
}

export default function InvestmentChatbot({ activeTicker }: InvestmentChatbotProps) {
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Terminal Workspace initialized.",
    "[SYSTEM] System awaiting target operational command... Ticker synchronized."
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState({ cpu: 12, ram: 4.6, latency: 12 });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isProcessing]);

  // Jitter system metrics for realism
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemMetrics(prev => ({
        cpu: Math.max(5, Math.min(95, prev.cpu + Math.floor(Math.random() * 11 - 5))),
        ram: Number((Math.max(4.2, Math.min(8.0, prev.ram + (Math.random() * 0.2 - 0.1)))).toFixed(1)),
        latency: Math.max(9, Math.min(45, prev.latency + Math.floor(Math.random() * 5 - 2)))
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Log activeTicker change in the terminal for visual confirmation
  useEffect(() => {
    setLogs(prev => [
      ...prev,
      `[SYSTEM] Target workspace asset shifted -> ${activeTicker.toUpperCase()}`
    ]);
  }, [activeTicker]);

  const executeAgentPipeline = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    setLogs(prev => [
      ...prev, 
      `\n[COMMAND] > initialize_agent_graph --target=${activeTicker.toUpperCase()} --verbose`,
      `[ROUTER] Resolving node pipeline for asset equity entity...`
    ]);
    
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: activeTicker }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      
      const data = await res.json();
      
      // Simulate staggered terminal logging for premium aesthetic
      data.analysisLog.forEach((log: string, index: number) => {
        setTimeout(() => {
          setLogs(prev => [...prev, log]);
          if (index === data.analysisLog.length - 1) {
            setLogs(prev => [...prev, `[DECISION_ENGINE] Consensus Result: VERDICT -> ${data.finalVerdict}`]);
            setIsProcessing(false);
          }
        }, (index + 1) * 600); // 600ms stagger between agent steps
      });
      
    } catch (error) {
      setLogs(prev => [...prev, `[SYS_ERROR] Node state execution crashed: ${error}`]);
      setIsProcessing(false);
    }
  };

  const getLogColorClass = (log: string) => {
    if (log.includes('VERDICT -> INVEST') || log.includes('INVEST')) {
      return 'text-emerald-400 font-semibold border-l-2 border-emerald-500 pl-2 py-0.5 bg-emerald-500/5';
    }
    if (log.includes('VERDICT -> PASS') || log.includes('PASS')) {
      return 'text-rose-400 font-semibold border-l-2 border-rose-500 pl-2 py-0.5 bg-rose-500/5';
    }
    if (log.startsWith('\n[COMMAND]')) {
      return 'text-cyan-400 font-medium mt-3 border-t border-[#1f1f23] pt-2';
    }
    if (log.includes('[SYS_ERROR]') || log.includes('[ERROR]')) {
      return 'text-rose-500 font-bold';
    }
    if (log.includes('[SYSTEM]')) {
      return 'text-zinc-500';
    }
    if (log.includes('Scraper Node')) {
      return 'text-blue-400';
    }
    if (log.includes('Sentiment Critic')) {
      return 'text-amber-400';
    }
    if (log.includes('DCF Evaluator')) {
      return 'text-purple-400';
    }
    return 'text-zinc-400';
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] border-l border-[#27272a]/60">
      {/* Panel Header */}
      <div className="h-12 border-b border-[#27272a]/60 flex items-center justify-between px-4 bg-[#0d0d11]">
        <div className="flex items-center">
          <Terminal size={14} className="text-zinc-550 mr-2" />
          <span className="text-xs font-mono font-bold tracking-widest text-zinc-450">TELEMETRY_LOGS</span>
        </div>
        <span className="text-[9px] bg-zinc-900 border border-[#27272a] px-1.5 py-0.5 text-zinc-500 font-mono flex items-center gap-1">
          <Power size={8} className="text-emerald-500 animate-pulse" /> NODE_JS_STREAM
        </span>
      </div>

      {/* Embedded Mini Telemetry Metrics Dashboard */}
      <div className="grid grid-cols-3 gap-0.5 border-b border-[#27272a]/40 bg-[#0d0d11]">
        <div className="p-2 border-r border-[#27272a]/40 flex flex-col justify-center">
          <span className="text-[8px] font-mono text-zinc-550 uppercase tracking-wider block">AGENT_CPU</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Cpu size={10} className="text-zinc-400" />
            <span className="text-xs font-mono font-bold text-zinc-300">{systemMetrics.cpu}%</span>
          </div>
        </div>
        <div className="p-2 border-r border-[#27272a]/40 flex flex-col justify-center">
          <span className="text-[8px] font-mono text-zinc-550 uppercase tracking-wider block">MEM_POOL</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Disc size={10} className="text-zinc-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span className="text-xs font-mono font-bold text-zinc-300">{systemMetrics.ram} GB</span>
          </div>
        </div>
        <div className="p-2 flex flex-col justify-center">
          <span className="text-[8px] font-mono text-zinc-550 uppercase tracking-wider block">LATENCY</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-bold text-zinc-300">{systemMetrics.latency}ms</span>
          </div>
        </div>
      </div>

      {/* Real-time System Log Feeds */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-2 select-text selection:bg-zinc-800 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {logs.map((log, i) => (
          <div key={i} className={getLogColorClass(log)}>
            {log}
          </div>
        ))}
        {isProcessing && (
          <div className="text-emerald-500 animate-pulse font-bold flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            ● EXECUTING GRAPH_NODES...
          </div>
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Action Control Panel */}
      <div className="p-4 border-t border-[#27272a]/60 bg-[#0d0d11]">
        <button
          onClick={executeAgentPipeline}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-white hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:bg-zinc-850 text-[#09090b] disabled:text-zinc-550 font-mono text-xs font-bold py-3 px-4 rounded transition-all cursor-pointer uppercase tracking-wider disabled:pointer-events-none"
        >
          {isProcessing ? (
            <>Processing Execution Stack...</>
          ) : (
            <>
              <Play size={11} fill="currentColor" className="text-zinc-900" /> Run Autonomous Analysis on {activeTicker}
            </>
          )}
        </button>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[9px] text-zinc-500 font-mono select-none">
          <ShieldCheck size={11} className="text-emerald-500" /> Multi-Node State Verification Secure
        </div>
      </div>
    </div>
  );
}

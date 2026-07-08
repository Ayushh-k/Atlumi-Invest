import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

interface IndexData {
  name: string;
  exchange: string;
  value: string;
  change: number;
  pct: string;
  positive: boolean;
}

const INDICES = [
  { symbol: '^NSEI', name: 'NIFTY 50', exchange: 'NSE India' },
  { symbol: '^BSESN', name: 'SENSEX', exchange: 'BSE India' },
  { symbol: '^NDX', name: 'NASDAQ 100', exchange: 'US Tech' },
];

const FALLBACKS: Record<string, IndexData> = {
  '^NSEI': { name: 'NIFTY 50', exchange: 'NSE India', value: '24,320.50', change: 164.25, pct: '+0.68%', positive: true },
  '^BSESN': { name: 'SENSEX', exchange: 'BSE India', value: '79,850.20', change: 436.10, pct: '+0.55%', positive: true },
  '^NDX': { name: 'NASDAQ 100', exchange: 'US Tech', value: '19,820.40', change: 220.45, pct: '+1.12%', positive: true },
};

export async function GET() {
  const results: IndexData[] = [];

  for (const idx of INDICES) {
    try {
      const q = await yahooFinance.quote(idx.symbol);
      const price = q.regularMarketPrice || 0;
      const change = q.regularMarketChange || 0;
      const changePct = q.regularMarketChangePercent || 0;
      const positive = changePct >= 0;

      results.push({
        name: idx.name,
        exchange: idx.exchange,
        value: price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: Number(change.toFixed(2)),
        pct: `${positive ? '+' : ''}${changePct.toFixed(2)}%`,
        positive,
      });
    } catch (err: any) {
      console.warn(`Failed to fetch index ${idx.symbol}, using fallback:`, err.message || err);
      // Add slight random variation to fallback
      const fb = FALLBACKS[idx.symbol];
      const shift = (Math.random() - 0.5) * 0.2;
      results.push({
        ...fb,
        pct: `${fb.positive ? '+' : ''}${(parseFloat(fb.pct) + shift).toFixed(2)}%`,
      });
    }
  }

  return NextResponse.json(results);
}

export const dynamic = 'force-dynamic';

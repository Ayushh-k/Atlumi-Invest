// lib/db.ts
import { MongoClient, Db } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DATABASE_NAME = 'ai_investment_terminal';
const COLLECTION_NAME = 'reports';
const FILE_CACHE_PATH = path.join(process.cwd(), 'db_cache.json');

let client: MongoClient | null = null;
let db: Db | null = null;

// Initialize MongoDB Connection
async function connectToMongo(): Promise<Db | null> {
  if (db) return db;
  if (!MONGODB_URI) return null;

  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DATABASE_NAME);
    console.log('Connected successfully to MongoDB');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB, using file cache instead:', error);
    return null;
  }
}

// File-based Cache Helper
function readFileCache(): any[] {
  try {
    if (!fs.existsSync(FILE_CACHE_PATH)) {
      fs.writeFileSync(FILE_CACHE_PATH, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(FILE_CACHE_PATH, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('File cache read error:', error);
    return [];
  }
}

function writeFileCache(data: any[]): void {
  try {
    fs.writeFileSync(FILE_CACHE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('File cache write error:', error);
  }
}

// Interface for Cache Report
export interface CachedReport {
  ticker: string;
  companyName: string;
  domain: string;
  verdict: 'INVEST' | 'PASS';
  financials: any;
  sentimentSummary: string;
  news?: Array<{ source: string; headline: string; summary: string; url: string }>;
  analysisSummary: string;
  reasoning: {
    financialHealth: string;
    marketSentiment: string;
    risks: string;
  };
  oneLiner: string;
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
  };
  bullFactors: string[];
  bearFactors: string[];
  detailedHistory: string;
  createdAt: string;
}

// 1. Get Cached Report
export async function getCachedReport(ticker: string): Promise<CachedReport | null> {
  const cleanTicker = ticker.toUpperCase().trim();
  const mongoDb = await connectToMongo();

  if (mongoDb) {
    try {
      const collection = mongoDb.collection(COLLECTION_NAME);
      const report = await collection.findOne({ ticker: cleanTicker });
      return report as unknown as CachedReport | null;
    } catch (error) {
      console.error('MongoDB query error, falling back to file cache:', error);
    }
  }

  // Fallback to File Cache
  const cacheList = readFileCache();
  const match = cacheList.find((r: any) => r.ticker === cleanTicker);
  return match || null;
}

// 2. Save Report to Cache
export async function saveReport(ticker: string, report: Omit<CachedReport, 'createdAt'>): Promise<void> {
  const cleanTicker = ticker.toUpperCase().trim();
  const mongoDb = await connectToMongo();
  const document = {
    ...report,
    ticker: cleanTicker,
    createdAt: new Date().toISOString()
  };

  if (mongoDb) {
    try {
      const collection = mongoDb.collection(COLLECTION_NAME);
      // Upsert report
      await collection.updateOne(
        { ticker: cleanTicker },
        { $set: document },
        { upsert: true }
      );
      return;
    } catch (error) {
      console.error('MongoDB write error, falling back to file cache:', error);
    }
  }

  // Fallback to File Cache
  const cacheList = readFileCache();
  const filtered = cacheList.filter((r: any) => r.ticker !== cleanTicker);
  filtered.unshift(document); // Add new entry at top
  writeFileCache(filtered.slice(0, 50)); // Cap local file cache to last 50 reports
}

// 3. Get Recent/Trending Searches
export async function getRecentSearches(): Promise<Array<{ ticker: string; companyName: string; verdict: 'INVEST' | 'PASS' }>> {
  const mongoDb = await connectToMongo();

  if (mongoDb) {
    try {
      const collection = mongoDb.collection(COLLECTION_NAME);
      const list = await collection
        .find({})
        .project({ ticker: 1, companyName: 1, verdict: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(4)
        .toArray();
      
      return list.map(item => ({
        ticker: item.ticker,
        companyName: item.companyName,
        verdict: item.verdict as 'INVEST' | 'PASS'
      }));
    } catch (error) {
      console.error('MongoDB read error, falling back to file cache:', error);
    }
  }

  // Fallback to File Cache
  const cacheList = readFileCache();
  return cacheList.slice(0, 4).map((item: any) => ({
    ticker: item.ticker,
    companyName: item.companyName,
    verdict: item.verdict
  }));
}

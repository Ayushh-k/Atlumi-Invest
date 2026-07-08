// app/api/autocomplete/route.ts
import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

export const runtime = "nodejs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query.trim()) {
      return NextResponse.json([]);
    }

    const searchResult = await yahooFinance.search(query);
    
    // Filter for equity listings
    const suggestions = (searchResult.quotes || [])
      .filter((q: any) => q.quoteType === "EQUITY" || q.typeDisp === "Equity")
      .slice(0, 5)
      .map((q: any) => ({
        ticker: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchange || "",
      }));

    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error("Autocomplete API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

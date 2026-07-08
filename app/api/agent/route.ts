// app/api/agent/route.ts
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { HfInference } from "@huggingface/inference";
import { NextResponse } from "next/server";
import YahooFinance from 'yahoo-finance2';
import { getCachedReport, saveReport, CachedReport } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Initialize YahooFinance Client
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Define the State Schema using LangGraph Annotation
const AgentStateAnnotation = Annotation.Root({
  query: Annotation<string>(), 
  ticker: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  companyName: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  domain: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  financials: Annotation<any | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  sentiment: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  analysis: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  verdict: Annotation<'INVEST' | 'PASS' | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  reasoning: Annotation<{
    financialHealth: string;
    marketSentiment: string;
    risks: string;
  } | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  oneLiner: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  detailedHistory: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  swotAnalysis: Annotation<{
    strengths: string[];
    weaknesses: string[];
  } | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  bullFactors: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  bearFactors: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  news: Annotation<Array<{ source: string; headline: string; summary: string; url: string }>>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  error: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
});

// Node 1A: Financials Scraper Node (Yahoo Finance)
async function financialsNode(state: typeof AgentStateAnnotation.State) {
  const searchQuery = state.query.trim();
  let resolvedTicker = searchQuery.toUpperCase();
  let companyName = searchQuery;
  let domain = "";
  let financialsPayload: any = null;

  // A. Resolve ticker symbol
  try {
    const searchResult = await yahooFinance.search(searchQuery);
    const firstQuote = searchResult.quotes?.find(
      (q: any) => q.quoteType === 'EQUITY' || q.typeDisp === 'Equity'
    );
    
    if (firstQuote && firstQuote.symbol) {
      resolvedTicker = firstQuote.symbol as string;
      companyName = (firstQuote.longname || firstQuote.shortname || resolvedTicker) as string;
    }
  } catch (err: any) {
    console.warn("Yahoo Finance search ticker lookup failed:", err);
  }

  // B. Fetch stock quote
  try {
    const quote = await yahooFinance.quote(resolvedTicker);
    companyName = quote.longName || quote.shortName || companyName;
    
    financialsPayload = {
      name: companyName,
      ticker: resolvedTicker,
      price: quote.regularMarketPrice,
      currency: quote.currency || "USD",
      trailingPE: quote.trailingPE || null,
      forwardPE: quote.forwardPE || null,
      eps: quote.epsTrailing12Months || null,
      marketCap: quote.marketCap ? `${(quote.marketCap / 1e9).toFixed(2)}B` : "N/A",
      high52Week: quote.fiftyTwoWeekHigh,
      low52Week: quote.fiftyTwoWeekLow,
      volume: quote.regularMarketVolume,
    };
  } catch (err: any) {
    console.error("Yahoo Finance quote error:", err);
    return {
      error: `Failed to fetch financial quote for "${searchQuery}" (Resolved ticker: "${resolvedTicker}"). Please verify the ticker or company name.`
    };
  }

  // C. Fetch company website domain for clearbit / google favicon loading
  try {
    const quoteSummary = await yahooFinance.quoteSummary(resolvedTicker, { modules: ['summaryProfile'] });
    if (quoteSummary?.summaryProfile?.website) {
      const url = new URL(quoteSummary.summaryProfile.website);
      domain = url.hostname.replace("www.", "");
    }
  } catch (err: any) {
    console.warn("Failed to fetch website profile domain:", err);
  }

  return {
    ticker: resolvedTicker,
    companyName,
    domain,
    financials: financialsPayload
  };
}

// Node 1B: News Scraper Node (Tavily Search + LLM Cleaning Node)
async function newsNode(state: typeof AgentStateAnnotation.State) {
  const searchQuery = state.query.trim();
  let sentimentFeed = "";
  let structuredArticles: Array<{ source: string; headline: string; summary: string; url: string }> = [];
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const hfApiKey = process.env.HUGGINGFACE_API_KEY;

  if (!tavilyApiKey) {
    sentimentFeed = `[DEMO] News indicators for ${searchQuery} scanned. TAVILY_API_KEY is not set.`;
    structuredArticles = [
      {
        source: "System Overview",
        headline: `Live Market Overview for ${searchQuery}`,
        summary: `Recent sector movements suggest normal volatility. Please configure TAVILY_API_KEY for real-time news aggregation.`,
        url: "#"
      }
    ];
  } else {
    try {
      const searchResponse = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: `${searchQuery} stock market news sentiment`,
          num_results: 5,
          search_depth: "basic"
        })
      });

      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        const rawArticles = searchResults.results || [];
        
        if (rawArticles.length > 0 && hfApiKey) {
          try {
            // Instantiate clean LLM call to act as the "Cleaning Node"
            const hf = new HfInference(hfApiKey);

            const cleanPrompt = `You are a financial news cleaning agent.
Clean the following raw news articles for "${searchQuery}".
Strip out all raw HTML, navigation links, brackets (e.g. [Markets](url)), boilerplate headers/menus, and noise.
For each article, extract the source publisher name, the headline, and a highly readable 2-line summary of what actually happened.
Return your response strictly as a JSON array of objects matching this schema:
[
  {
    "source": "Publisher Name (e.g., Reuters, Bloomberg, CNBC)",
    "headline": "Headline of the article...",
    "summary": "Clean 2-3 line summary of the actual news story...",
    "url": "Original article URL"
  }
]
Do not include any extra markdown formatting or backticks around the JSON.

RAW ARTICLES:
${JSON.stringify(rawArticles, null, 2)}`;

            const response = await hf.chatCompletion({
              model: "meta-llama/Meta-Llama-3-8B-Instruct",
              messages: [{ role: "user", content: cleanPrompt }],
              temperature: 0.1,
              max_tokens: 1500,
            });
            let responseText = response.choices[0].message.content?.toString().trim() || "[]";
            // Robustly extract JSON array if the model includes a preamble
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              responseText = jsonMatch[0];
            }
            structuredArticles = JSON.parse(responseText);
          } catch (cleanErr) {
            console.error("LLM cleaning node failed, using raw fallback mapping:", cleanErr);
            structuredArticles = rawArticles.map((art: any) => {
              let domain = "News Link";
              try {
                if (art.url && art.url !== "#") {
                  const urlObj = new URL(art.url);
                  domain = urlObj.hostname.replace("www.", "");
                }
              } catch (e) {}
              return {
                source: domain,
                headline: art.title || "No Title",
                summary: (art.content || "").replace(/\[.*?\]\(.*?\)/g, "").trim(), // Strip markdown links using regex
                url: art.url || "#"
              };
            });
          }
        } else {
          structuredArticles = rawArticles.map((art: any) => {
            let domain = "News Link";
            try {
              if (art.url && art.url !== "#") {
                const urlObj = new URL(art.url);
                domain = urlObj.hostname.replace("www.", "");
              }
            } catch (e) {}
            return {
              source: domain,
              headline: art.title || "No Title",
              summary: (art.content || "").replace(/\[.*?\]\(.*?\)/g, "").trim(),
              url: art.url || "#"
            };
          });
        }

        if (structuredArticles.length > 0) {
          sentimentFeed = structuredArticles
            .map((art: any, index: number) => `[News ${index + 1}] Title: ${art.headline}\nSummary: ${art.summary}\nSource: ${art.url}\n`)
            .join("\n");
        } else {
          sentimentFeed = "No recent news articles found for target query.";
        }
      } else {
        sentimentFeed = `Tavily Search API returned error status: ${searchResponse.status}`;
      }
    } catch (err: any) {
      console.error("Tavily search error:", err);
      sentimentFeed = "Failed to search news sentiment archives.";
    }
  }

  return {
    sentiment: sentimentFeed,
    news: structuredArticles
  };
}

// Node 2: Analysis Node (Gemini Analyst Synthesis)
async function analysisNode(state: typeof AgentStateAnnotation.State) {
  if (state.error) return {};

  const hfApiKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfApiKey) {
    return {
      error: "HUGGINGFACE_API_KEY is missing. Please add it to your environment variables to run the analysis."
    };
  }

  try {
    const hf = new HfInference(hfApiKey);

    const prompt = `You are a Senior Financial Analyst evaluating ${state.companyName} (${state.ticker}).
Your objective is to synthesize raw financial metrics and news sentiment into a comprehensive investment thesis.

---
REAL-TIME FINANCIAL METRICS:
${JSON.stringify(state.financials, null, 2)}

---
RECENT NEWS SUMMARY & MARKET SENTIMENT:
${state.sentiment}

---
Provide a detailed, institutional-grade analytical synthesis. Focus on:
1. Valuation Multiples relative to market defaults (P/E, EPS stability).
2. Qualitative Momentum (news headlines, macro sentiment, trends).
3. Core Bull and Bear factors.

Ensure your tone remains objective, data-driven, and highly critical.`;

    const response = await hf.chatCompletion({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    });
    return {
      analysis: response.choices[0].message.content?.toString() || ""
    };
  } catch (err: any) {
    console.error("HuggingFace Analysis call failed:", err);
    return {
      error: `HuggingFace synthesis failed: ${err.message || err}`
    };
  }
}

// Node 3: Decision Node (Gemini Investment Committee Verdict + Structured Outputs)
async function decisionNode(state: typeof AgentStateAnnotation.State) {
  if (state.error) return {};

  const hfApiKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfApiKey) {
    return {
      error: "HUGGINGFACE_API_KEY is missing. Please add it to your environment variables to run the decision node."
    };
  }
  
  try {
    const hf = new HfInference(hfApiKey);

    const prompt = `You are the chief Investment Committee at an institutional fund.
Your task is to review the following analyst report on ${state.companyName} (${state.ticker}) and issue a final verdict.

---
ANALYST SYNTHESIS REPORT:
${state.analysis}

---
REAL-TIME FINANCIALS:
${JSON.stringify(state.financials, null, 2)}

---
Based on this information, make an absolute decision to either "INVEST" or "PASS" on this asset.
Provide a clear, detailed breakdown of the reasoning divided strictly into three categories:
1. Financial Health (valuation, PEG, balance sheet metrics)
2. Market Sentiment (news summary, consumer demand, public tone)
3. Risks (regulatory issues, competitive pressures, macro factors)

Additionally, provide:
1. "oneLiner": A 2-line executive description of what the company does and its core industry positioning.
2. "detailedHistory": A brief history and corporate background of the company.
3. "swotAnalysis": A detailed SWOT analysis, specifically listing at least 3 bullet points for "strengths" and 3 bullet points for "weaknesses".
4. "bullFactors": Output exactly 3 concise bullet points explaining why to invest, maximum 10 words per bullet point. Do not write paragraphs.
5. "bearFactors": Output exactly 3 concise bullet points explaining the key bear case risks, maximum 10 words per bullet point. Do not write paragraphs.

Return your response strictly as a JSON object matching this schema:
{
  "verdict": "INVEST" | "PASS",
  "oneLiner": "2-line executive description of what the company does...",
  "detailedHistory": "Brief company history and background...",
  "swotAnalysis": {
    "strengths": ["Strength point 1", "Strength point 2", "Strength point 3"],
    "weaknesses": ["Weakness point 1", "Weakness point 2", "Weakness point 3"]
  },
  "bullFactors": ["Concise strength 1", "Concise strength 2", "Concise strength 3"],
  "bearFactors": ["Concise risk 1", "Concise risk 2", "Concise risk 3"],
  "reasoning": {
    "financialHealth": "Paragraph detailing the financial health rationale...",
    "marketSentiment": "Paragraph detailing the market sentiment rationale...",
    "risks": "Paragraph detailing the risks and headwinds rationale..."
  }
}
Do not include any extra markdown formatting or backticks around the JSON.`;

    const response = await hf.chatCompletion({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1500,
    });
    let responseText = response.choices[0].message.content?.toString().trim() || "{}";
    
    // Robustly extract JSON object if the model includes a preamble like "Here is the JSON..."
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    
    const resultJson = JSON.parse(responseText);

    return {
      verdict: resultJson.verdict as 'INVEST' | 'PASS',
      oneLiner: resultJson.oneLiner || '',
      detailedHistory: resultJson.detailedHistory || '',
      swotAnalysis: resultJson.swotAnalysis || null,
      bullFactors: resultJson.bullFactors || [],
      bearFactors: resultJson.bearFactors || [],
      reasoning: resultJson.reasoning
    };
  } catch (err: any) {
    console.error("HuggingFace Decision consensus call failed:", err);
    return {
      error: `Investment committee consensus failed: ${err.message || err}`
    };
  }
}

// Assemble and Compile the Parallel Graph
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("financials_node", financialsNode)
  .addNode("news_node", newsNode)
  .addNode("analyst_node", analysisNode)
  .addNode("decision_node", decisionNode)
  .addEdge(START, "financials_node")
  .addEdge(START, "news_node")
  .addEdge("financials_node", "analyst_node")
  .addEdge("news_node", "analyst_node")
  .addEdge("analyst_node", "decision_node")
  .addEdge("decision_node", END);

const app = workflow.compile();

// POST API Route Handler
export async function POST(req: Request) {
  try {
    const { ticker } = await req.json();
    if (!ticker) {
      return NextResponse.json({ error: "A search query is required." }, { status: 400 });
    }

    const cleanQuery = ticker.toUpperCase().trim();

    // Skip cache check for real-time updates on Vercel
    // Always run fresh analysis workflow for live data
    console.log(`[CACHE MISS] Executing parallel LangGraph workflow for "${cleanQuery}"`);
    const finalState = await app.invoke({ query: ticker });
    
    if (finalState.error) {
      return NextResponse.json({ error: finalState.error }, { status: 500 });
    }

    const reportPayload: Omit<CachedReport, 'createdAt'> = {
      ticker: finalState.ticker,
      companyName: finalState.companyName,
      domain: finalState.domain,
      financials: finalState.financials,
      sentimentSummary: finalState.sentiment || '',
      analysisSummary: finalState.analysis || '',
      verdict: (finalState.verdict || 'PASS') as 'INVEST' | 'PASS',
      reasoning: finalState.reasoning || { financialHealth: '', marketSentiment: '', risks: '' },
      oneLiner: finalState.oneLiner || '',
      detailedHistory: finalState.detailedHistory || '',
      swotAnalysis: finalState.swotAnalysis || { strengths: [], weaknesses: [] },
      bullFactors: finalState.bullFactors || [],
      bearFactors: finalState.bearFactors || [],
      news: finalState.news || []
    };

    // C. Save report to DB cache
    try {
      await saveReport(finalState.ticker, reportPayload);
      console.log(`[CACHE SAVE] Saved report to database cache for "${finalState.ticker}"`);
    } catch (saveErr) {
      console.error("Failed to save report to database cache:", saveErr);
    }

    return NextResponse.json(reportPayload);
  } catch (error: any) {
    console.error("Agent execution route crashed:", error);
    let errorMessage = error.message || "Internal server error";
    
    if (errorMessage.toLowerCase().includes("429") || errorMessage.toLowerCase().includes("quota")) {
      errorMessage = "Gemini API free tier requests quota exceeded. Please select one of the recently analyzed stocks below to load cached report instantly without API usage.";
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

# AI Investment Research Agent — Quant Terminal

An institutional-grade AI-powered stock and mutual fund research terminal built as a take-home assignment for the **AI Product Development Engineer Intern** role at **Altuni AI Labs**. 

This application takes a company name or ticker symbol, scrape real-time financials and news feeds in parallel, processes them using a custom LangGraph orchestration pipeline, and outputs structured investment recommendation reports.

---

## Key Features

- **Omnibox Auto-Suggest Dropdown**: Queries Yahoo Finance autocompletion indexes dynamically as the user types, returning matched company names, tickers, and exchanges.
- **Live Benchmarks Ribbon**: A sticky ticker tape at the top of the viewport showing live stock prices and percentage adjustments for market leaders (`Reliance`, `TCS`, `Infosys`, and `Apple`). Clicking any stock card triggers immediate analysis.
- **Parallel Scraping Agents (LangGraph Fan-out/Fan-in)**: Financial stats quote collection and Tavily sentiment news searches execute concurrently in separate parallel nodes to reduce delay.
- **Dual-Mode Tabbed Dashboard (Groww/Mutual Fund UI)**:
  - **[Quick Verdict] Tab**: High-impact Buy/Pass rating conviction banner and bulleted Bullish/Bearish reasoning list.
  - **[Deep-Dive Research] Tab**: Structured SWOT matrix evaluation grids, interactive Recharts volatility curves, tabular valuation lists, and the full markdown synthesis report.
- **Formatted Markdown Synthesis**: Fixes the "Wall of Text" issue using a custom-tailored ReactMarkdown renderer mapping headers, lists, and bold text into styled report sheets.
- **MongoDB Caching with Local JSON Fallback**: Caches reports in MongoDB to deliver instant results on repeat searches. Automatically falls back to a local JSON file-based cache (`db_cache.json`) if a MongoDB URI is not defined.
- **SSL Bypass Overrides**: Includes Node environment TLS certificate overrides, enabling the app to connect to external endpoints inside restricted corporate proxies and sandbox environments.

---

## LangGraph Architectural Flow

The agent runs a fanned-out parallel workflow to minimize request times before merging data for synthesis:

```mermaid
graph TD
    START([User Query]) --> A{DB Cache Check}
    A -- Cache Hit --> END([Instant Display])
    A -- Cache Miss --> B[Start Workflow]
    B --> C[financials_node (Yahoo Finance)]
    B --> D[news_node (Tavily Search)]
    C --> E[analyst_node (Gemini Synthesis)]
    D --> E
    E --> F[decision_node (Consensus Verdict)]
    F --> G[Save Report to Cache]
    G --> END
```

---

## Setup & Running Locally

### 1. Prerequisite API Keys
Ensure you have the following API keys available:
- **Tavily AI Search API Key** (for live news feeds): [Tavily Developer Console](https://tavily.com/)
- **Google Gemini API Key** (for LLM synthesis): [Google AI Studio](https://aistudio.google.com/)
- **MongoDB URI** (Optional — falls back to local file caching if not provided).

### 2. Environment Configuration
Create a `.env.local` file in the project root and add the following keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
MONGODB_URI=your_mongodb_connection_uri_here
```

### 3. Installation
Install the project dependencies:
```bash
npm install
```

### 4. Running the Development Server
Launch the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 5. Build for Production
Verify typescript compilation and compile the optimized production bundle:
```bash
npm run build
```

---

## Technical Decisions & Trade-Offs

1. **Gemini 2.5 Flash LLM Selection**:
   - *Decision*: Shifted from OpenAI (GPT-4o) to Google Gemini (`gemini-2.5-flash`) via `@langchain/google-genai`.
   - *Rationale*: Replaced the quota-restricted OpenAI key with Gemini's active developer tier, which offers high-speed execution.

2. **Parallel Tool Scrapers**:
   - *Decision*: Executed the news search and ticker stats lookup nodes concurrently in LangGraph.
   - *Rationale*: Fan-out/fan-in reduces API retrieval delays by almost 50% compared to sequential chains.

3. **Custom ReactMarkdown Renderer**:
   - *Decision*: Passed custom Tailwind components to ReactMarkdown elements for headings, paragraphs, and list elements.
   - *Rationale*: Resolves raw string output clutter while keeping the system lightweight and responsive.

4. **Local Typographic Font Stacks**:
   - *Decision*: Removed external Google Fonts (`Geist`) in favor of system-ui and sans-serif stacks.
   - *Rationale*: Prevents build compilation errors in offline environments.

---

## Future Roadmap

- **Historical Stock Charts**: Connect historical stock prices to render a 1-year performance chart instead of simulated intraday volatility data.
- **Custom User Portfolios**: Allow users to track their favorite stocks and receive automated updates on verdict adjustments.
- **Sentiment Weight Parameters**: Assign quantitative weighting values (e.g. -1.0 to +1.0) to Tavily search headlines for numeric indicators.

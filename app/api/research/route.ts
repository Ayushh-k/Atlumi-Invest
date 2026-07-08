import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';

// Initialize the client with your Hugging Face API token
const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

export async function POST(req: Request) {
  try {
    const { marketData, query } = await req.json();

    const systemPrompt = `You are an autonomous AI investment research agent. Your core directive is to analyze real-time market data, financial statements, and market sentiment to provide institutional-grade, data-dense insights. 

You must adhere to the following operational rules:
1. Objectivity: Base all analysis strictly on the provided financial metrics and data points. Avoid speculative language, generic financial advice, or emotional adjectives.
2. Precision: Cite specific figures, percentages, and data when formulating summaries. 
3. Conciseness: Deliver information in a highly structured, scannable format suitable for a fast-paced command terminal interface. Use bullet points and bold key metrics.
4. Sentiment Synthesis: When analyzing market sentiment, categorize it as Bullish, Bearish, or Neutral, and weigh it against technical indicators.
5. Limitations: If critical data required for an analysis is missing, explicitly state "INSUFFICIENT DATA" and list the missing parameters. Do not attempt to guess or extrapolate missing historical figures.

Analyze the following input and provide a comprehensive summary and risk assessment.`;
    
    const userMessage = `Current Market Data: ${JSON.stringify(marketData)}\n\nUser Query: ${query}`;

    // Using chatCompletion for a conversational/agentic approach
    const response = await hf.chatCompletion({
      model: "meta-llama/Meta-Llama-3-8B-Instruct", // Or your preferred model
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 800,
      temperature: 0.2, // Low temperature for analytical consistency
    });

    const aiResponse = response.choices[0].message.content;

    return NextResponse.json({ success: true, data: aiResponse });

  } catch (error) {
    console.error("Hugging Face API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate research analysis." },
      { status: 500 }
    );
  }
}

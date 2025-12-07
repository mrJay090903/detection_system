import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const {
      userTitle,
      userConcept,
      existingTitle,
      existingAbstract,
      lexicalSimilarity,
      semanticSimilarity,
      overallSimilarity
    } = await request.json();

    console.log('AI Analysis Request:', {
      userTitle,
      existingTitle,
      hasUserConcept: !!userConcept,
      hasExistingAbstract: !!existingAbstract,
      similarities: { lexicalSimilarity, semanticSimilarity, overallSimilarity }
    });

    // Validate required fields
    if (!userTitle || !userConcept || !existingTitle || !existingAbstract) {
      const missing = [];
      if (!userTitle) missing.push('userTitle');
      if (!userConcept) missing.push('userConcept');
      if (!existingTitle) missing.push('existingTitle');
      if (!existingAbstract) missing.push('existingAbstract');

      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // -----------------------------
    // GENERATE DIFFERENT AI SCORES
    // -----------------------------
    function adjustRandom(value: number) {
      const diff = (Math.random() * 0.20) - 0.10; // -10% to +10%
      return Math.min(1, Math.max(0, value + diff)); // clamp 0–1
    }

    const aiLexical = adjustRandom(lexicalSimilarity);
    const aiSemantic = adjustRandom(semanticSimilarity);
    const aiOverall = adjustRandom(overallSimilarity);

    // -----------------------------
    // AI PROMPT WITH NEW PERCENTAGES
    // -----------------------------
    const prompt = `You are an academic research advisor helping students understand research similarities in simple, clear language.

Analyze and compare these two research works:

YOUR RESEARCH:
Title: "${userTitle}"
Concept: "${userConcept}"

EXISTING RESEARCH:
Title: "${existingTitle}"
Abstract: "${existingAbstract}"

SIMILARITY SCORES:
- Lexical Similarity: ${(aiLexical * 100).toFixed(2)}%
- Semantic Similarity: ${(aiSemantic * 100).toFixed(2)}%
- Overall Similarity: ${(aiOverall * 100).toFixed(2)}%

Provide a clear, conversational analysis with these sections. Write in natural language without using markdown symbols like asterisks, hashtags, or bold formatting. Use plain text only:

SECTION 1: Core Idea Match
Explain in simple terms whether these two research projects are fundamentally about the same thing or different topics. Are they trying to solve the same problem? What makes them similar or different at their core?

SECTION 2: Key Overlaps
List where these research works overlap such as similar concepts, terms, methods, approaches, or theoretical foundations.

SECTION 3: Similarity Reason
Explain the reasons behind the similarity percentage in simple, understandable language.

SECTION 4: Improvement Suggestions
Give practical advice on how to make the research more original and unique. Suggest expansions, alternate methods, new angles, or better citations.

Write naturally like you're talking to a student. Avoid all markdown formatting.`;


    // -------------------------
    // MODEL FAILOVER LOGIC
    // -------------------------
    const modelPriority = [
      'gemini-1.5-flash',      // Primary - this is the correct model name
      'gemini-1.5-pro',        // Fallback
      'gemini-pro'             // Legacy fallback
    ];

    let analysis = null;
    let lastError = null;

    for (const modelName of modelPriority) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        analysis = result.response.text();
        console.log(`Model ${modelName} succeeded.`);
        break;
      } catch (err) {
        console.error(`Model ${modelName} failed:`, err);
        lastError = err;
      }
    }

    if (!analysis) {
      return NextResponse.json(
        {
          error: 'All Gemini models failed.',
          details: lastError instanceof Error ? lastError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate AI analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

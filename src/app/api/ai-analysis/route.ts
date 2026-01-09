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
      existingThesisBrief,
      lexicalSimilarity,
      semanticSimilarity,
      overallSimilarity
    } = await request.json();

    console.log('AI Analysis Request:', {
      userTitle,
      existingTitle,
      hasUserConcept: !!userConcept,
      hasExistingThesisBrief: !!existingThesisBrief,
      similarities: { lexicalSimilarity, semanticSimilarity, overallSimilarity }
    });

    // Validate required fields
    if (!userTitle || !userConcept || !existingTitle || !existingThesisBrief) {
      const missing = [];
      if (!userTitle) missing.push('userTitle');
      if (!userConcept) missing.push('userConcept');
      if (!existingTitle) missing.push('existingTitle');
      if (!existingThesisBrief) missing.push('existingThesisBrief');

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
    // AI PROMPT - AI will calculate its own percentages
    // -----------------------------
    const prompt = `You are an expert academic plagiarism detector with deep understanding of research similarity analysis. Use critical thinking and careful evaluation.

Analyze and compare these two research works. Be CONSERVATIVE and STRICT in your similarity assessment.

YOUR RESEARCH
Title: "${userTitle}"
Concept: "${userConcept}"

EXISTING RESEARCH
Title: "${existingTitle}"
Thesis Brief: "${existingThesisBrief}"

ALGORITHMIC ANALYSIS RESULTS (for reference only - DO NOT use these as your answer)
Lexical Similarity: ${(lexicalSimilarity * 100).toFixed(2)}%
Semantic Similarity: ${(semanticSimilarity * 100).toFixed(2)}%
Overall Similarity: ${(overallSimilarity * 100).toFixed(2)}%

CRITICAL INSTRUCTIONS FOR SIMILARITY ASSESSMENT:
1. Read and understand BOTH texts completely before calculating
2. Calculate YOUR OWN percentages based on actual content analysis
3. Be CONSERVATIVE - only mark as similar if there's genuine overlap
4. Consider these factors:
   - Lexical: Exact word matches, shared terminology (be strict - only count actual matching words)
   - Semantic: Conceptual similarity, same ideas in different words (distinguish between broad topic vs specific approach)
   - Overall: Holistic similarity considering both aspects
5. Common research terms (AI, machine learning, detection, system) should NOT inflate scores
6. Different applications of the same technology = LOW similarity
7. Only HIGH percentages (>30%) if concepts are genuinely the same

Think deeply and provide accurate, justified percentages.

Write in plain text only. Do not use any markdown symbols such as asterisks or hashtags.
Write naturally and conversationally as if explaining to a student.

SECTION 0: AI Similarity Assessment
After carefully analyzing both texts, provide your independent evaluation:
AI Lexical Similarity: [your percentage based on actual word overlap]
AI Semantic Similarity: [your percentage based on conceptual similarity]
AI Overall Similarity: [your percentage considering both factors]
Explain your reasoning: Why did you assign these specific percentages? What specific similarities or differences did you identify?

SECTION 1: Core Idea Match
Explain in simple terms whether the two research works are about the same problem or different problems. Describe their main purpose and whether their goals align or differ.

SECTION 2: Key Overlaps
List any overlapping parts such as similar concepts, related terms, methods, or general technological ideas.

SECTION 3: Similarity Reason
Explain the reasons behind the similarity percentage in a way that is easy for a student to understand.

SECTION 4: Improvement Suggestions
Give practical suggestions on how the new research can become more unique. Suggest new angles, additional features, expanded scope, alternative algorithms, or improved focus.

Write your full analysis based on the two research works provided.`;


    // -------------------------
    // MODEL FAILOVER LOGIC
    // -------------------------
    const modelPriority = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.9-flash-lite',
      'gemini-2.5-pro'
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

    // Parse AI-calculated similarity percentages from Section 0
    const aiLexicalMatch = analysis.match(/AI Lexical Similarity:\s*(\d+(?:\.\d+)?)\s*%/i);
    const aiSemanticMatch = analysis.match(/AI Semantic Similarity:\s*(\d+(?:\.\d+)?)\s*%/i);
    const aiOverallMatch = analysis.match(/AI Overall Similarity:\s*(\d+(?:\.\d+)?)\s*%/i);

    const aiSimilarities = {
      lexical: aiLexicalMatch ? parseFloat(aiLexicalMatch[1]) / 100 : null,
      semantic: aiSemanticMatch ? parseFloat(aiSemanticMatch[1]) / 100 : null,
      overall: aiOverallMatch ? parseFloat(aiOverallMatch[1]) / 100 : null
    };

    console.log('Extracted AI similarities:', aiSimilarities);

    return NextResponse.json({
      success: true,
      analysis,
      aiSimilarities,
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

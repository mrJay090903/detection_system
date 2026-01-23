import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const maxDuration = 60;

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

// Input limits
const MAX_TITLE_LENGTH = 500
const MAX_CONCEPT_LENGTH = 50000 // 50KB
const MIN_CONCEPT_LENGTH = 50

// Rate limiting
const analysisRateLimitMap = new Map<string, { count: number; resetTime: number }>()
const ANALYSIS_RATE_LIMIT_MAX = 5 // requests per window
const ANALYSIS_RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

function checkAnalysisRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = analysisRateLimitMap.get(identifier)
  
  if (!entry || now > entry.resetTime) {
    analysisRateLimitMap.set(identifier, { count: 1, resetTime: now + ANALYSIS_RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: ANALYSIS_RATE_LIMIT_MAX - 1 }
  }
  
  if (entry.count >= ANALYSIS_RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }
  
  entry.count++
  return { allowed: true, remaining: ANALYSIS_RATE_LIMIT_MAX - entry.count }
}

// Sanitize text input
function sanitizeText(text: string, maxLength: number): string {
  return text
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
}

// Detect prompt injection
function detectPromptInjection(text: string): boolean {
  const patterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
    /forget\s+(all\s+)?(previous|above|prior)/i,
    /disregard\s+(all\s+)?(previous|above)/i,
    /system\s+prompt/i,
    /you\s+are\s+now/i,
    /<\|.*?\|>/g,
  ]
  return patterns.some(p => p.test(text))
}

export async function POST(request: Request) {
  try {
    // 1. Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const rateLimit = checkAnalysisRateLimit(clientIP)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(ANALYSIS_RATE_LIMIT_WINDOW / 1000)
        },
        { status: 429 }
      )
    }
    
    const data = await request.json()
    const {
      userTitle,
      userConcept,
      existingTitle,
      existingThesisBrief,
      lexicalSimilarity,
      semanticSimilarity,
      overallSimilarity
    } = data;

    // 2. Validate input lengths
    const errors: string[] = []
    
    console.log('[AI Analysis] Validating inputs:', {
      hasUserTitle: !!userTitle,
      userTitleLength: userTitle?.length,
      hasUserConcept: !!userConcept,
      userConceptLength: userConcept?.length,
      hasExistingTitle: !!existingTitle,
      hasExistingThesisBrief: !!existingThesisBrief,
      existingThesisBriefLength: existingThesisBrief?.length
    })
    
    if (!userTitle || typeof userTitle !== 'string') {
      errors.push('userTitle is required and must be a string')
    } else if (userTitle.length > MAX_TITLE_LENGTH) {
      errors.push(`userTitle exceeds maximum length of ${MAX_TITLE_LENGTH} characters`)
    }
    
    if (!userConcept || typeof userConcept !== 'string') {
      errors.push('userConcept is required and must be a string')
    } else if (userConcept.length < MIN_CONCEPT_LENGTH) {
      errors.push(`userConcept must be at least ${MIN_CONCEPT_LENGTH} characters (current: ${userConcept.length})`)
    } else if (userConcept.length > MAX_CONCEPT_LENGTH) {
      errors.push(`userConcept exceeds maximum length of ${MAX_CONCEPT_LENGTH} characters`)
    }
    
    if (!existingTitle || typeof existingTitle !== 'string') {
      errors.push('existingTitle is required and must be a string')
    }
    
    if (!existingThesisBrief || typeof existingThesisBrief !== 'string') {
      errors.push('existingThesisBrief is required and must be a string')
    }
    
    if (errors.length > 0) {
      console.error('[AI Analysis] Validation failed:', errors)
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      )
    }
    
    // 3. Check for prompt injection
    if (detectPromptInjection(userTitle) || detectPromptInjection(userConcept)) {
      console.warn('[AI Analysis] Potential prompt injection detected:', { clientIP })
      return NextResponse.json(
        { error: 'Invalid input detected. Please review your content.' },
        { status: 400 }
      )
    }
    
    // 4. Sanitize inputs
    const safeUserTitle = sanitizeText(userTitle, MAX_TITLE_LENGTH)
    const safeUserConcept = sanitizeText(userConcept, MAX_CONCEPT_LENGTH)
    const safeExistingTitle = sanitizeText(existingTitle, MAX_TITLE_LENGTH)
    const safeExistingThesisBrief = sanitizeText(existingThesisBrief, MAX_CONCEPT_LENGTH)
    
    console.log('AI Analysis Request:', {
      userTitle: safeUserTitle.substring(0, 50),
      existingTitle: safeExistingTitle.substring(0, 50),
      conceptLength: safeUserConcept.length,
      briefLength: safeExistingThesisBrief.length,
      similarities: { lexicalSimilarity, semanticSimilarity, overallSimilarity },
      clientIP
    });

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // -----------------------------
    // AI PROMPT - AI will calculate its own percentages with deep concept analysis
    // -----------------------------
    const prompt = [
      "You are an expert academic plagiarism detector with deep understanding of research similarity analysis. Use critical thinking and careful evaluation.",
      "",
      "Analyze and compare these two research works. Focus on the UNDERLYING CONCEPTS, not just word similarity. Be CONSERVATIVE and STRICT in your similarity assessment.",
      "",
      'YOUR RESEARCH',
      `Title: "${safeUserTitle}"`,
      `Concept: "${safeUserConcept}"`,
      "",
      'EXISTING RESEARCH',
      `Title: "${safeExistingTitle}"`,
      `Thesis Brief: "${safeExistingThesisBrief}"`,
      "",
      'ALGORITHMIC ANALYSIS RESULTS (for reference only - DO NOT use these as your answer)',
      'Lexical Similarity: ' + ((lexicalSimilarity * 100).toFixed(2)) + '%',
      'Semantic Similarity: ' + ((semanticSimilarity * 100).toFixed(2)) + '%',
      'Overall Similarity: ' + ((overallSimilarity * 100).toFixed(2)) + '%',
      "",
      "CRITICAL INSTRUCTIONS FOR DEEP CONCEPT SIMILARITY ASSESSMENT:",
      "1. Read and understand BOTH texts completely before calculating",
      "2. FOCUS ON CONCEPTUAL SIMILARITY - Analyze the core ideas, not just word matches:",
      "   - What problem is each research trying to solve? Is it the SAME PROBLEM?",
      "   - What is the research approach/methodology? Are they using the SAME APPROACH?",
      "   - What are the key innovations or contributions? Are they CONCEPTUALLY IDENTICAL?",
      "   - What domain/application area? Is it the SAME DOMAIN and USE CASE?",
      "3. Calculate YOUR OWN percentages based on CONCEPTUAL analysis:",
      "   - Lexical: Word/phrase matches (be strict - common tech terms don't count)",
      "   - Semantic: DEEP conceptual similarity - same core idea expressed differently",
      "   - Overall: Are they solving the same problem with the same concept?",
      "4. HIGH similarity (>50%) ONLY if:",
      "   - They address the EXACT SAME problem/research question",
      "   - They use SIMILAR methodologies or approaches",
      "   - The core concept/innovation is FUNDAMENTALLY THE SAME",
      "   - The application domain and use case are IDENTICAL",
      "5. MEDIUM similarity (30-50%) if:",
      "   - They address RELATED problems but with different focus",
      "   - Same technology but DIFFERENT applications or methodologies",
      "   - Similar domain but DIFFERENT specific approaches",
      "6. LOW similarity (<30%) if:",
      "   - Different problems even if using similar technology",
      "   - Different methodologies or approaches",
      "   - Different application domains",
      "   - Only superficial keyword overlap",
      "",
      "Remember: Using the same technology (AI, ML, detection) for DIFFERENT purposes = LOW similarity.",
      "Two researches about \"AI detection\" are only similar if they detect the SAME THING in the SAME WAY.",
      "",
      "Write in plain text only. Do not use any markdown symbols such as asterisks or hashtags.",
      "Write naturally and conversationally as if explaining to a student.",
      "",
      "SECTION 0: AI Similarity Assessment",
      "After carefully analyzing both texts, provide your independent evaluation:",
      "AI Lexical Similarity: [your percentage based on actual word overlap]",
      "AI Semantic Similarity: [your percentage based on conceptual similarity]",
      "AI Overall Similarity: [your percentage considering both factors]",
      "Explain your reasoning: Why did you assign these specific percentages? What specific similarities or differences did you identify?",
      "",
      "SECTION 1: Core Concept Analysis",
      "Analyze and compare the FUNDAMENTAL CONCEPTS:",
      "- What is the EXACT problem each research is trying to solve? Are they the SAME problem?",
      "- What is the research question or hypothesis? Are they IDENTICAL or just related?",
      "- What domain/field do they address? Same field but different focus?",
      "- What is the intended outcome or contribution? Same goal or different?",
      "- Overall: Do they have the SAME CORE CONCEPT or just use similar technology?",
      "",
      "SECTION 2: Methodology and Approach Comparison",
      "Compare HOW each research approaches the problem:",
      "- What methods, algorithms, or techniques does each use?",
      "- Are the approaches FUNDAMENTALLY THE SAME or just from the same technology family?",
      "- Do they collect/process data the same way?",
      "- Are the implementation strategies identical or different?",
      "",
      "SECTION 3: Application and Use Case Analysis",
      "Compare WHERE and HOW each research is applied:",
      "- What is the target application or use case?",
      "- Are they solving the problem for the SAME context/scenario?",
      "- Who are the intended users or beneficiaries?",
      "- Is the practical application the SAME or different?",
      "",
      "SECTION 4: Conceptual Overlap Summary",
      "Provide a clear verdict:",
      "- Are these researches pursuing the SAME CORE IDEA? (Yes/No/Partially)",
      "- What percentage of the CONCEPT (not just words) is the same?",
      "- Is this likely a duplicate, derivative, or genuinely different research?",
      "",
      "SECTION 5: Improvement Suggestions",
      "Give practical suggestions on how the new research can become more unique:",
      "- How to differentiate the core concept?",
      "- What different problems could be addressed?",
      "- How to change the methodology or approach?",
      "- What unique applications or contexts to explore?",
      "",
      "Write your full analysis based on deep conceptual understanding of both research works."
    ].join('\n');


    // -------------------------
    // MODEL FAILOVER LOGIC
    // -------------------------
   const modelPriority = [
  'gemini-2.5-flash',         // stable high-performance
  'gemini-2.5-pro',           // strongest reasoning
  'gemini-2.5-flash-lite'     // cost-efficient option
];


    let analysis = null;
    let lastError = null;

    let isQuotaError = false;
    let retryAfterSeconds = 0;

    for (const modelName of modelPriority) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = result.response;
        
        // Check if response is blocked or has issues
        if (!response) {
          throw new Error('No response from model');
        }
        
        analysis = response.text();
        
        if (!analysis || analysis.trim().length === 0) {
          throw new Error('Empty response from model');
        }
        
        console.log(`Model ${modelName} succeeded. Response length: ${analysis.length}`);
        break;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Model ${modelName} failed:`, errorMessage);
        lastError = err;
        
        // Check if it's a quota/rate limit error
        if (errorMessage.includes('429') || 
            errorMessage.includes('quota') || 
            errorMessage.includes('Too Many Requests') ||
            errorMessage.includes('rate limit')) {
          isQuotaError = true;
          
          // Try to extract retry delay
          const retryMatch = errorMessage.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
          if (retryMatch) {
            retryAfterSeconds = Math.ceil(parseFloat(retryMatch[1]));
          }
        }
      }
    }

    if (!analysis) {
      const errorDetails = lastError instanceof Error ? lastError.message : 'Unknown error';
      console.error('All models failed. Last error:', errorDetails);
      
      // Return user-friendly quota error message
      if (isQuotaError) {
        return NextResponse.json(
          {
            error: 'API quota limit exceeded',
            message: 'The AI analysis service has reached its daily quota limit. This typically resets every 24 hours. Please try again later or contact support if this persists.',
            retryAfter: retryAfterSeconds || 60,
            isQuotaError: true,
            modelsTried: modelPriority
          },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        {
          error: 'AI service temporarily unavailable',
          message: 'All AI models are currently unavailable. Please try again in a few moments.',
          details: errorDetails,
          modelsTried: modelPriority
        },
        { status: 503 }
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('AI Analysis error:', {
      message: errorMessage,
      stack: errorStack,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    return NextResponse.json(
      {
        error: 'Failed to generate AI analysis',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

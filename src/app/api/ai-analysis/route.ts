import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Exponential backoff retry helper
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's a rate limit error
      const isRateLimit = errorMessage.includes('429') || 
                         errorMessage.includes('quota') || 
                         errorMessage.includes('Too Many Requests') ||
                         errorMessage.includes('rate limit');
      
      // If not a rate limit error, don't retry
      if (!isRateLimit) {
        throw error;
      }
      
      // If last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Calculate exponential backoff delay: 2s, 4s, 8s
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`⏳ Rate limit hit. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

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
      overallSimilarity,
      geminiScores // Optional Gemini semantic scores
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

    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'API configuration error - No AI provider configured' },
        { status: 500 }
      );
    }

    // -----------------------------
    // POST-COSINE CONCEPT EVALUATION PROMPT
    // -----------------------------
    const cosineSimilarity = semanticSimilarity * 100; // Use the algorithmic cosine similarity
    
    const prompt = [
      "You are an academic research concept evaluator.",
      "",
      "CONTEXT:",
      "Two research studies have already been compared using cosine similarity.",
      "The cosine similarity score represents TEXTUAL / SEMANTIC similarity only.",
      "",
      "IMPORTANT RULES (STRICT):",
      "1. Cosine similarity DOES NOT determine conceptual similarity.",
      "2. The PRIMARY criterion is the CORE PROBLEM being solved.",
      "3. Similarity assessment can range from 0% to 100%.",
      "4. ACCEPTANCE CRITERIA:",
      "   - Research is ACCEPTABLE if concept similarity is NOT MORE THAN 15% (≤15%)",
      "   - Similarity >15% = REJECTED (too similar, potential plagiarism)",
      "   - Similarity ≤15% = ACCEPTABLE (0-15% range is approved)",
      "5. If the two studies do NOT solve the same real-world problem,",
      "   conceptual similarity typically falls in the 0-15% acceptable range.",
      "6. Ignore similarities in:",
      "   - Tools and technologies",
      "   - Methodology (Agile, RAD, ISO 25010)",
      "   - Writing structure or academic format",
      "7. High concept similarity (>15%) exists ONLY if BOTH studies:",
      "   - Solve the same problem",
      "   - Serve the same primary users",
      "   - Operate in the same domain",
      "   - Have the same intent and scope",
      "",
      "INPUT:",
      "",
      "PROPOSED RESEARCH (Submitted for Review)",
      `Title: "${safeUserTitle}"`,
      `Content: "${safeUserConcept}"`,
      "",
      "EXISTING RESEARCH (From Database)",
      `Title: "${safeExistingTitle}"`,
      `Content: "${safeExistingThesisBrief}"`,
      "",
      `Cosine Similarity Score (Pre-calculated): ${cosineSimilarity.toFixed(1)}%`,
      "",
      "EVALUATION STEPS:",
      "A. Identify the core problem of the Proposed Research in ONE sentence.",
      "B. Identify the core problem of the Existing Research in ONE sentence.",
      "C. Decide if the problems are the SAME or DIFFERENT.",
      "D. Assess actual conceptual similarity (0-100%).",
      "E. Apply ACCEPTANCE CRITERIA:",
      "   - ≤15% = ACCEPTABLE (not more than 15% is approved)",
      "   - >15% = REJECTED (too similar, potential plagiarism)",
      "",
      "OUTPUT FORMAT (MUST FOLLOW EXACTLY):",
      "",
      "Proposed Research:",
      "[ONE sentence describing the core problem of the proposed research]",
      "",
      "Existing Research:",
      "[ONE sentence describing the core problem of the existing research]",
      "",
      "Problem Comparison Result: [SAME or DIFFERENT]",
      "",
      "Cosine Similarity (Textual): [the pre-calculated score provided above]%",
      "",
      "Final Conceptual Similarity: [X% - rate honestly from 0-100%]",
      "",
      "Acceptance Status:",
      "[ACCEPTABLE (≤15%) / REJECTED (>15%)]",
      "",
      "Justification:",
      "[Provide detailed academic explanation - 2-3 paragraphs explaining your decision, the nature of the problems, and why they are same or different]",
      "",
      "Final Verdict:",
      "[Either 'Not the same research concept' OR 'Same research concept']",
      "",
      "BREAKDOWN (for different problems only):",
      "- Generic system characteristics: [X%]",
      "- Shared methodology/framework: [X%]",
      "- Academic structure: [X%]",
      "- Total: [sum, max 15%]",
      "",
      "ADDITIONAL ANALYSIS:",
      "",
      "Problem Identity Check:",
      "Same problem being solved? [YES/NO]",
      "Same target users? [YES/NO]",
      "Same domain/area? [YES/NO]",
      "Same research intent? [YES/NO]",
      "Core Problem Overlap: [0%, 25%, 50%, 75%, or 100%]",
      "",
      "Detailed Comparison:",
      "",
      "Proposed Research Focus:",
      "- Problem: [describe in detail]",
      "- Users: [who benefits - be specific]",
      "- Domain: [field/area - be specific]",
      "- Intent: [purpose - be specific]",
      "",
      "Existing Research Focus:",
      "- Problem: [describe in detail]",
      "- Users: [who benefits - be specific]",
      "- Domain: [field/area - be specific]",
      "- Intent: [purpose - be specific]",
      "",
      "Similarity Analysis:",
      "- Text Similarity Explanation: [explain why cosine is high/low - provide comprehensive analysis]",
      "- Concept Similarity Explanation: [explain why concept is different/same - provide comprehensive analysis]",
      "- Key Differences: [list and explain major differences if problems differ]",
      "- Key Similarities: [list generic overlaps if problems differ, or real overlaps if same]",
      "",
      "Recommendations:",
      "[Provide comprehensive, specific suggestions based on whether problems are same or different. Do not limit your response - provide thorough guidance.]",
      "",
      "Write your complete evaluation following the format above. Write in plain text only, no markdown symbols. Provide comprehensive, detailed analysis without restricting response length."
    ].join('\n');


    // -------------------------
    // MODEL FAILOVER LOGIC
    // -------------------------
const modelPriority = [
  // 1️⃣ Primary (Gemini – fast & lowest cost)
    { provider: "openai", model: "gpt-5.1" },
  { provider: "openai", model: "gemini-2.5-flash" },

  // 2️⃣ Free / low-cost fallback
  { provider: "openai", model: "gpt-4.1-mini" },


  // 3️⃣ Paid / high-capability fallback
  { provider: "openai", model: "gpt-4.1" },
  { provider: "openai", model: "gpt-5.2" }
];


    let analysis: string | null = null;
    let lastError: Error | unknown = null;
    let isQuotaError = false;
    let retryAfterSeconds = 0;

    for (const modelConfig of modelPriority) {
      try {
        const { provider, model: modelName } = modelConfig;
        
        // Skip provider if API key not available
        if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
          console.log(`Skipping OpenAI model ${modelName} (no API key)`);
          continue;
        }
        if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
          console.log(`Skipping Gemini model ${modelName} (no API key)`);
          continue;
        }
        
        console.log(`Trying ${provider} model: ${modelName}`);
        
        // Wrap API calls with retry logic
        const apiCall = async () => {
          if (provider === 'openai') {
            // OpenAI API call
            const completion = await openai.chat.completions.create({
              model: modelName,
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert academic research evaluator specializing in similarity analysis and plagiarism detection.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.3,
              max_tokens: 4000
            });
            
            return completion.choices[0]?.message?.content || null;
            
          } else if (provider === 'gemini') {
            // Gemini API call
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = result.response;
            
            if (!response) {
              throw new Error('No response from Gemini');
            }
            
            return response.text();
          }
          
          return null;
        };
        
        // Execute with exponential backoff retry
        analysis = await retryWithBackoff(apiCall, 3, 2000);
        
        if (!analysis || analysis.trim().length === 0) {
          throw new Error(`Empty response from ${provider}`);
        }
        
        console.log(`✅ Model ${modelConfig.model} succeeded. Response length: ${analysis?.length || 0}`);
        break;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Model ${modelConfig.model} failed:`, errorMessage);
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

    // Parse AI-calculated similarity percentages from new structured format
    const proposedResearchMatch = analysis.match(/Proposed Research:\s*([\s\S]+?)(?=\n\nExisting Research:|\nExisting Research:)/);
    const existingResearchMatch = analysis.match(/Existing Research:\s*([\s\S]+?)(?=\n\nProblem Comparison Result:|\nProblem Comparison Result:)/);
    const problemComparisonMatch = analysis.match(/Problem Comparison Result:\s*(SAME|DIFFERENT)/i);
    const cosineTextualMatch = analysis.match(/Cosine Similarity \(Textual\):\s*(\d+(?:\.\d+)?)\s*%/i);
    const finalConceptMatch = analysis.match(/Final Conceptual Similarity:\s*(\d+(?:\.\d+)?)\s*%/i);
    const finalVerdictMatch = analysis.match(/Final Verdict:\s*(.+?)(?=\n\n|BREAKDOWN|$)/i);

    // Extract Problem Identity Check results
    const sameProblemMatch = analysis.match(/Same problem being solved\?\s*\[?(YES|NO)\]?/i);
    const sameUsersMatch = analysis.match(/Same target users\?\s*\[?(YES|NO)\]?/i);
    const sameDomainMatch = analysis.match(/Same domain\/area\?\s*\[?(YES|NO)\]?/i);
    const sameIntentMatch = analysis.match(/Same research intent\?\s*\[?(YES|NO)\]?/i);
    const coreOverlapMatch = analysis.match(/Core Problem Overlap:\s*(\d+)\s*%/i);

    // Calculate problem identity
    const problemComparison = problemComparisonMatch ? problemComparisonMatch[1].toUpperCase() : 'UNKNOWN';
    const problemIdentity = {
      proposedResearch: proposedResearchMatch ? proposedResearchMatch[1].trim() : 'Not extracted',
      existingResearch: existingResearchMatch ? existingResearchMatch[1].trim() : 'Not extracted',
      problemComparison: problemComparison,
      sameProblem: sameProblemMatch ? sameProblemMatch[1].toUpperCase() === 'YES' : (problemComparison === 'SAME'),
      sameUsers: sameUsersMatch ? sameUsersMatch[1].toUpperCase() === 'YES' : false,
      sameDomain: sameDomainMatch ? sameDomainMatch[1].toUpperCase() === 'YES' : false,
      sameIntent: sameIntentMatch ? sameIntentMatch[1].toUpperCase() === 'YES' : false,
      coreOverlap: coreOverlapMatch ? parseInt(coreOverlapMatch[1]) : (problemComparison === 'DIFFERENT' ? 0 : problemComparison === 'SAME' ? 100 : 50),
      finalVerdict: finalVerdictMatch ? finalVerdictMatch[1].trim() : 'Unknown'
    };

    // ============================================================================
    // TWO-STAGE SIMILARITY PIPELINE
    // ============================================================================
    // Stage 1: Text/Semantic Similarity (cosine-based) - from algorithmic analysis
    // Stage 2: Concept Similarity (problem-based) - from AI evaluation or formula
    
    // Get text similarity from algorithmic analysis (this is like cosine similarity)
    const textSimilarity = semanticSimilarity; // From the algorithmic cosine/TF-IDF calculation
    
    // Get AI-reported concept similarity (from the new format)
    let aiConceptSim = finalConceptMatch ? parseFloat(finalConceptMatch[1]) / 100 : null;
    
    // ============================================================================
    // CONCEPT SIMILARITY FORMULA (Problem-Based)
    // ============================================================================
    // Use AI's concept similarity if provided and valid, otherwise calculate
    
    const problemsAreSame = problemIdentity.problemComparison === 'SAME' || problemIdentity.coreOverlap >= 75;
    const problemsAreDifferent = problemIdentity.problemComparison === 'DIFFERENT' || problemIdentity.coreOverlap <= 25;
    
    // Check if problems are completely different (no overlap in any criteria)
    const completelyDifferent = !problemIdentity.sameProblem && 
                                !problemIdentity.sameUsers && 
                                !problemIdentity.sameDomain && 
                                !problemIdentity.sameIntent && 
                                problemIdentity.coreOverlap === 0;
    
    let conceptSimilarity: number;
    let acceptanceStatus: string;
    let similarityRationale: string;
    
    // Use AI's concept similarity (allow full 0-100% range)
    if (completelyDifferent) {
      conceptSimilarity = 0;
      acceptanceStatus = 'ACCEPTABLE';
      similarityRationale = `Problems are completely different with no overlap. Concept similarity is 0%. Status: ACCEPTABLE (≤15%).`;
    }
    // Use AI's concept similarity if it provided one (no capping)
    else if (aiConceptSim !== null) {
      conceptSimilarity = aiConceptSim;
      
      // Determine acceptance status: ACCEPTABLE if ≤15%, REJECTED if >15%
      if (conceptSimilarity <= 0.15) {
        acceptanceStatus = 'ACCEPTABLE';
        similarityRationale = `Concept similarity is ${(conceptSimilarity * 100).toFixed(1)}%. Status: ACCEPTABLE (not more than 15%).`;
      } else {
        acceptanceStatus = 'REJECTED';
        similarityRationale = `Concept similarity is ${(conceptSimilarity * 100).toFixed(1)}%. Status: REJECTED (exceeds 15% threshold).`;
      }
    } else {
      // Calculate using formula if AI didn't provide one
      if (problemsAreDifferent) {
        conceptSimilarity = Math.min(0.15, 0.2 * textSimilarity);
        // Determine acceptance status: ≤15% is ACCEPTABLE
        if (conceptSimilarity <= 0.15) {
          acceptanceStatus = 'ACCEPTABLE';
          similarityRationale = `Problems are different (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: ACCEPTABLE (≤15%).`;
        } else {
          acceptanceStatus = 'REJECTED';
          similarityRationale = `Problems are different (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: REJECTED (>15%).`;
        }
      } else if (problemsAreSame) {
        conceptSimilarity = Math.min(1.0, Math.max(0, 0.30 + 0.70 * textSimilarity));
        // Determine acceptance status: ≤15% is ACCEPTABLE
        if (conceptSimilarity > 0.15) {
          acceptanceStatus = 'REJECTED';
          similarityRationale = `Problems are the same (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: REJECTED (>15%).`;
        } else {
          acceptanceStatus = 'ACCEPTABLE';
          similarityRationale = `Problems are the same (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: ACCEPTABLE (≤15%).`;
        }
      } else {
        // Interpolate for partially related
        const overlapRatio = problemIdentity.coreOverlap / 100;
        const differentFormula = Math.min(0.15, 0.2 * textSimilarity);
        const sameFormula = Math.min(1.0, 0.30 + 0.70 * textSimilarity);
        conceptSimilarity = differentFormula * (1 - overlapRatio) + sameFormula * overlapRatio;
        // Determine acceptance status: ≤15% is ACCEPTABLE
        if (conceptSimilarity <= 0.15) {
          acceptanceStatus = 'ACCEPTABLE';
          similarityRationale = `Problems are partially related (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: ACCEPTABLE (≤15%).`;
        } else {
          acceptanceStatus = 'REJECTED';
          similarityRationale = `Problems are partially related (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: REJECTED (>15%).`;
        }
      }
    }
    
    console.log(`[Post-Cosine Evaluation]`);
    console.log(`  Problem Comparison: ${problemIdentity.problemComparison}`);
    console.log(`  Text Similarity (Cosine): ${(textSimilarity * 100).toFixed(1)}%`);
    console.log(`  Concept Similarity: ${(conceptSimilarity * 100).toFixed(1)}%`);
    console.log(`  Acceptance Status: ${acceptanceStatus}`);
    console.log(`  Final Verdict: ${problemIdentity.finalVerdict}`);
    
    // Calculate overall similarity: blend text similarity with weighted concept similarity
    // Text similarity shows lexical overlap, concept similarity shows problem-based similarity
    // Overall = 30% text similarity + 70% concept similarity (concept is more important)
    const adjustedOverall = Math.min((textSimilarity * 0.3) + (conceptSimilarity * 0.7), 1.0);

    const aiSimilarities = {
      // Stage 1: Text Similarity (cosine/TF-IDF based)
      textSimilarity: textSimilarity,
      lexical: textSimilarity, // Backward compatibility
      
      // Stage 2: Concept Similarity (problem-based from AI evaluation)
      conceptSimilarity: conceptSimilarity,
      semantic: conceptSimilarity, // Backward compatibility
      
      // Overall (reflects concept)
      overall: adjustedOverall,
      
      // Problem identity details
      problemIdentity,
      acceptanceStatus,
      similarityRationale
    }

    console.log('Post-Cosine Evaluation Results:', aiSimilarities);

    return NextResponse.json({
      success: true,
      analysis,
      aiSimilarities,
      
      // Two-Stage Pipeline Results
      textSimilarity: aiSimilarities.textSimilarity !== null ? (aiSimilarities.textSimilarity * 100).toFixed(2) : null,
      conceptSimilarity: aiSimilarities.conceptSimilarity !== null ? (aiSimilarities.conceptSimilarity * 100).toFixed(2) : null,
      
      // Traditional metrics (maintained for backward compatibility)
      aiLexicalSimilarity: aiSimilarities.lexical !== null ? (aiSimilarities.lexical * 100).toFixed(2) : null,
      aiSemanticSimilarity: aiSimilarities.semantic !== null ? (aiSimilarities.semantic * 100).toFixed(2) : null,
      aiOverallSimilarity: aiSimilarities.overall !== null ? (aiSimilarities.overall * 100).toFixed(2) : null,
      
      // Problem identity and rules
      problemIdentity: aiSimilarities.problemIdentity,
      acceptanceStatus: aiSimilarities.acceptanceStatus,
      similarityRationale: aiSimilarities.similarityRationale,
      
      // Explanation
      pipelineExplanation: {
        stage1: `Text Similarity / Lexical (${(aiSimilarities.textSimilarity * 100).toFixed(1)}%): Measures word/phrase overlap using cosine similarity and TF-IDF. This includes ALL text: generic terms, academic structure, methodology terms, and technology stack.`,
        stage2: `Concept Similarity / Semantic (${(aiSimilarities.conceptSimilarity * 100).toFixed(1)}%): AI evaluation of whether the CORE RESEARCH PROBLEM is the same. ${aiSimilarities.similarityRationale}`,
        overall: `Overall Assessment (${(aiSimilarities.overall * 100).toFixed(1)}%): Weighted blend of 30% text similarity + 70% concept similarity. Prioritizes concept similarity as it's more important for plagiarism detection.`,
        acceptance: `Acceptance Status: ${aiSimilarities.acceptanceStatus}. Research is ACCEPTABLE if concept similarity is NOT MORE THAN 15% (≤15%). Similarity above 15% indicates potential plagiarism (REJECTED).`,
        note: 'IMPORTANT: High text similarity (70%) does NOT mean high concept similarity. Two researches solving DIFFERENT PROBLEMS but using similar technology/methodology will have HIGH text similarity but LOW concept similarity (0-15%). The concept similarity reflects academic plagiarism standards.'
      },
      
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

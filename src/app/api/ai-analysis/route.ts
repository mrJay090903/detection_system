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
"You are a STRICT academic research concept evaluator.",
"You must detect ALL conceptual overlaps and evaluate similarity conservatively.",
"",
"CONTEXT:",
"Two research studies have already been compared using cosine similarity.",
"The cosine similarity score represents TEXTUAL / SEMANTIC similarity only.",
"Your job is to evaluate CONCEPTUAL similarity - whether the research IDEAS overlap.",
"",
"IMPORTANT PRINCIPLES:",
"1. Different technologies solving the SAME SPECIFIC problem are still conceptually similar.",
"2. However, sharing a BROAD CATEGORY (e.g., 'educational technology', 'mobile app', 'web-based system') does NOT mean same problem.",
"3. You MUST compare the SPECIFIC problem, not the generic domain.",
"   Example: 'AR for visualizing anatomy' vs 'gamified quiz for SQL' = DIFFERENT problems (both are educational tech, but solve different specific needs)",
"   Example: 'AR for visualizing anatomy' vs 'VR for visualizing anatomy' = SAME problem (different tech, same specific need)",
"4. Cosine similarity is only supporting evidence - not the final determinant.",
"5. Do NOT inflate scores just because both studies involve technology, education, mobile apps, or student engagement.",
"",
"=== 4-FIELD EVALUATION CRITERIA ===",
"",
"You MUST evaluate these 4 fields and provide ACCURATE integer percentages (0-100%) for each:",
"",
"1) PROBLEM/NEED (what issue is being solved)",
" - What SPECIFIC real-world problem or need does the research address?",
" - Compare the SPECIFIC underlying issue, not the broad category",
" - 'Student engagement' alone is too generic - ask: engagement in WHAT? For WHOM? WHY?",
" - Score HIGH (70-100%) ONLY if both address the EXACT SAME specific problem",
" - Score MEDIUM (40-69%) if problems share the same specific domain AND similar gap",
" - Score LOW (0-39%) if problems are in different specific domains or address different gaps",
" - Score VERY LOW (0-20%) if they only share a broad generic category like 'education' or 'mobile app'",
"",
"2) OBJECTIVES (what the study will do/produce)",
" - What are the SPECIFIC goals, deliverables, or outcomes?",
" - Compare what each study specifically aims to produce",
" - Generic goals like 'improve learning' do NOT count as overlap",
" - Score HIGH (70-100%) ONLY if both produce the SAME type of system/output for the SAME purpose",
" - Score MEDIUM (40-69%) if objectives share some specific deliverables",
" - Score LOW (0-39%) if the deliverables and system types are fundamentally different",
"",
"3) SCOPE/CONTEXT (where/who it applies to)",
" - Target institution, environment, users, or domain",
" - Score HIGH (70-100%) if same institution/environment/users",
" - Score MEDIUM (40-69%) if related but different departments/communities",
" - Score LOW (0-39%) if completely different context",
"",
"4) INPUTS/OUTPUTS (data in, results out)",
" - Compare input data types and produced outputs",
" - Score HIGH (70-100%) if same data model or output pattern",
" - Score MEDIUM (40-69%) if partially overlapping inputs/outputs",
" - Score LOW (0-39%) if data types are different",
"",
"NOTE: Do NOT evaluate Method/Approach (algorithms, frameworks, methodologies). These are implementation details and should NOT affect the conceptual similarity score.",
"",
"=== SCORING RULES ===",
"- Final Conceptual Similarity = AVERAGE of the 4 field scores",
"- Round to nearest whole number",
"- SCORING GUIDELINES:",
"  * Below 15% = Safe & Acceptable (clearly different research)",
"  * 15-20% = Borderline (minor overlaps, needs review)",
"  * Above 20% = Requires Revision (significant overlap detected)",
"  * Above 30% = Often Rejected (strong conceptual similarity)",
"- Do NOT inflate: sharing broad categories (education, mobile, web) without specific overlap = LOW scores",
"- Be HONEST: if the specific problems are different, score LOW even if they sound vaguely related",
"- If PROBLEM and OBJECTIVES are both >=70%, final similarity MUST NOT be below 60%",
"- If 3 or more fields are >=70%, final similarity MUST NOT be below 70%",
"- If PROBLEM is below 20%, final similarity SHOULD NOT exceed 25% regardless of other fields",
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
"OUTPUT FORMAT (PLAIN TEXT ONLY - FOLLOW EXACTLY):",
"",
"Proposed Research:",
"[ONE sentence summarizing core problem]",
"",
"Existing Research:",
"[ONE sentence summarizing core problem]",
"",
"Problem Comparison Result: [SAME / SIMILAR / DIFFERENT]",
"",
"Cosine Similarity (Textual): [use provided score]%",
"",
"=== FIELD SCORES ===",
"Problem/Need: [X%]",
"Rationale: [1-2 sentence explanation of why this score was given]",
"Objectives: [X%]",
"Rationale: [1-2 sentence explanation of why this score was given]",
"Scope/Context: [X%]",
"Rationale: [1-2 sentence explanation of why this score was given]",
"Inputs/Outputs: [X%]",
"Rationale: [1-2 sentence explanation of why this score was given]",
"",
"Final Conceptual Similarity: [X%]",
"",
"Acceptance Status:",
"[SAFE (<15%) / BORDERLINE (15-20%) / REQUIRES REVISION (>20%) / REJECTED (>30%)]",
"",
"Justification:",
"[2-3 detailed academic paragraphs explaining overlaps and differences across all 4 fields. Explain how cosine similarity aligns or misleads.]",
"",
"Final Verdict:",
"[Either 'Not the same research concept' OR 'Same research concept']",
"",
"Detailed Comparison:",
"",
"Proposed Research Focus:",
"- Problem:",
"- Objectives:",
"- Scope/Context:",
"- Inputs/Outputs:",
"",
"Existing Research Focus:",
"- Problem:",
"- Objectives:",
"- Scope/Context:",
"- Inputs/Outputs:",
"",
"Similarity Analysis:",
"- Text Similarity Explanation:",
"  [Explain what the cosine/textual similarity score means in context. Does high text similarity reflect actual concept overlap or just shared vocabulary?]",
"- Concept Similarity Explanation:",
"  [Explain the overall conceptual similarity. Are the research IDEAS fundamentally the same or different? Reference the 4-field scores.]",
"- Problem Domain Overlap:",
"  [Specifically compare the problem domains. Are they in the same field? Same sub-field? Same specific niche?]",
"- Methodology Comparison:",
"  [Compare the technical approaches, tools, frameworks, and development methodologies used.]",
"- Target Audience & Scope Overlap:",
"  [Compare who benefits from each research, where it applies, and the scope boundaries.]",
"- Key Similarities:",
"  [List 2-4 specific similarities found between the two researches]",
"- Key Differences:",
"  [List 2-4 specific differences that distinguish the two researches]",
"- Novelty Assessment:",
"  [What makes the proposed research unique or novel compared to the existing one? What new contribution does it offer?]",
"",
"Recommendations:",
"[Provide specific guidance. If REJECTED, suggest concrete ways to change problem, users, scope, or objectives to reduce overlap. If ACCEPTABLE, suggest how to strengthen novelty.]",
"",
"Write your complete evaluation following the format above."
].join("\n");


    // -------------------------
    // MODEL FAILOVER LOGIC
    // -------------------------
const modelPriority = [
  // 1️⃣ Primary (Gemini – fast & lowest cost)
    { provider: "openai", model: "gpt-5.2" },
  { provider: "openai", model: "gemini-2.5-flash" },

  // 2️⃣ Free / low-cost fallback
  { provider: "openai", model: "o4-mini-deep-research" },
  { provider: "openai", model: "o3-deep-research" },
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
            // Determine which token parameter to use based on model
            const usesMaxCompletionTokens = modelName.startsWith('gpt-5') || 
                                           modelName.startsWith('o3') || 
                                           modelName.startsWith('o4');
            
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
              ...(usesMaxCompletionTokens 
                ? { max_completion_tokens: 4000 }
                : { max_tokens: 4000 })
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

    // ============================================================================
    // EXTRACT 4-FIELD SCORES from AI response
    // ============================================================================
    const fieldScorePatterns = {
      problemNeed: analysis.match(/Problem\/Need:\s*\[?(\d+(?:\.\d+)?)%?\]?/i),
      objectives: analysis.match(/Objectives:\s*\[?(\d+(?:\.\d+)?)%?\]?/i),
      scopeContext: analysis.match(/Scope\/Context:\s*\[?(\d+(?:\.\d+)?)%?\]?/i),
      inputsOutputs: analysis.match(/Inputs\/Outputs:\s*\[?(\d+(?:\.\d+)?)%?\]?/i),
    };

    const fieldScores = {
      problemNeed: fieldScorePatterns.problemNeed ? parseFloat(fieldScorePatterns.problemNeed[1]) : null,
      objectives: fieldScorePatterns.objectives ? parseFloat(fieldScorePatterns.objectives[1]) : null,
      scopeContext: fieldScorePatterns.scopeContext ? parseFloat(fieldScorePatterns.scopeContext[1]) : null,
      inputsOutputs: fieldScorePatterns.inputsOutputs ? parseFloat(fieldScorePatterns.inputsOutputs[1]) : null
    };

    // Extract score rationales for each field
    const extractRationale = (fieldPattern: string) => {
      const regex = new RegExp(fieldPattern + '\\s*\\[?\\d+(?:\\.\\d+)?%?\\]?\\s*\n\\s*Rationale:\\s*(.+)', 'i');
      const match = analysis.match(regex);
      return match ? match[1].trim() : null;
    };

    const fieldRationales = {
      problemNeed: extractRationale('Problem\\/Need:'),
      objectives: extractRationale('Objectives:'),
      scopeContext: extractRationale('Scope\\/Context:'),
      inputsOutputs: extractRationale('Inputs\\/Outputs:'),
    };

    // Extract detailed comparison for each field
    const extractFieldDetail = (fieldName: string, nextFieldName: string) => {
      const pattern = new RegExp(
        `${fieldName.replace('/', '\\/')}[:\s]*[\\[\\(]?\\d+(?:\\.\\d+)?%?[\\]\\)]?\\s*([\\s\\S]*?)(?=${nextFieldName.replace('/', '\\/')}|Final Conceptual|Acceptance Status|$)`,
        'i'
      );
      const match = analysis.match(pattern);
      return match ? match[1].trim().split('\n').filter((l: string) => l.trim()).map((l: string) => l.trim().replace(/^[-•]\s*/, '')) : [];
    };

    // Extract detailed field comparison sections
    const proposedFocusMatch = analysis.match(/Proposed Research Focus:\s*([\s\S]*?)(?=Existing Research Focus:|$)/i);
    const existingFocusMatch = analysis.match(/Existing Research Focus:\s*([\s\S]*?)(?=Similarity Analysis:|$)/i);
    
    const proposedFocus = {
      problem: '', objectives: '', scopeContext: '', inputsOutputs: ''
    };
    const existingFocus = {
      problem: '', objectives: '', scopeContext: '', inputsOutputs: ''
    };

    if (proposedFocusMatch) {
      const text = proposedFocusMatch[1];
      const pMatch = text.match(/Problem:\s*([^\n]+)/i);
      const oMatch = text.match(/Objectives:\s*([^\n]+)/i);
      const sMatch = text.match(/Scope\/Context:\s*([^\n]+)/i);
      const iMatch = text.match(/Inputs\/Outputs:\s*([^\n]+)/i);
      if (pMatch) proposedFocus.problem = pMatch[1].trim();
      if (oMatch) proposedFocus.objectives = oMatch[1].trim();
      if (sMatch) proposedFocus.scopeContext = sMatch[1].trim();
      if (iMatch) proposedFocus.inputsOutputs = iMatch[1].trim();
    }

    if (existingFocusMatch) {
      const text = existingFocusMatch[1];
      const pMatch = text.match(/Problem:\s*([^\n]+)/i);
      const oMatch = text.match(/Objectives:\s*([^\n]+)/i);
      const sMatch = text.match(/Scope\/Context:\s*([^\n]+)/i);
      const iMatch = text.match(/Inputs\/Outputs:\s*([^\n]+)/i);
      if (pMatch) existingFocus.problem = pMatch[1].trim();
      if (oMatch) existingFocus.objectives = oMatch[1].trim();
      if (sMatch) existingFocus.scopeContext = sMatch[1].trim();
      if (iMatch) existingFocus.inputsOutputs = iMatch[1].trim();
    }

    const fieldAssessment = {
      scores: fieldScores,
      rationales: fieldRationales,
      proposed: proposedFocus,
      existing: existingFocus,
      average: null as number | null
    };

    // Calculate average of available field scores
    const availableScores = Object.values(fieldScores).filter((v): v is number => v !== null);
    if (availableScores.length > 0) {
      fieldAssessment.average = Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length);
    }

    console.log('[4-Field Assessment]');
    console.log(`  Problem/Need: ${fieldScores.problemNeed ?? 'N/A'}%`);
    console.log(`  Objectives: ${fieldScores.objectives ?? 'N/A'}%`);
    console.log(`  Scope/Context: ${fieldScores.scopeContext ?? 'N/A'}%`);
    console.log(`  Inputs/Outputs: ${fieldScores.inputsOutputs ?? 'N/A'}%`);
    console.log(`  Average: ${fieldAssessment.average ?? 'N/A'}%`);

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
    
    // Use AI's concept similarity honestly - no artificial capping
    if (completelyDifferent) {
      conceptSimilarity = 0;
      acceptanceStatus = 'ACCEPTABLE';
      similarityRationale = `Problems are completely different with no overlap. Concept similarity is 0%. Status: ACCEPTABLE (<40%).`;
    }
    // Use AI's concept similarity directly if provided (STRICT: no deflation)
    else if (aiConceptSim !== null) {
      conceptSimilarity = aiConceptSim;
      
      // STRICT enforcement: if problems are SAME but AI scored low, override with minimum floor
      if (problemsAreSame && conceptSimilarity < 0.50) {
        console.log(`[STRICT] AI scored concept at ${(conceptSimilarity * 100).toFixed(1)}% but problems are SAME. Applying floor of 50%.`);
        conceptSimilarity = Math.max(conceptSimilarity, 0.50);
      }
      
      // Determine acceptance status: ACCEPTABLE if <40%, REJECTED if ≥40%
      if (conceptSimilarity < 0.40) {
        acceptanceStatus = 'ACCEPTABLE';
        similarityRationale = `Concept similarity is ${(conceptSimilarity * 100).toFixed(1)}%. Status: ACCEPTABLE (below 40% threshold).`;
      } else {
        acceptanceStatus = 'REJECTED';
        similarityRationale = `Concept similarity is ${(conceptSimilarity * 100).toFixed(1)}%. Status: REJECTED (≥40% threshold exceeded).`;
      }
    } else {
      // Calculate using formula if AI didn't provide one
      if (problemsAreDifferent) {
        // Different problems: scale with text similarity but allow up to 35%
        conceptSimilarity = Math.min(0.35, 0.5 * textSimilarity);
        if (conceptSimilarity < 0.40) {
          acceptanceStatus = 'ACCEPTABLE';
          similarityRationale = `Problems are different (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: ACCEPTABLE (<40%).`;
        } else {
          acceptanceStatus = 'REJECTED';
          similarityRationale = `Problems are different (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: REJECTED (≥40%).`;
        }
      } else if (problemsAreSame) {
        // Same problems: STRICT minimum of 50%, scales up with text similarity
        conceptSimilarity = Math.min(1.0, Math.max(0.50, 0.40 + 0.60 * textSimilarity));
        acceptanceStatus = 'REJECTED';
        similarityRationale = `Problems are the same (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: REJECTED (≥40%).`;
      } else {
        // Interpolate for partially related
        const overlapRatio = problemIdentity.coreOverlap / 100;
        const differentFormula = Math.min(0.35, 0.5 * textSimilarity);
        const sameFormula = Math.min(1.0, Math.max(0.50, 0.40 + 0.60 * textSimilarity));
        conceptSimilarity = differentFormula * (1 - overlapRatio) + sameFormula * overlapRatio;
        if (conceptSimilarity < 0.40) {
          acceptanceStatus = 'ACCEPTABLE';
          similarityRationale = `Problems are partially related (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: ACCEPTABLE (<40%).`;
        } else {
          acceptanceStatus = 'REJECTED';
          similarityRationale = `Problems are partially related (${problemIdentity.coreOverlap}% overlap). Concept similarity ${(conceptSimilarity * 100).toFixed(1)}%. Status: REJECTED (≥40%).`;
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
    // Overall = 40% text similarity + 60% concept similarity (strict: both matter significantly)
    const adjustedOverall = Math.min((textSimilarity * 0.4) + (conceptSimilarity * 0.6), 1.0);

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
      
      // 5-Field Assessment
      fieldAssessment,
      
      // Explanation
      pipelineExplanation: {
        stage1: `Text Similarity / Lexical (${(aiSimilarities.textSimilarity * 100).toFixed(1)}%): Measures word/phrase overlap using cosine similarity and TF-IDF. This includes ALL text: generic terms, academic structure, methodology terms, and technology stack.`,
        stage2: `Concept Similarity / Semantic (${(aiSimilarities.conceptSimilarity * 100).toFixed(1)}%): AI evaluation of whether the CORE RESEARCH PROBLEM is the same. ${aiSimilarities.similarityRationale}`,
        overall: `Overall Assessment (${(aiSimilarities.overall * 100).toFixed(1)}%): Weighted blend of 30% text similarity + 70% concept similarity. Prioritizes concept similarity as it's more important for plagiarism detection.`,
        acceptance: `Acceptance Status: ${aiSimilarities.acceptanceStatus}. Research is ACCEPTABLE if concept similarity is below 40% (<40%). Similarity ≥40% indicates the research is too similar to existing work (REJECTED).`,
        note: 'IMPORTANT: Concept similarity reflects whether two researches address the same core problem, users, domain, and intent. Even with different tools/technologies, if the core problem is the same, concept similarity will be HIGH. The system is strict to prevent duplicate research efforts.'
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

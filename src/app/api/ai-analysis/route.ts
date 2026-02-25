import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getJson } from 'serpapi';

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
// SERPAPI WEB SEARCH HELPERS
// ============================================================================

interface SerpWebResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  source: string;
  date?: string;
}

async function serpSearchGoogle(query: string, numResults: number = 5): Promise<SerpWebResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await getJson({
      engine: 'google',
      q: query,
      api_key: apiKey,
      num: numResults,
      hl: 'en',
    });
    const organic = response.organic_results || [];
    return organic.map((r: any, i: number) => ({
      position: i + 1,
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
      source: r.displayed_link || r.source || '',
      date: r.date || undefined,
    }));
  } catch (err) {
    console.error('[SerpAPI Google]', err instanceof Error ? err.message : err);
    return [];
  }
}

async function serpSearchScholar(query: string, numResults: number = 5): Promise<SerpWebResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await getJson({
      engine: 'google_scholar',
      q: query,
      api_key: apiKey,
      num: numResults,
      hl: 'en',
    });
    const organic = response.organic_results || [];
    return organic.map((r: any, i: number) => ({
      position: i + 1,
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
      source: r.publication_info?.summary || r.displayed_link || '',
      date: r.publication_info?.summary?.match(/\d{4}/)?.[0] || undefined,
    }));
  } catch (err) {
    console.error('[SerpAPI Scholar]', err instanceof Error ? err.message : err);
    return [];
  }
}

// Verify match breakdown entries and text highlights using SerpAPI
async function verifySerpResults(
  matchEntries: Array<{ name: string; type: string; year: string; link: string; whyMatches: string[]; rubric: any; whatsDifferent: string[] }>,
  textHighlights: Array<{ matchedText: string; source: string; sourceUrl: string; matchType: string; similarity: number }>,
  proposedTitle: string
): Promise<{
  verifiedMatches: Array<{ name: string; type: string; year: string; link: string; whyMatches: string[]; rubric: any; whatsDifferent: string[]; serpVerified: boolean; serpResults: SerpWebResult[] }>;
  verifiedHighlights: Array<{ matchedText: string; source: string; sourceUrl: string; matchType: string; similarity: number; serpVerified: boolean; serpResults: SerpWebResult[]; scholarResults: SerpWebResult[] }>;
  webCitations: Array<{ title: string; url: string; snippet: string; source: string; foundVia: 'breakdown' | 'highlight' | 'title'; date?: string }>;
}> {
  const hasSerpApi = !!process.env.SERPAPI_API_KEY;
  
  if (!hasSerpApi) {
    console.log('[SerpAPI] No SERPAPI_API_KEY configured, skipping web verification');
    return {
      verifiedMatches: matchEntries.map(m => ({ ...m, serpVerified: false, serpResults: [] })),
      verifiedHighlights: textHighlights.map(h => ({ ...h, serpVerified: false, serpResults: [], scholarResults: [] })),
      webCitations: [],
    };
  }

  console.log(`[SerpAPI] Verifying ${matchEntries.length} matches and ${textHighlights.length} highlights`);
  const allCitations: Array<{ title: string; url: string; snippet: string; source: string; foundVia: 'breakdown' | 'highlight' | 'title'; date?: string }> = [];
  const seenUrls = new Set<string>();

  const addCitation = (result: SerpWebResult, via: 'breakdown' | 'highlight' | 'title') => {
    if (result.link && !seenUrls.has(result.link)) {
      seenUrls.add(result.link);
      allCitations.push({ title: result.title, url: result.link, snippet: result.snippet, source: result.source, foundVia: via, date: result.date });
    }
  };

  // 1. Search for the proposed title itself
  const titleResults = await serpSearchScholar(proposedTitle, 5).catch(() => []);
  titleResults.forEach(r => addCitation(r, 'title'));

  // 2. Verify match breakdown entries (search by name/title of each match)
  const MATCH_BATCH = 3;
  const verifiedMatches = [];
  for (let i = 0; i < matchEntries.length; i += MATCH_BATCH) {
    const batch = matchEntries.slice(i, i + MATCH_BATCH);
    const batchResults = await Promise.all(
      batch.map(async (entry) => {
        const query = entry.name.substring(0, 200);
        const [googleRes, scholarRes] = await Promise.all([
          serpSearchGoogle(`"${query}"`, 3).catch(() => [] as SerpWebResult[]),
          serpSearchScholar(query, 3).catch(() => [] as SerpWebResult[]),
        ]);
        const allResults = [...googleRes, ...scholarRes];
        allResults.forEach(r => addCitation(r, 'breakdown'));
        
        // Check if we found the exact source — update the link if the AI provided "N/A" or a broken link
        const bestResult = allResults[0];
        const verifiedLink = bestResult?.link || entry.link;
        
        return {
          ...entry,
          link: verifiedLink,
          serpVerified: allResults.length > 0,
          serpResults: allResults.slice(0, 5),
        };
      })
    );
    verifiedMatches.push(...batchResults);
    if (i + MATCH_BATCH < matchEntries.length) await new Promise(r => setTimeout(r, 400));
  }

  // 3. Verify text highlights (search by matched text phrases)
  const HIGHLIGHT_BATCH = 3;
  const verifiedHighlights = [];
  for (let i = 0; i < textHighlights.length; i += HIGHLIGHT_BATCH) {
    const batch = textHighlights.slice(i, i + HIGHLIGHT_BATCH);
    const batchResults = await Promise.all(
      batch.map(async (highlight) => {
        const searchText = highlight.matchedText.substring(0, 256);
        if (searchText.length < 10) {
          return { ...highlight, serpVerified: false, serpResults: [] as SerpWebResult[], scholarResults: [] as SerpWebResult[] };
        }
        const [googleRes, scholarRes] = await Promise.all([
          serpSearchGoogle(`"${searchText}"`, 3).catch(() => [] as SerpWebResult[]),
          serpSearchScholar(searchText, 3).catch(() => [] as SerpWebResult[]),
        ]);
        const allResults = [...googleRes, ...scholarRes];
        allResults.forEach(r => addCitation(r, 'highlight'));
        
        // Update sourceUrl if SerpAPI found a real one
        const bestResult = allResults[0];
        const verifiedUrl = bestResult?.link || highlight.sourceUrl;
        const verifiedSource = bestResult?.title || highlight.source;
        
        return {
          ...highlight,
          sourceUrl: verifiedUrl,
          source: highlight.source === 'Unknown Source' ? verifiedSource : highlight.source,
          serpVerified: allResults.length > 0,
          serpResults: googleRes.slice(0, 3),
          scholarResults: scholarRes.slice(0, 3),
        };
      })
    );
    verifiedHighlights.push(...batchResults);
    if (i + HIGHLIGHT_BATCH < textHighlights.length) await new Promise(r => setTimeout(r, 400));
  }

  console.log(`[SerpAPI] Verification complete. Found ${allCitations.length} unique web citations`);
  console.log(`[SerpAPI] Verified matches: ${verifiedMatches.filter(m => m.serpVerified).length}/${verifiedMatches.length}`);
  console.log(`[SerpAPI] Verified highlights: ${verifiedHighlights.filter(h => h.serpVerified).length}/${verifiedHighlights.length}`);

  return { verifiedMatches, verifiedHighlights, webCitations: allCitations };
}

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
"ROLE: You are a web-based research comparison checker.",
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
"=== MATCH BREAKDOWN & SOURCE LIST ===",
"",
"You are also a STRICT academic research novelty evaluator.",
"Using your training knowledge, find existing research papers, theses, journal articles, GitHub projects, and commercial apps that are conceptually similar to the PROPOSED STUDY above.",
"Compare the proposal with the closest matches and compute a concept-level similarity score for each.",
"Provide citations/references for every match.",
"",
"SEARCH RULES:",
"- Find ALL relevant sources you can identify (academic papers, theses, apps, GitHub projects, articles). Do NOT limit the number.",
"- Include sources from ANY year — old or new. Do not restrict by publication date.",
"- Ignore keyword-only matches; prioritize SAME PROBLEM + SAME OUTPUT + SAME WORKFLOW.",
"",
"For each match, output EXACTLY this format:",
"",
"MATCH [number]:",
"Name/Title: [title of the matching source]",
"Type: [Paper / Thesis / App / GitHub / Article]",
"Year: [year if available, otherwise N/A]",
"Link: [URL or citation reference]",
"Why It Matches:",
"- [bullet 1]",
"- [bullet 2]",
"- [bullet 3]",
"Similarity Rubric:",
"  Problem/Need: [X%]",
"  Objectives/Outputs: [X%]",
"  Inputs: [X%]",
"  Method/Tech: [X%]",
"  Users/Scope: [X%]",
"  Overall: [X%] (weighted: Problem 25%, Objectives 25%, Inputs 15%, Method 25%, Users 10%)",
"What Is Different:",
"- [bullet 1]",
"- [bullet 2]",
"",
"After listing ALL matches, provide:",
"",
"=== SIMILARITY CONCLUSION ===",
"[One paragraph summarizing overall similarity findings across all matches]",
"",
"Recommendations:",
"Write your recommendations using EXACTLY these four labeled sections. Use bullet points (-) for each item:",
"",
"MAIN ISSUES",
"List the biggest problems found (if any). If none, write: No major issues found.",
"- ...",
"- ...",
"- ...",
"",
"REQUIRED CHANGES",
"List the specific changes the researcher must make. If APPROVED, write: No required changes.",
"- ...",
"- ...",
"- ...",
"",
"SUGGESTED IMPROVEMENTS",
"Optional improvements to make the study stronger.",
"- ...",
"- ...",
"",
"STRENGTHS",
"What is already good and should be kept?",
"- ...",
"- ...",
"",
"=== TEXT MATCH HIGHLIGHTS ===",
"",
"IMPORTANT: You MUST use your web search / internet browsing capability to find REAL sources from the internet.",
"Search the web for phrases and sentences from the PROPOSED STUDY text below.",
"For each phrase or sentence (minimum 5 words), search the internet to check if similar or identical content exists on any website, published paper, thesis repository, journal, blog, or online resource.",
"",
"Rules for searching:",
"- Copy key phrases from the proposed text and search them on the web.",
"- Look for matches on Google Scholar, ResearchGate, academia.edu, university repositories, Semantic Scholar, journals, and general web pages.",
"- You MUST provide the ACTUAL URL of the source where you found the matching content. Do NOT guess or fabricate URLs.",
"- If you cannot find a real URL for a match, set Source URL to N/A.",
"- Identify ALL matching passages — do not limit the count.",
"",
"For each matching passage found on the internet, output EXACTLY this format:",
"",
"HIGHLIGHT [number]:",
"Matched Text: \"[exact quote from the PROPOSED STUDY text that matches]\"",
"Source: [name/title of the actual source found on the web]",
"Source URL: [the REAL, ACTUAL URL where you found this content — must be a valid link]",
"Match Type: [Exact Copy / Close Paraphrase / Patchwriting / Structural Copy / Common Knowledge]",
"Similarity: [percentage 0-100%]",
"",
"List ALL highlights you find from real internet sources. If no matching passages are found on the web, write:",
"No highlighted matches found — the text appears to be original.",
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
            // Use Responses API with web search for real internet source finding
            console.log(`[OpenAI] Using Responses API with web_search_preview for model: ${modelName}`);
            
            const response = await openai.responses.create({
              model: modelName,
              tools: [{ type: "web_search_preview" as const }],
              instructions: 'You are an expert academic research evaluator specializing in similarity analysis and plagiarism detection. You MUST use web search to find real sources from the internet when checking for text matches.',
              input: prompt,
              max_output_tokens: 8000,
            });
            
            // Extract text content from Responses API output
            const textParts: string[] = [];
            for (const item of response.output) {
              if (item.type === 'message' && item.content) {
                for (const block of item.content) {
                  if (block.type === 'output_text') {
                    textParts.push(block.text);
                  }
                }
              }
            }
            
            return textParts.join('') || null;
            
          } else if (provider === 'gemini') {
            // Gemini API call with Google Search grounding for real web sources
            console.log(`[Gemini] Using Google Search grounding for model: ${modelName}`);
            const model = genAI.getGenerativeModel({
              model: modelName,
              tools: [{
                googleSearchRetrieval: {
                  dynamicRetrievalConfig: {
                    mode: 'MODE_DYNAMIC' as any,
                    dynamicThreshold: 0.3,
                  },
                },
              } as any],
            });
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

    // ============================================================================
    // EXTRACT MATCH BREAKDOWN & SOURCE LIST from AI response
    // ============================================================================
    const matchBreakdownFullSection = analysis.match(/=== MATCH BREAKDOWN & SOURCE LIST ===([\s\S]*?)(?==== SIMILARITY CONCLUSION ===|$)/i)
      || analysis.match(/MATCH BREAKDOWN & SOURCE LIST[:\s]*([\s\S]*?)(?=SIMILARITY CONCLUSION|Recommendations:|$)/i);
    
    // Parse individual match cards
    const matchEntries: Array<{
      name: string;
      type: string;
      year: string;
      link: string;
      whyMatches: string[];
      rubric: {
        problem: number | null;
        objectives: number | null;
        inputs: number | null;
        method: number | null;
        users: number | null;
        overall: number | null;
      };
      whatsDifferent: string[];
    }> = [];
    
    if (matchBreakdownFullSection) {
      // Split into individual match blocks
      const matchBlocks = matchBreakdownFullSection[1].split(/MATCH\s*\d+\s*:/i).filter(b => b.trim());
      
      for (const block of matchBlocks) {
        const nameMatch = block.match(/Name\/Title:\s*([^\n]+)/i);
        const typeMatch = block.match(/Type:\s*([^\n]+)/i);
        const yearMatch = block.match(/Year:\s*([^\n]+)/i);
        const linkMatch = block.match(/Link:\s*([^\n]+)/i);
        
        // Extract "Why It Matches" bullets
        const whySection = block.match(/Why It Matches:[\s\S]*?(?=Similarity Rubric:|What Is Different:|MATCH\s*\d+:|$)/i);
        const whyBullets: string[] = [];
        if (whySection) {
          const bullets = whySection[0].match(/[-•]\s*([^\n]+)/g);
          if (bullets) bullets.forEach(b => whyBullets.push(b.replace(/^[-•]\s*/, '').trim()));
        }
        
        // Extract similarity rubric scores
        const problemScore = block.match(/Problem\/Need:\s*\[?(\d+(?:\.\d+)?)%?\]?/i);
        const objectivesScore = block.match(/Objectives\/Outputs:\s*\[?(\d+(?:\.\d+)?)%?\]?/i);
        const inputsScore = block.match(/Inputs:\s*\[?(\d+(?:\.\d+)?)%?\]?/i);
        const methodScore = block.match(/Method\/Tech:\s*\[?(\d+(?:\.\d+)?)%?\]?/i);
        const usersScore = block.match(/Users\/Scope:\s*\[?(\d+(?:\.\d+)?)%?\]?/i);
        const overallScore = block.match(/Overall:\s*\[?(\d+(?:\.\d+)?)%?\]?/i);
        
        // Extract "What Is Different" bullets
        const diffSection = block.match(/What Is Different:[\s\S]*?(?=MATCH\s*\d+:|=== |$)/i);
        const diffBullets: string[] = [];
        if (diffSection) {
          const bullets = diffSection[0].match(/[-•]\s*([^\n]+)/g);
          if (bullets) bullets.forEach(b => diffBullets.push(b.replace(/^[-•]\s*/, '').trim()));
        }
        
        if (nameMatch) {
          matchEntries.push({
            name: nameMatch[1].trim(),
            type: typeMatch ? typeMatch[1].trim() : 'Unknown',
            year: yearMatch ? yearMatch[1].trim() : 'N/A',
            link: linkMatch ? linkMatch[1].trim() : '',
            whyMatches: whyBullets,
            rubric: {
              problem: problemScore ? parseFloat(problemScore[1]) : null,
              objectives: objectivesScore ? parseFloat(objectivesScore[1]) : null,
              inputs: inputsScore ? parseFloat(inputsScore[1]) : null,
              method: methodScore ? parseFloat(methodScore[1]) : null,
              users: usersScore ? parseFloat(usersScore[1]) : null,
              overall: overallScore ? parseFloat(overallScore[1]) : null,
            },
            whatsDifferent: diffBullets,
          });
        }
      }
    }
    
    // Sort matches by overall similarity (highest first)
    matchEntries.sort((a, b) => (b.rubric.overall ?? 0) - (a.rubric.overall ?? 0));
    
    // Extract Similarity Conclusion
    const similarityConclusionMatch = analysis.match(/=== SIMILARITY CONCLUSION ===\s*([\s\S]*?)(?=Recommendations:|$)/i)
      || analysis.match(/SIMILARITY CONCLUSION[:\s]*([\s\S]*?)(?=Recommendations:|$)/i);
    const similarityConclusion = similarityConclusionMatch ? similarityConclusionMatch[1].trim() : '';
    
    // ============================================================================
    // EXTRACT TEXT MATCH HIGHLIGHTS from AI response
    // ============================================================================
    const textHighlights: Array<{
      matchedText: string;
      source: string;
      sourceUrl: string;
      matchType: string;
      similarity: number;
    }> = [];

    const highlightsSection = analysis.match(/=== TEXT MATCH HIGHLIGHTS ===([\s\S]*?)$/i)
      || analysis.match(/TEXT MATCH HIGHLIGHTS[:\s]*([\s\S]*?)$/i);

    if (highlightsSection) {
      const highlightBlocks = highlightsSection[1].split(/HIGHLIGHT\s*(?:\[?\d+\]?)\s*:/i).filter(b => b.trim());

      for (const block of highlightBlocks) {
        // Accept any quote style: ", ", “, ”, ', or no quotes at all
        let matchedTextMatch = block.match(/Matched Text:\s*["\u201c\u201d\u2018\u2019'`]([\s\S]*?)["\u201c\u201d\u2018\u2019'`]/i);
        if (!matchedTextMatch) {
          // Fallback: grab everything after "Matched Text:" until next field
          matchedTextMatch = block.match(/Matched Text:\s*(.+?)(?=\n\s*Source:|$)/i);
        }
        const sourceMatch = block.match(/Source:\s*(?!URL)([^\n]+)/i);
        const sourceUrlMatch = block.match(/Source URL:\s*([^\n]+)/i);
        const matchTypeMatch = block.match(/Match Type:\s*([^\n]+)/i);
        const similarityMatch = block.match(/Similarity:\s*(\d+(?:\.\d+)?)\s*%/i);

        if (matchedTextMatch && matchedTextMatch[1].trim().length >= 4) {
          // Clean the matched text - remove leading/trailing quotes and whitespace
          const cleanedText = matchedTextMatch[1].trim().replace(/^["\u201c\u201d'`]+|["\u201c\u201d'`]+$/g, '').trim();
          
          textHighlights.push({
            matchedText: cleanedText,
            source: sourceMatch ? sourceMatch[1].trim() : 'Unknown Source',
            sourceUrl: sourceUrlMatch ? sourceUrlMatch[1].trim() : 'N/A',
            matchType: matchTypeMatch ? matchTypeMatch[1].trim() : 'Unknown',
            similarity: similarityMatch ? parseFloat(similarityMatch[1]) : 0,
          });
        }
      }
    }

    console.log(`[Text Highlights] Found ${textHighlights.length} highlighted passages`);
    if (textHighlights.length > 0) {
      console.log(`[Text Highlights] First 3:`, textHighlights.slice(0, 3).map(h => ({ text: h.matchedText.substring(0, 50), type: h.matchType, source: h.source.substring(0, 40) })));
    }

    const fieldAssessment = {
      scores: fieldScores,
      rationales: fieldRationales,
      average: null as number | null
    };
    
    // ============================================================================
    // SERPAPI WEB VERIFICATION - Verify matches and highlights with real internet data
    // ============================================================================
    console.log('[SerpAPI] Starting web verification of AI-generated matches and highlights...');
    const serpVerification = await verifySerpResults(matchEntries, textHighlights, safeUserTitle);
    
    const matchBreakdown = {
      matches: serpVerification.verifiedMatches,
      conclusion: similarityConclusion,
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
    
    // Calculate overall similarity: equal-weight average of text and concept similarity
    // Text similarity (TF-IDF cosine) shows lexical/surface overlap
    // Concept similarity (AI-assessed) shows problem/research overlap
    // Overall = 50% text + 50% concept so neither inflates the final score on its own
    const adjustedOverall = Math.min((textSimilarity * 0.5) + (conceptSimilarity * 0.5), 1.0);

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
      
      // 4-Field Assessment
      fieldAssessment,
      
      // Match Breakdown & Source List (now SerpAPI-verified)
      matchBreakdown,
      
      // Text Match Highlights (now SerpAPI-verified)
      textHighlights: serpVerification.verifiedHighlights,
      
      // Web Citations from SerpAPI (real internet sources)
      webCitations: serpVerification.webCitations,
      
      // SerpAPI verification summary
      serpVerification: {
        enabled: !!process.env.SERPAPI_API_KEY,
        matchesVerified: serpVerification.verifiedMatches.filter(m => m.serpVerified).length,
        matchesTotal: serpVerification.verifiedMatches.length,
        highlightsVerified: serpVerification.verifiedHighlights.filter(h => h.serpVerified).length,
        highlightsTotal: serpVerification.verifiedHighlights.length,
        totalWebCitations: serpVerification.webCitations.length,
      },
      
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

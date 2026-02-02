import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// GEMINI RESEARCH SIMILARITY SCORING
// ============================================================================

export interface GeminiSimilarityScores {
  topic_similarity: number;
  objective_similarity: number;
  methodology_similarity: number;
  dataset_scope_similarity: number;
}

export interface GeminiSimilarityResult {
  scores: GeminiSimilarityScores;
  weightedPercentage: number;
  isValid: boolean;
  error?: string;
  rawResponse?: string;
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * System prompt for Gemini semantic similarity evaluation
 */
const SYSTEM_PROMPT = `You are an academic research evaluator.

Your task is to assess semantic similarity between a PROPOSED RESEARCH and an EXISTING THESIS.

You must score similarity using clearly defined academic dimensions.
This is NOT plagiarism detection.
Be conservative and objective.`;

/**
 * Generate the Gemini prompt for similarity scoring
 */
function generateSimilarityPrompt(
  proposedTitle: string,
  proposedText: string,
  thesisTitle: string,
  thesisText: string
): string {
  return `PROPOSED RESEARCH

Title:
${proposedTitle}

Abstract / Extracted Text:
${proposedText}


EXISTING THESIS

Title:
${thesisTitle}

Abstract / Extracted Text:
${thesisText}


SCORING INSTRUCTIONS

Score each category from 0.0 to 1.0 where:
0.0 = no meaningful similarity
0.5 = moderate semantic similarity
1.0 = nearly identical in meaning

Categories:
1. topic_similarity – overall research domain and focus
2. objective_similarity – research goals or questions
3. methodology_similarity – methods, algorithms, procedures, or approach
4. dataset_scope_similarity – data source, population, or scope

RULES:
- Use only the provided text
- Ignore references, citations, and common academic phrases
- Do NOT infer missing information
- Do NOT compute an overall percentage
- Do NOT explain or justify scores
- Output VALID JSON ONLY
- No markdown, no comments, no extra text

EXPECTED OUTPUT FORMAT (EXAMPLE):
{
  "topic_similarity": 0.78,
  "objective_similarity": 0.62,
  "methodology_similarity": 0.71,
  "dataset_scope_similarity": 0.40
}`;
}

/**
 * Validate Gemini response scores
 */
function validateScores(scores: any): { isValid: boolean; error?: string } {
  // Check if all required keys exist
  const requiredKeys = ['topic_similarity', 'objective_similarity', 'methodology_similarity', 'dataset_scope_similarity'];
  
  for (const key of requiredKeys) {
    if (!(key in scores)) {
      return { isValid: false, error: `Missing key: ${key}` };
    }
    
    const value = scores[key];
    
    // Check if value is a number
    if (typeof value !== 'number') {
      return { isValid: false, error: `${key} must be a number, got ${typeof value}` };
    }
    
    // Check if value is in range [0, 1]
    if (value < 0 || value > 1) {
      return { isValid: false, error: `${key} must be between 0 and 1, got ${value}` };
    }
  }
  
  return { isValid: true };
}

/**
 * Calculate weighted percentage from similarity scores
 * Formula: (topic * 30) + (objective * 25) + (methodology * 25) + (dataset_scope * 20)
 */
function calculateWeightedPercentage(scores: GeminiSimilarityScores): number {
  const weightedSum = 
    (scores.topic_similarity * 30) +
    (scores.objective_similarity * 25) +
    (scores.methodology_similarity * 25) +
    (scores.dataset_scope_similarity * 20);
  
  // Round to nearest integer
  return Math.round(weightedSum);
}

/**
 * Parse JSON response from Gemini, handling markdown code blocks
 */
function parseGeminiJSON(response: string): any {
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  
  // Remove ```json and ``` markers
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/, '');
  cleaned = cleaned.replace(/```\s*$/, '');
  
  // Trim again after removing markers
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Score semantic similarity between two research texts using Gemini
 * @param proposedTitle - Title of the proposed research
 * @param proposedText - Text content of the proposed research
 * @param thesisTitle - Title of the existing thesis
 * @param thesisText - Text content of the existing thesis
 * @param maxRetries - Number of retry attempts (default: 3 for stability)
 * @returns GeminiSimilarityResult with scores and weighted percentage
 */
export async function scoreSemanticSimilarity(
  proposedTitle: string,
  proposedText: string,
  thesisTitle: string,
  thesisText: string,
  maxRetries: number = 3
): Promise<GeminiSimilarityResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const prompt = generateSimilarityPrompt(proposedTitle, proposedText, thesisTitle, thesisText);
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;
  
  let attempts = 0;
  let lastError: Error | null = null;
  
  // Retry logic for stability
  while (attempts < maxRetries) {
    attempts++;
    
    try {
      console.log(`[Gemini Similarity] Attempt ${attempts}/${maxRetries}`);
      
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();
      
      console.log(`[Gemini Similarity] Raw response:`, text.substring(0, 200));
      
      // Parse JSON response
      const parsedScores = parseGeminiJSON(text);
      
      // Validate scores
      const validation = validateScores(parsedScores);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
      
      const scores: GeminiSimilarityScores = {
        topic_similarity: parsedScores.topic_similarity,
        objective_similarity: parsedScores.objective_similarity,
        methodology_similarity: parsedScores.methodology_similarity,
        dataset_scope_similarity: parsedScores.dataset_scope_similarity
      };
      
      const weightedPercentage = calculateWeightedPercentage(scores);
      
      console.log(`[Gemini Similarity] Success on attempt ${attempts}:`, {
        scores,
        weightedPercentage: `${weightedPercentage}%`
      });
      
      return {
        scores,
        weightedPercentage,
        isValid: true,
        rawResponse: text
      };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Gemini Similarity] Error on attempt ${attempts}:`, lastError.message);
      
      // If this is not the last attempt, wait before retrying
      if (attempts < maxRetries) {
        const waitTime = attempts * 1000; // Exponential backoff: 1s, 2s, 3s
        console.log(`[Gemini Similarity] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All retries failed
  console.error(`[Gemini Similarity] All ${maxRetries} attempts failed`);
  return {
    scores: {
      topic_similarity: 0,
      objective_similarity: 0,
      methodology_similarity: 0,
      dataset_scope_similarity: 0
    },
    weightedPercentage: 0,
    isValid: false,
    error: lastError?.message || 'Failed after all retry attempts'
  };
}

/**
 * Score similarity with multiple runs and average the results for improved stability
 * @param proposedTitle - Title of the proposed research
 * @param proposedText - Text content of the proposed research
 * @param thesisTitle - Title of the existing thesis
 * @param thesisText - Text content of the existing thesis
 * @param runs - Number of runs to perform (default: 2)
 * @returns GeminiSimilarityResult with averaged scores
 */
export async function scoreSemanticSimilarityWithAveraging(
  proposedTitle: string,
  proposedText: string,
  thesisTitle: string,
  thesisText: string,
  runs: number = 2
): Promise<GeminiSimilarityResult> {
  console.log(`[Gemini Similarity] Starting ${runs} runs for averaging...`);
  
  const results: GeminiSimilarityResult[] = [];
  
  for (let i = 0; i < runs; i++) {
    console.log(`[Gemini Similarity] Run ${i + 1}/${runs}`);
    const result = await scoreSemanticSimilarity(proposedTitle, proposedText, thesisTitle, thesisText, 2);
    
    if (result.isValid) {
      results.push(result);
    }
  }
  
  // If no valid results, return invalid result
  if (results.length === 0) {
    return {
      scores: {
        topic_similarity: 0,
        objective_similarity: 0,
        methodology_similarity: 0,
        dataset_scope_similarity: 0
      },
      weightedPercentage: 0,
      isValid: false,
      error: 'No valid results from any run'
    };
  }
  
  // Calculate average scores
  const avgScores: GeminiSimilarityScores = {
    topic_similarity: results.reduce((sum, r) => sum + r.scores.topic_similarity, 0) / results.length,
    objective_similarity: results.reduce((sum, r) => sum + r.scores.objective_similarity, 0) / results.length,
    methodology_similarity: results.reduce((sum, r) => sum + r.scores.methodology_similarity, 0) / results.length,
    dataset_scope_similarity: results.reduce((sum, r) => sum + r.scores.dataset_scope_similarity, 0) / results.length
  };
  
  const weightedPercentage = calculateWeightedPercentage(avgScores);
  
  console.log(`[Gemini Similarity] Averaged results from ${results.length} valid runs:`, {
    scores: avgScores,
    weightedPercentage: `${weightedPercentage}%`
  });
  
  return {
    scores: avgScores,
    weightedPercentage,
    isValid: true
  };
}

/**
 * Helper function to format scores for display
 */
export function formatScores(result: GeminiSimilarityResult): string {
  if (!result.isValid) {
    return `Error: ${result.error || 'Invalid result'}`;
  }
  
  return `
Gemini Semantic Similarity Scores:
- Topic Similarity: ${(result.scores.topic_similarity * 100).toFixed(1)}%
- Objective Similarity: ${(result.scores.objective_similarity * 100).toFixed(1)}%
- Methodology Similarity: ${(result.scores.methodology_similarity * 100).toFixed(1)}%
- Dataset/Scope Similarity: ${(result.scores.dataset_scope_similarity * 100).toFixed(1)}%

Weighted Overall Similarity: ${result.weightedPercentage}%
`;
}

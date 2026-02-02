import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// FAST SIMILARITY PIPELINE - Vector Search + Top-K Architecture
// ============================================================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Configuration
const CONFIG = {
  CHUNK_SIZE: 600,
  CHUNK_OVERLAP: 100,
  EARLY_THRESHOLD: 0.30,        // Skip if cosine < 30%
  TOP_K_CANDIDATES: 15,         // Only analyze top 15 matches
  TOP_K_FOR_GEMINI: 5,          // Only use Gemini on top 5
  MAX_PARALLEL: 5,              // Parallel operations limit
};

interface EmbeddingCache {
  text: string;
  embedding: number[];
  timestamp: number;
}

// Simple in-memory cache (upgrade to Redis in production)
const embeddingCache = new Map<string, EmbeddingCache>();
const CACHE_TTL = 3600000; // 1 hour

// ============================================================================
// STEP 1: PREPROCESSING & EMBEDDING
// ============================================================================

/**
 * Generate hash for cache key
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Clean text for embedding (remove references, boilerplate)
 */
function cleanText(text: string): string {
  let cleaned = text;
  
  // Remove references section
  const refMarkers = [/\n\s*references\s*\n/i, /\n\s*bibliography\s*\n/i];
  for (const marker of refMarkers) {
    const match = cleaned.match(marker);
    if (match?.index) {
      cleaned = cleaned.substring(0, match.index);
      break;
    }
  }
  
  // Remove common boilerplate
  cleaned = cleaned.replace(/this research uses?/gi, '');
  cleaned = cleaned.replace(/this study employs?/gi, '');
  cleaned = cleaned.replace(/the methodology includes?/gi, '');
  
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Create chunks from text
 */
function chunkText(text: string, chunkSize = 600, overlap = 100): string[] {
  const tokens = text.split(/\s+/);
  const chunks: string[] = [];
  
  let startIdx = 0;
  while (startIdx < tokens.length) {
    const endIdx = Math.min(startIdx + chunkSize, tokens.length);
    chunks.push(tokens.slice(startIdx, endIdx).join(' '));
    
    if (endIdx >= tokens.length) break;
    startIdx += chunkSize - overlap;
  }
  
  return chunks;
}

/**
 * Generate embedding with caching
 */
async function generateEmbedding(text: string, useCache = true): Promise<number[]> {
  const cacheKey = hashText(text);
  
  // Check cache
  if (useCache && embeddingCache.has(cacheKey)) {
    const cached = embeddingCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Embedding] Cache hit');
      return cached.embedding;
    }
  }
  
  // Generate new embedding
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  
  try {
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    
    // Cache it
    embeddingCache.set(cacheKey, {
      text: text.substring(0, 100), // Store preview only
      embedding,
      timestamp: Date.now(),
    });
    
    return embedding;
  } catch (error) {
    console.error('[Embedding] Error:', error);
    throw error;
  }
}

/**
 * Generate embeddings for all chunks in parallel
 */
async function generateChunkEmbeddings(chunks: string[]): Promise<number[][]> {
  console.log(`[Pipeline] Generating embeddings for ${chunks.length} chunks...`);
  
  const embeddings: number[][] = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < chunks.length; i += CONFIG.MAX_PARALLEL) {
    const batch = chunks.slice(i, i + CONFIG.MAX_PARALLEL);
    
    const batchEmbeddings = await Promise.all(
      batch.map(chunk => generateEmbedding(chunk))
    );
    
    embeddings.push(...batchEmbeddings);
  }
  
  return embeddings;
}

// ============================================================================
// STEP 2: VECTOR COSINE SIMILARITY
// ============================================================================

/**
 * Fast cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dot = 0, magA = 0, magB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

/**
 * Compute average embedding from chunk embeddings
 */
function averageEmbedding(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  
  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }
  
  for (let i = 0; i < dim; i++) {
    avg[i] /= embeddings.length;
  }
  
  return avg;
}

// ============================================================================
// STEP 3: FAST VECTOR SEARCH (Simulated - Use pgvector in production)
// ============================================================================

interface VectorSearchResult {
  id: string;
  title: string;
  thesis_brief: string;
  year?: number;
  course?: string;
  researchers?: string[];
  distance: number;
  similarity: number;
}

/**
 * Fast vector search to find Top-K candidates
 * In production: Use pgvector with IVFFlat index
 */
async function vectorSearch(
  queryEmbedding: number[],
  existingResearches: Array<{
    id: string;
    title: string;
    thesis_brief: string;
    year?: number;
    course?: string;
    researchers?: string[];
  }>,
  topK: number = CONFIG.TOP_K_CANDIDATES
): Promise<VectorSearchResult[]> {
  console.log(`[Vector Search] Searching ${existingResearches.length} researches for Top-${topK}...`);
  
  const results: VectorSearchResult[] = [];
  
  // Process in parallel batches
  for (let i = 0; i < existingResearches.length; i += CONFIG.MAX_PARALLEL) {
    const batch = existingResearches.slice(i, i + CONFIG.MAX_PARALLEL);
    
    const batchResults = await Promise.all(
      batch.map(async (research) => {
        try {
          // Generate embedding for thesis (in production: retrieve from pgvector)
          const cleanedText = cleanText(research.thesis_brief);
          const thesisEmbedding = await generateEmbedding(cleanedText);
          
          // Calculate similarity
          const similarity = cosineSimilarity(queryEmbedding, thesisEmbedding);
          const distance = 1 - similarity; // Convert to distance
          
          return {
            ...research,
            distance,
            similarity,
          };
        } catch (error) {
          console.error(`[Vector Search] Error processing ${research.title}:`, error);
          return {
            ...research,
            distance: 1,
            similarity: 0,
          };
        }
      })
    );
    
    results.push(...batchResults);
  }
  
  // Sort by distance (ascending) and take Top-K
  const topResults = results
    .sort((a, b) => a.distance - b.distance)
    .slice(0, topK);
  
  console.log(`[Vector Search] Found Top-${topK} candidates with similarities:`, 
    topResults.map(r => `${r.similarity.toFixed(3)}`).join(', ')
  );
  
  return topResults;
}

// ============================================================================
// STEP 4: EARLY THRESHOLD FILTERING
// ============================================================================

/**
 * Filter candidates by early threshold
 */
function applyEarlyThreshold(
  candidates: VectorSearchResult[],
  threshold: number = CONFIG.EARLY_THRESHOLD
): VectorSearchResult[] {
  const filtered = candidates.filter(c => c.similarity >= threshold);
  
  const removed = candidates.length - filtered.length;
  if (removed > 0) {
    console.log(`[Early Filter] Removed ${removed} candidates below ${threshold} threshold`);
  }
  
  return filtered;
}

// ============================================================================
// STEP 5: DETAILED CHUNK-LEVEL ANALYSIS (Only for Top-K)
// ============================================================================

interface DetailedAnalysis {
  id: string;
  title: string;
  avgSimilarity: number;
  maxSimilarity: number;
  finalSimilarity: number;
  percentage: number;
  interpretation: string;
}

/**
 * Perform detailed chunk-level analysis for a candidate
 */
async function analyzeCandidate(
  proposedChunks: string[],
  proposedEmbeddings: number[][],
  candidate: VectorSearchResult
): Promise<DetailedAnalysis> {
  // Chunk the candidate thesis
  const candidateChunks = chunkText(cleanText(candidate.thesis_brief), CONFIG.CHUNK_SIZE, CONFIG.CHUNK_OVERLAP);
  
  // Generate embeddings for candidate chunks
  const candidateEmbeddings = await generateChunkEmbeddings(candidateChunks);
  
  // Calculate all chunk similarities
  const similarities: number[] = [];
  for (const pEmb of proposedEmbeddings) {
    for (const cEmb of candidateEmbeddings) {
      similarities.push(cosineSimilarity(pEmb, cEmb));
    }
  }
  
  // Aggregate: 60% avg + 40% max
  const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  const maxSimilarity = Math.max(...similarities);
  const finalSimilarity = 0.6 * avgSimilarity + 0.4 * maxSimilarity;
  
  const percentage = Math.round(finalSimilarity * 100);
  
  let interpretation = 'Unrelated';
  if (finalSimilarity >= 0.8) interpretation = 'Very high similarity';
  else if (finalSimilarity >= 0.6) interpretation = 'High similarity';
  else if (finalSimilarity >= 0.4) interpretation = 'Moderate similarity';
  else if (finalSimilarity >= 0.2) interpretation = 'Slight similarity';
  
  return {
    id: candidate.id,
    title: candidate.title,
    avgSimilarity,
    maxSimilarity,
    finalSimilarity,
    percentage,
    interpretation,
  };
}

/**
 * Analyze multiple candidates in parallel
 */
async function analyzeTopCandidates(
  proposedChunks: string[],
  proposedEmbeddings: number[][],
  candidates: VectorSearchResult[]
): Promise<DetailedAnalysis[]> {
  console.log(`[Detailed Analysis] Analyzing ${candidates.length} candidates...`);
  
  const results: DetailedAnalysis[] = [];
  
  // Process in batches
  for (let i = 0; i < candidates.length; i += CONFIG.MAX_PARALLEL) {
    const batch = candidates.slice(i, i + CONFIG.MAX_PARALLEL);
    
    const batchResults = await Promise.all(
      batch.map(candidate => analyzeCandidate(proposedChunks, proposedEmbeddings, candidate))
    );
    
    results.push(...batchResults);
  }
  
  return results.sort((a, b) => b.finalSimilarity - a.finalSimilarity);
}

// ============================================================================
// STEP 6: GEMINI AI VALIDATION (Only for Top 5-10)
// ============================================================================

import { scoreSemanticSimilarity, GeminiSimilarityResult } from './gemini-similarity';

/**
 * Run Gemini validation on top matches only
 */
async function geminiValidation(
  proposedTitle: string,
  proposedText: string,
  topMatches: Array<{ title: string; thesis_brief: string; analysis: DetailedAnalysis }>,
  topN: number = CONFIG.TOP_K_FOR_GEMINI
): Promise<Array<{ analysis: DetailedAnalysis; geminiResult?: GeminiSimilarityResult }>> {
  const matchesToValidate = topMatches.slice(0, topN);
  
  console.log(`[Gemini Validation] Running Gemini on top ${matchesToValidate.length} matches...`);
  
  const results = [];
  
  for (const match of matchesToValidate) {
    try {
      const geminiResult = await scoreSemanticSimilarity(
        proposedTitle,
        proposedText,
        match.title,
        match.thesis_brief,
        2 // retries
      );
      
      results.push({
        analysis: match.analysis,
        geminiResult: geminiResult.isValid ? geminiResult : undefined,
      });
    } catch (error) {
      console.error(`[Gemini Validation] Error for ${match.title}:`, error);
      results.push({
        analysis: match.analysis,
        geminiResult: undefined,
      });
    }
  }
  
  return results;
}

// ============================================================================
// MAIN FAST PIPELINE
// ============================================================================

export interface FastPipelineResult {
  topCandidates: Array<{
    id: string;
    title: string;
    thesis_brief: string;
    year?: number;
    course?: string;
    researchers?: string[];
    // Vector search
    vectorSimilarity: number;
    // Detailed analysis
    avgSimilarity: number;
    maxSimilarity: number;
    finalSimilarity: number;
    percentage: number;
    interpretation: string;
    // Gemini (if in top N)
    geminiScores?: {
      topicSimilarity: number;
      objectiveSimilarity: number;
      methodologySimilarity: number;
      datasetScopeSimilarity: number;
      weightedPercentage: number;
    };
  }>;
  performance: {
    totalTime: number;
    embeddingTime: number;
    vectorSearchTime: number;
    detailedAnalysisTime: number;
    geminiTime: number;
    candidatesTotal: number;
    candidatesAfterThreshold: number;
    candidatesAnalyzed: number;
    candidatesWithGemini: number;
  };
}

/**
 * FAST SIMILARITY PIPELINE
 * 
 * Architecture:
 * 1. Preprocess & embed proposed research (once)
 * 2. Vector search for Top-K candidates
 * 3. Early threshold filtering
 * 4. Detailed chunk analysis (Top-K only)
 * 5. Gemini validation (Top 5-10 only)
 * 6. Final ranking
 */
export async function fastSimilarityPipeline(
  proposedTitle: string,
  proposedText: string,
  existingResearches: Array<{
    id: string;
    title: string;
    thesis_brief: string;
    year?: number;
    course?: string;
    researchers?: string[];
  }>,
  topK?: number // Optional parameter to override default TOP_K
): Promise<FastPipelineResult> {
  const startTime = Date.now();
  let embeddingTime = 0, vectorSearchTime = 0, detailedAnalysisTime = 0, geminiTime = 0;
  
  // Use custom topK or default
  const candidateLimit = topK || CONFIG.TOP_K_CANDIDATES;
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FAST SIMILARITY PIPELINE');
  console.log('═══════════════════════════════════════════════════════');
  
  // ============================================================
  // STEP 1: Preprocess & Embed Proposed Research
  // ============================================================
  let stepStart = Date.now();
  console.log('\n[STEP 1] Preprocessing & Embedding Proposed Research');
  
  const cleanedProposed = cleanText(proposedText);
  const proposedChunks = chunkText(cleanedProposed, CONFIG.CHUNK_SIZE, CONFIG.CHUNK_OVERLAP);
  console.log(`  → Created ${proposedChunks.length} chunks`);
  
  const proposedEmbeddings = await generateChunkEmbeddings(proposedChunks);
  const proposedAvgEmbedding = averageEmbedding(proposedEmbeddings);
  
  embeddingTime = Date.now() - stepStart;
  console.log(`  → Completed in ${embeddingTime}ms`);
  
  // ============================================================
  // STEP 2: Vector Search for Top-K Candidates
  // ============================================================
  stepStart = Date.now();
  console.log(`\n[STEP 2] Vector Search for Top-${candidateLimit}`);
  
  const topCandidates = await vectorSearch(
    proposedAvgEmbedding,
    existingResearches,
    candidateLimit
  );
  
  vectorSearchTime = Date.now() - stepStart;
  console.log(`  → Found ${topCandidates.length} candidates in ${vectorSearchTime}ms`);
  
  // ============================================================
  // STEP 3: Early Threshold Filtering
  // ============================================================
  console.log(`\n[STEP 3] Early Threshold Filtering (>=${CONFIG.EARLY_THRESHOLD})`);
  
  const filteredCandidates = applyEarlyThreshold(topCandidates, CONFIG.EARLY_THRESHOLD);
  console.log(`  → ${filteredCandidates.length} candidates passed threshold`);
  
  if (filteredCandidates.length === 0) {
    console.log('\n  ⚠️  No candidates above threshold. Returning empty results.');
    return {
      topCandidates: [],
      performance: {
        totalTime: Date.now() - startTime,
        embeddingTime,
        vectorSearchTime,
        detailedAnalysisTime: 0,
        geminiTime: 0,
        candidatesTotal: existingResearches.length,
        candidatesAfterThreshold: 0,
        candidatesAnalyzed: 0,
        candidatesWithGemini: 0,
      },
    };
  }
  
  // ============================================================
  // STEP 4: Detailed Chunk-Level Analysis (Top-K only)
  // ============================================================
  stepStart = Date.now();
  console.log(`\n[STEP 4] Detailed Analysis on ${filteredCandidates.length} candidates`);
  
  const detailedAnalyses = await analyzeTopCandidates(
    proposedChunks,
    proposedEmbeddings,
    filteredCandidates
  );
  
  detailedAnalysisTime = Date.now() - stepStart;
  console.log(`  → Completed in ${detailedAnalysisTime}ms`);
  
  // ============================================================
  // STEP 5: Gemini Validation (Top 5-10 only)
  // ============================================================
  stepStart = Date.now();
  console.log(`\n[STEP 5] Gemini Validation on Top ${CONFIG.TOP_K_FOR_GEMINI}`);
  
  const topMatchesWithDetails = detailedAnalyses.slice(0, CONFIG.TOP_K_FOR_GEMINI).map((analysis, idx) => ({
    ...filteredCandidates[idx],
    analysis,
  }));
  
  const geminiResults = await geminiValidation(
    proposedTitle,
    cleanedProposed,
    topMatchesWithDetails,
    CONFIG.TOP_K_FOR_GEMINI
  );
  
  geminiTime = Date.now() - stepStart;
  console.log(`  → Completed in ${geminiTime}ms`);
  
  // ============================================================
  // STEP 6: Final Ranking & Result Assembly
  // ============================================================
  console.log('\n[STEP 6] Final Ranking');
  
  const finalResults = detailedAnalyses.map((analysis, idx) => {
    const candidate = filteredCandidates.find(c => c.id === analysis.id)!;
    const geminiResult = geminiResults.find(g => g.analysis.id === analysis.id);
    
    return {
      id: candidate.id,
      title: candidate.title,
      thesis_brief: candidate.thesis_brief,
      year: candidate.year,
      course: candidate.course,
      researchers: candidate.researchers,
      vectorSimilarity: candidate.similarity,
      avgSimilarity: analysis.avgSimilarity,
      maxSimilarity: analysis.maxSimilarity,
      finalSimilarity: analysis.finalSimilarity,
      percentage: analysis.percentage,
      interpretation: analysis.interpretation,
      geminiScores: geminiResult?.geminiResult?.isValid ? {
        topicSimilarity: geminiResult.geminiResult.scores.topic_similarity,
        objectiveSimilarity: geminiResult.geminiResult.scores.objective_similarity,
        methodologySimilarity: geminiResult.geminiResult.scores.methodology_similarity,
        datasetScopeSimilarity: geminiResult.geminiResult.scores.dataset_scope_similarity,
        weightedPercentage: geminiResult.geminiResult.weightedPercentage,
      } : undefined,
    };
  });
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  PIPELINE COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total Time: ${totalTime}ms (~${(totalTime / 1000).toFixed(1)}s)`);
  console.log(`  Embedding: ${embeddingTime}ms`);
  console.log(`  Vector Search: ${vectorSearchTime}ms`);
  console.log(`  Detailed Analysis: ${detailedAnalysisTime}ms`);
  console.log(`  Gemini Validation: ${geminiTime}ms`);
  console.log(`  Speedup: ~${Math.round((existingResearches.length * 3000) / totalTime)}x faster`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  return {
    topCandidates: finalResults,
    performance: {
      totalTime,
      embeddingTime,
      vectorSearchTime,
      detailedAnalysisTime,
      geminiTime,
      candidatesTotal: existingResearches.length,
      candidatesAfterThreshold: filteredCandidates.length,
      candidatesAnalyzed: detailedAnalyses.length,
      candidatesWithGemini: geminiResults.length,
    },
  };
}

/**
 * Clear embedding cache (useful for testing)
 */
export function clearEmbeddingCache() {
  embeddingCache.clear();
  console.log('[Cache] Cleared embedding cache');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: embeddingCache.size,
    entries: Array.from(embeddingCache.entries()).map(([key, value]) => ({
      key,
      preview: value.text,
      age: Date.now() - value.timestamp,
    })),
  };
}

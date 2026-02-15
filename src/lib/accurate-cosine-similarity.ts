import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// ACCURATE COSINE SIMILARITY WITH GEMINI EMBEDDINGS
// ============================================================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================================================
// TEXT PREPROCESSING
// ============================================================================

/**
 * Remove references section from academic text
 */
function removeReferences(text: string): string {
  // Common reference section markers
  const referenceMarkers = [
    /\n\s*references\s*\n/i,
    /\n\s*bibliography\s*\n/i,
    /\n\s*works cited\s*\n/i,
    /\n\s*citations\s*\n/i,
  ];

  let cleanText = text;
  for (const marker of referenceMarkers) {
    const match = text.match(marker);
    if (match && match.index) {
      cleanText = text.substring(0, match.index);
      break;
    }
  }

  return cleanText;
}

/**
 * Remove common methodology boilerplate
 */
function removeBoilerplate(text: string): string {
  // Common phrases that inflate similarity
  const boilerplatePatterns = [
    /this research uses?/gi,
    /this study employs?/gi,
    /the methodology includes?/gi,
    /data was collected/gi,
    /participants were recruited/gi,
    /the results show/gi,
    /in conclusion/gi,
  ];

  let cleanText = text;
  for (const pattern of boilerplatePatterns) {
    cleanText = cleanText.replace(pattern, '');
  }

  return cleanText;
}

/**
 * Detect and penalize identical phrases (> N tokens)
 */
function detectIdenticalPhrases(text1: string, text2: string, minTokens: number = 3): number {
  const tokens1 = text1.toLowerCase().split(/\s+/);
  const tokens2 = text2.toLowerCase().split(/\s+/);

  let identicalPhraseCount = 0;

  // Sliding window to find identical phrases
  for (let i = 0; i <= tokens1.length - minTokens; i++) {
    const phrase = tokens1.slice(i, i + minTokens).join(' ');
    const phrase2Text = tokens2.join(' ');

    if (phrase2Text.includes(phrase)) {
      identicalPhraseCount++;
    }
  }

  // Calculate penalty factor (0.0 to 0.2)
  // More identical phrases = higher penalty
  const totalPhrases = Math.max(tokens1.length - minTokens + 1, 1);
  const penaltyFactor = Math.min((identicalPhraseCount / totalPhrases) * 0.1, 0.1);

  return penaltyFactor;
}

/**
 * Preprocess text for accurate similarity
 */
function preprocessText(text: string): string {
  let cleaned = text;

  // Remove references section
  cleaned = removeReferences(cleaned);

  // Remove common boilerplate
  cleaned = removeBoilerplate(cleaned);

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// ============================================================================
// TEXT CHUNKING
// ============================================================================

interface TextChunk {
  text: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Split text into chunks with overlap
 * @param text - Input text
 * @param chunkSize - Tokens per chunk (500-800 recommended)
 * @param overlap - Token overlap between chunks (100 recommended)
 */
function chunkText(text: string, chunkSize: number = 400, overlap: number = 150): TextChunk[] {
  const tokens = text.split(/\s+/);
  const chunks: TextChunk[] = [];

  if (tokens.length === 0) return chunks;

  let startIdx = 0;

  while (startIdx < tokens.length) {
    const endIdx = Math.min(startIdx + chunkSize, tokens.length);
    const chunkTokens = tokens.slice(startIdx, endIdx);
    const chunkText = chunkTokens.join(' ');

    chunks.push({
      text: chunkText,
      startIndex: startIdx,
      endIndex: endIdx,
    });

    // If we've reached the end, break
    if (endIdx >= tokens.length) break;

    // Move forward by (chunkSize - overlap)
    startIdx += chunkSize - overlap;
  }

  return chunks;
}

// ============================================================================
// VECTOR-LEVEL COSINE SIMILARITY
// ============================================================================

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  if (a.length === 0) return 0;

  // Dot product
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);

  // Magnitudes
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));

  // Avoid division by zero
  if (magA === 0 || magB === 0) return 0;

  // Cosine similarity
  const similarity = dot / (magA * magB);

  // Clamp to [-1, 1] (should already be in range, but safety)
  return Math.max(-1, Math.min(1, similarity));
}

// ============================================================================
// GEMINI EMBEDDINGS
// ============================================================================

/**
 * Generate embedding for a single text chunk using Gemini
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  try {
    const result = await model.embedContent(text);
    const embedding = result.embedding;

    if (!embedding || !embedding.values || embedding.values.length === 0) {
      throw new Error('Invalid embedding response');
    }

    return embedding.values;
  } catch (error) {
    console.error('[Embedding] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for all chunks with retry logic
 */
async function generateChunkEmbeddings(
  chunks: TextChunk[],
  maxRetries: number = 2
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const chunk of chunks) {
    let attempts = 0;
    let success = false;

    while (attempts < maxRetries && !success) {
      try {
        const embedding = await generateEmbedding(chunk.text);
        embeddings.push(embedding);
        success = true;
      } catch (error) {
        attempts++;
        console.error(`[Embedding] Attempt ${attempts}/${maxRetries} failed for chunk`);

        if (attempts < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, attempts * 1000));
        }
      }
    }

    if (!success) {
      // If all retries failed, use zero vector as fallback
      console.error('[Embedding] All retries failed, using zero vector');
      embeddings.push([]);
    }
  }

  return embeddings;
}

// ============================================================================
// DOCUMENT-LEVEL SIMILARITY
// ============================================================================

/**
 * Compute document-level cosine similarity with proper aggregation
 * Formula: (0.6 × avg) + (0.4 × max)
 */
function computeDocumentSimilarity(
  embeddings1: number[][],
  embeddings2: number[][]
): {
  avgSimilarity: number;
  maxSimilarity: number;
  finalSimilarity: number;
  chunkSimilarities: number[];
} {
  const chunkSimilarities: number[] = [];

  // Compare each chunk from doc1 with each chunk from doc2
  for (const emb1 of embeddings1) {
    if (emb1.length === 0) continue;

    for (const emb2 of embeddings2) {
      if (emb2.length === 0) continue;

      const similarity = cosineSimilarity(emb1, emb2);
      chunkSimilarities.push(similarity);
    }
  }

  if (chunkSimilarities.length === 0) {
    return {
      avgSimilarity: 0,
      maxSimilarity: 0,
      finalSimilarity: 0,
      chunkSimilarities: [],
    };
  }

  // Calculate average and max
  const avgSimilarity = chunkSimilarities.reduce((sum, s) => sum + s, 0) / chunkSimilarities.length;
  const maxSimilarity = Math.max(...chunkSimilarities);

  // Final similarity: 40% avg + 60% max (strict: emphasize highest overlap)
  const finalSimilarity = 0.4 * avgSimilarity + 0.6 * maxSimilarity;

  return {
    avgSimilarity,
    maxSimilarity,
    finalSimilarity,
    chunkSimilarities,
  };
}

// ============================================================================
// CALIBRATION & PERCENTAGE CONVERSION
// ============================================================================

/**
 * Convert cosine similarity to percentage with calibration
 */
function toPercentage(cosine: number, identicalPhrasePenalty: number = 0): number {
  // Clamp to [0, 1]
  let calibrated = Math.min(Math.max(cosine, 0), 1);

  // Apply penalty for identical phrases
  calibrated = Math.max(0, calibrated - identicalPhrasePenalty);

  // Convert to percentage
  const percentage = Math.round(calibrated * 100);

  return percentage;
}

/**
 * Get academic interpretation of cosine similarity
 */
function interpretSimilarity(cosine: number): string {
  if (cosine < 0.15) return 'Unrelated';
  if (cosine < 0.30) return 'Slight similarity';
  if (cosine < 0.50) return 'Moderate similarity';
  if (cosine < 0.70) return 'High similarity';
  return 'Very high similarity';
}

// ============================================================================
// MAIN FUNCTION: ACCURATE COSINE SIMILARITY
// ============================================================================

export interface AccurateCosineResult {
  avgSimilarity: number;
  maxSimilarity: number;
  finalSimilarity: number;
  percentage: number;
  interpretation: string;
  chunkCount1: number;
  chunkCount2: number;
  identicalPhrasePenalty: number;
  processingTime: number;
}

/**
 * Calculate accurate cosine similarity between two research texts
 * Uses Gemini embeddings, proper chunking, and calibrated aggregation
 */
export async function calculateAccurateCosine(
  text1: string,
  text2: string,
  chunkSize: number = 400,
  overlap: number = 150
): Promise<AccurateCosineResult> {
  const startTime = Date.now();

  console.log('[Accurate Cosine] Starting similarity calculation...');

  // Step 1: Preprocess texts
  console.log('[Accurate Cosine] Preprocessing texts...');
  const clean1 = preprocessText(text1);
  const clean2 = preprocessText(text2);

  // Step 2: Detect identical phrases for penalty
  console.log('[Accurate Cosine] Detecting identical phrases...');
  const identicalPhrasePenalty = detectIdenticalPhrases(clean1, clean2, 3);
  console.log(`[Accurate Cosine] Identical phrase penalty: ${(identicalPhrasePenalty * 100).toFixed(2)}%`);

  // Step 3: Chunk texts
  console.log('[Accurate Cosine] Chunking texts...');
  const chunks1 = chunkText(clean1, chunkSize, overlap);
  const chunks2 = chunkText(clean2, chunkSize, overlap);
  console.log(`[Accurate Cosine] Created ${chunks1.length} chunks for text1, ${chunks2.length} chunks for text2`);

  // Step 4: Generate embeddings
  console.log('[Accurate Cosine] Generating embeddings...');
  const embeddings1 = await generateChunkEmbeddings(chunks1);
  const embeddings2 = await generateChunkEmbeddings(chunks2);
  console.log('[Accurate Cosine] Embeddings generated successfully');

  // Step 5: Compute document-level similarity
  console.log('[Accurate Cosine] Computing document similarity...');
  const similarity = computeDocumentSimilarity(embeddings1, embeddings2);

  // Step 6: Convert to percentage with calibration
  const percentage = toPercentage(similarity.finalSimilarity, identicalPhrasePenalty);
  const interpretation = interpretSimilarity(similarity.finalSimilarity);

  const processingTime = Date.now() - startTime;

  console.log('[Accurate Cosine] Results:', {
    avgSimilarity: similarity.avgSimilarity.toFixed(4),
    maxSimilarity: similarity.maxSimilarity.toFixed(4),
    finalSimilarity: similarity.finalSimilarity.toFixed(4),
    percentage: `${percentage}%`,
    interpretation,
    processingTime: `${processingTime}ms`,
  });

  return {
    avgSimilarity: similarity.avgSimilarity,
    maxSimilarity: similarity.maxSimilarity,
    finalSimilarity: similarity.finalSimilarity,
    percentage,
    interpretation,
    chunkCount1: chunks1.length,
    chunkCount2: chunks2.length,
    identicalPhrasePenalty,
    processingTime,
  };
}

/**
 * Batch calculation for multiple comparisons
 */
export async function calculateAccurateCosineBatch(
  proposedText: string,
  existingTexts: Array<{ id: string; text: string; title: string }>
): Promise<Array<{ id: string; title: string; result: AccurateCosineResult }>> {
  console.log(`[Accurate Cosine Batch] Processing ${existingTexts.length} comparisons...`);

  const results = [];

  for (const existing of existingTexts) {
    console.log(`[Accurate Cosine Batch] Comparing with: ${existing.title.substring(0, 50)}...`);

    try {
      const result = await calculateAccurateCosine(proposedText, existing.text);
      results.push({
        id: existing.id,
        title: existing.title,
        result,
      });
    } catch (error) {
      console.error(`[Accurate Cosine Batch] Error comparing with ${existing.title}:`, error);
      // Push error result
      results.push({
        id: existing.id,
        title: existing.title,
        result: {
          avgSimilarity: 0,
          maxSimilarity: 0,
          finalSimilarity: 0,
          percentage: 0,
          interpretation: 'Error',
          chunkCount1: 0,
          chunkCount2: 0,
          identicalPhrasePenalty: 0,
          processingTime: 0,
        },
      });
    }
  }

  console.log(`[Accurate Cosine Batch] Batch processing complete`);
  return results;
}

/**
 * Helper function to format results for display
 */
export function formatAccurateCosineResult(result: AccurateCosineResult): string {
  return `
Accurate Cosine Similarity Analysis:
────────────────────────────────────────────────
Average Similarity:        ${(result.avgSimilarity * 100).toFixed(2)}%
Maximum Similarity:        ${(result.maxSimilarity * 100).toFixed(2)}%
Final Similarity (60-40):  ${(result.finalSimilarity * 100).toFixed(2)}%
Calibrated Percentage:     ${result.percentage}%
Interpretation:            ${result.interpretation}
────────────────────────────────────────────────
Chunks Analyzed:           ${result.chunkCount1} × ${result.chunkCount2} = ${result.chunkCount1 * result.chunkCount2} comparisons
Identical Phrase Penalty:  ${(result.identicalPhrasePenalty * 100).toFixed(2)}%
Processing Time:           ${result.processingTime}ms
`;
}

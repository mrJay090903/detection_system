/**
 * TF-IDF Vector Generation and Comparison Utilities
 * Precompute and store TF-IDF vectors for fast similarity checking
 */

// Stop words to filter out (including common research terms)
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
  'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'about', 'into', 'through', 'during', 'including', 'against', 'among',
  'throughout', 'despite', 'towards', 'upon', 'concerning', 'using',
  // Common research/academic terms
  'system', 'application', 'app', 'web', 'based', 'using', 'use', 'users',
  'development', 'study', 'research', 'analysis', 'design', 'implementation',
  'project', 'thesis', 'paper', 'work', 'data', 'information', 'process',
  'method', 'approach', 'technique', 'result', 'results', 'conclusion',
  'proposed', 'provide', 'provides', 'help', 'helps', 'improve', 'improves',
  'develop', 'developed', 'create', 'created', 'build', 'built', 'make', 'makes'
])

/**
 * Normalize and tokenize text
 */
export function normalizeText(text: string): string[] {
  if (!text) return []
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Keep only alphanumeric
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(word => word.length >= 4) // Keep only meaningful words (4+ chars)
    .filter(word => !STOP_WORDS.has(word)) // Remove stop words
    .filter(word => !/^\d+$/.test(word)) // Remove pure numbers
}

/**
 * Generate TF-IDF vector from text
 * @param text - Input text (title + thesis_brief)
 * @param corpus - Array of all documents for IDF calculation
 * @returns Object with word: tf-idf score
 */
export function generateTfIdfVector(
  text: string,
  corpus: string[]
): Record<string, number> {
  const words = normalizeText(text)
  const wordCounts = new Map<string, number>()
  
  // Count word frequencies in this document
  words.forEach(word => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  })
  
  const totalWords = words.length || 1
  const totalDocs = corpus.length || 1
  const vector: Record<string, number> = {}
  
  // Calculate TF-IDF for each word
  wordCounts.forEach((count, word) => {
    // Term Frequency (TF)
    const tf = count / totalWords
    
    // Inverse Document Frequency (IDF)
    const docsWithWord = corpus.filter(doc => 
      normalizeText(doc).includes(word)
    ).length
    const idf = Math.log((totalDocs + 1) / (docsWithWord + 1)) + 1
    
    // TF-IDF score
    vector[word] = tf * idf
  })
  
  return vector
}

/**
 * Calculate cosine similarity between two TF-IDF vectors
 * @param vec1 - First TF-IDF vector
 * @param vec2 - Second TF-IDF vector
 * @returns Similarity score (0 to 1)
 */
export function cosineSimilarity(
  vec1: Record<string, number>,
  vec2: Record<string, number>
): number {
  // Get all unique words from both vectors
  const allWords = new Set([
    ...Object.keys(vec1),
    ...Object.keys(vec2)
  ])
  
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0
  
  // Calculate dot product and norms
  allWords.forEach(word => {
    const val1 = vec1[word] || 0
    const val2 = vec2[word] || 0
    
    dotProduct += val1 * val2
    norm1 += val1 * val1
    norm2 += val2 * val2
  })
  
  // Calculate cosine similarity
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
  
  if (denominator === 0) return 0
  
  return dotProduct / denominator
}

/**
 * Build full text from research for TF-IDF calculation
 */
export function buildResearchText(title: string, thesisBrief: string): string {
  return `${title} ${thesisBrief}`.trim()
}

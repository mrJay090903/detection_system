import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import crypto from 'crypto'

// ============================================================================
// ADVANCED SIMILARITY DETECTION ALGORITHMS
// ============================================================================

// 1. N-GRAM TEXT MATCHING
function generateNGrams(text: string, n: number): string[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
  const ngrams: string[] = []
  
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '))
  }
  
  return ngrams
}

function nGramSimilarity(text1: string, text2: string, n: number = 3): number {
  const ngrams1 = new Set(generateNGrams(text1, n))
  const ngrams2 = new Set(generateNGrams(text2, n))
  
  if (ngrams1.size === 0 || ngrams2.size === 0) return 0
  
  const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)))
  const union = new Set([...ngrams1, ...ngrams2])
  
  return intersection.size / union.size // Jaccard similarity
}

// 2. FINGERPRINTING / WINNOWING ALGORITHM
function fingerprint(text: string, windowSize: number = 5): Set<string> {
  const hashes: string[] = []
  const ngrams = generateNGrams(text, 3)
  
  // Create hash for each n-gram
  ngrams.forEach(ngram => {
    const hash = crypto.createHash('md5').update(ngram).digest('hex')
    hashes.push(hash)
  })
  
  // Winnowing: select minimum hash in each window
  const fingerprints = new Set<string>()
  for (let i = 0; i <= hashes.length - windowSize; i++) {
    const window = hashes.slice(i, i + windowSize)
    const minHash = window.reduce((min, hash) => hash < min ? hash : min)
    fingerprints.add(minHash)
  }
  
  return fingerprints
}

function fingerprintSimilarity(text1: string, text2: string): number {
  const fp1 = fingerprint(text1)
  const fp2 = fingerprint(text2)
  
  if (fp1.size === 0 || fp2.size === 0) return 0
  
  const intersection = new Set([...fp1].filter(x => fp2.has(x)))
  return intersection.size / Math.max(fp1.size, fp2.size)
}

// 3. STRING MATCHING ALGORITHMS (Rabin-Karp inspired)
function rabinKarpSimilarity(text1: string, text2: string, patternLength: number = 20): number {
  const s1 = text1.toLowerCase().replace(/\s+/g, ' ')
  const s2 = text2.toLowerCase().replace(/\s+/g, ' ')
  
  if (s1.length < patternLength || s2.length < patternLength) return 0
  
  const patterns1 = new Set<string>()
  const patterns2 = new Set<string>()
  
  // Extract all substrings of length patternLength
  for (let i = 0; i <= s1.length - patternLength; i++) {
    patterns1.add(s1.substring(i, i + patternLength))
  }
  
  for (let i = 0; i <= s2.length - patternLength; i++) {
    patterns2.add(s2.substring(i, i + patternLength))
  }
  
  const intersection = new Set([...patterns1].filter(x => patterns2.has(x)))
  return intersection.size / Math.max(patterns1.size, patterns2.size)
}

// 4. LONGEST COMMON SUBSEQUENCE (LCS)
function longestCommonSubsequence(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/)
  const words2 = text2.toLowerCase().split(/\s+/)
  
  const m = words1.length
  const n = words2.length
  
  // Use space-optimized DP
  const dp: number[] = new Array(n + 1).fill(0)
  
  for (let i = 1; i <= m; i++) {
    let prev = 0
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      if (words1[i - 1] === words2[j - 1]) {
        dp[j] = prev + 1
      } else {
        dp[j] = Math.max(dp[j], dp[j - 1])
      }
      prev = temp
    }
  }
  
  return dp[n] / Math.max(m, n)
}

// 5. SENTENCE SIMILARITY (Semantic approach)
function sentenceSimilarity(text1: string, text2: string): number {
  const sentences1 = text1.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const sentences2 = text2.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  if (sentences1.length === 0 || sentences2.length === 0) return 0
  
  let totalSimilarity = 0
  let comparisons = 0
  
  // Compare each sentence from text1 with all sentences from text2
  sentences1.forEach(s1 => {
    const words1 = new Set(s1.toLowerCase().split(/\s+/))
    sentences2.forEach(s2 => {
      const words2 = new Set(s2.toLowerCase().split(/\s+/))
      const intersection = new Set([...words1].filter(x => words2.has(x)))
      const union = new Set([...words1, ...words2])
      
      if (union.size > 0) {
        totalSimilarity += intersection.size / union.size
        comparisons++
      }
    })
  })
  
  return comparisons > 0 ? totalSimilarity / comparisons : 0
}

// 6. MACHINE LEARNING-INSPIRED FEATURE EXTRACTION
function extractTextFeatures(text: string): {
  avgWordLength: number
  avgSentenceLength: number
  uniqueWordRatio: number
  vocabularyRichness: number
  wordFrequencyVector: Map<string, number>
} {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const uniqueWords = new Set(words)
  
  const wordFrequency = new Map<string, number>()
  words.forEach(word => {
    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1)
  })
  
  return {
    avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1),
    avgSentenceLength: words.length / (sentences.length || 1),
    uniqueWordRatio: uniqueWords.size / (words.length || 1),
    vocabularyRichness: uniqueWords.size / Math.sqrt(words.length || 1),
    wordFrequencyVector: wordFrequency
  }
}

function featureSimilarity(text1: string, text2: string): number {
  const features1 = extractTextFeatures(text1)
  const features2 = extractTextFeatures(text2)
  
  // Compare numerical features
  const avgWordLengthDiff = 1 - Math.abs(features1.avgWordLength - features2.avgWordLength) / Math.max(features1.avgWordLength, features2.avgWordLength)
  const avgSentenceLengthDiff = 1 - Math.abs(features1.avgSentenceLength - features2.avgSentenceLength) / Math.max(features1.avgSentenceLength, features2.avgSentenceLength)
  const uniqueWordRatioDiff = 1 - Math.abs(features1.uniqueWordRatio - features2.uniqueWordRatio)
  
  // Compare word frequency vectors
  const allWords = new Set([...features1.wordFrequencyVector.keys(), ...features2.wordFrequencyVector.keys()])
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0
  
  allWords.forEach(word => {
    const freq1 = features1.wordFrequencyVector.get(word) || 0
    const freq2 = features2.wordFrequencyVector.get(word) || 0
    dotProduct += freq1 * freq2
    norm1 += freq1 * freq1
    norm2 += freq2 * freq2
  })
  
  const cosineSim = dotProduct / (Math.sqrt(norm1 * norm2) || 1)
  
  return (avgWordLengthDiff + avgSentenceLengthDiff + uniqueWordRatioDiff + cosineSim) / 4
}

// 7. COMPOSITE MULTI-ALGORITHM SIMILARITY SCORE
function calculateMultiAlgorithmSimilarity(text1: string, text2: string): {
  nGram: number
  fingerprint: number
  rabinKarp: number
  lcs: number
  sentence: number
  feature: number
  composite: number
  confidence: number
} {
  const nGram = nGramSimilarity(text1, text2, 3)
  const fingerprintScore = fingerprintSimilarity(text1, text2)
  const rabinKarp = rabinKarpSimilarity(text1, text2, 20)
  const lcs = longestCommonSubsequence(text1, text2)
  const sentence = sentenceSimilarity(text1, text2)
  const feature = featureSimilarity(text1, text2)
  
  // Weighted composite score (tuned for academic plagiarism detection)
  const weights = {
    nGram: 0.25,
    fingerprint: 0.20,
    rabinKarp: 0.15,
    lcs: 0.15,
    sentence: 0.15,
    feature: 0.10
  }
  
  const composite = 
    nGram * weights.nGram +
    fingerprintScore * weights.fingerprint +
    rabinKarp * weights.rabinKarp +
    lcs * weights.lcs +
    sentence * weights.sentence +
    feature * weights.feature
  
  // Calculate confidence based on agreement between algorithms
  const scores = [nGram, fingerprintScore, rabinKarp, lcs, sentence, feature]
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length
  const confidence = 1 - Math.min(variance * 2, 1) // Lower variance = higher confidence
  
  return {
    nGram,
    fingerprint: fingerprintScore,
    rabinKarp,
    lcs,
    sentence,
    feature,
    composite,
    confidence
  }
}

// ============================================================================
// ORIGINAL EMBEDDING AND SIMILARITY FUNCTIONS
// ============================================================================

// Get semantic embeddings using Gemini
async function getEmbedding(text: string, genAI: GoogleGenerativeAI): Promise<number[]> {
  try {
    // Use Gemini embedding model - try different model names
    let result
    try {
      const model = genAI.getGenerativeModel({ model: 'embedding-001' })
      result = await model.embedContent(text)
    } catch (e) {
      // Try alternative: use text-embedding-004 or other available models
      try {
        const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
        result = await model.embedContent(text)
      } catch (e2) {
        // Fallback: use gemini-pro with a prompt-based approach
        console.warn('Embedding model not available, using fallback')
        return []
      }
    }
    
    // Handle different response formats
    if (result && result.embedding) {
      return result.embedding.values || []
    }
    
    return []
  } catch (error) {
    console.error('Error getting embedding:', error)
    // Fallback: return empty array if embedding fails
    return []
  }
}

// Calculate cosine similarity between two embedding vectors
function cosineSimilarityEmbeddings(vec1: number[], vec2: number[]): number {
  if (vec1.length === 0 || vec2.length === 0 || vec1.length !== vec2.length) {
    return 0
  }
  
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
  if (denominator === 0) return 0
  
  return Math.max(0, Math.min(1, dotProduct / denominator))
}

// Generate comprehensive explanation for similarity
async function generateSimilarityExplanation(
  proposedTitle: string,
  proposedConcept: string,
  existingTitle: string,
  existingAbstract: string,
  lexicalSim: number,
  semanticSim: number,
  genAI: GoogleGenerativeAI
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    
    const prompt = `You are a helpful research assistant. Explain in simple, easy-to-understand language why a proposed research is similar to an existing research. Use plain English, avoid jargon, and make it easy for anyone to understand.

PROPOSED RESEARCH:
Title: "${proposedTitle}"
Concept/Abstract: "${proposedConcept}"

EXISTING RESEARCH FROM DATABASE:
Title: "${existingTitle}"
Abstract: "${existingAbstract}"

SIMILARITY SCORES:
Lexical Similarity: ${(lexicalSim * 100).toFixed(2)}% (word-based matching)
Semantic Similarity: ${(semanticSim * 100).toFixed(2)}% (meaning-based matching)

IMPORTANT: Compare these two researches:
1. Proposed Title: "${proposedTitle}" vs Existing Title: "${existingTitle}"
2. Proposed Abstract: "${proposedConcept}" vs Existing Abstract: "${existingAbstract}"

Write a SPECIFIC and DETAILED explanation that clearly explains WHY they are similar. Follow this EXACT format:

**Explanation:** [Write a detailed paragraph starting with "Both studies share..."]

FORMAT REQUIREMENTS:
1. Start with: "Both studies share the same purpose of [EXACT purpose from both abstracts - quote specific phrases]"

2. Then say: "The methods ([list EXACT method names from BOTH abstracts - e.g., BERT, cosine similarity, NLP, IoT, etc.]) and objectives ([list EXACT objectives from BOTH abstracts - e.g., academic integrity, plagiarism detection, etc.]) are nearly identical, despite different wording."

3. Add 2-4 more sentences that are SPECIFIC about:
   - What EXACT technologies appear in BOTH abstracts? (e.g., "both use BERT", "both employ cosine similarity", "both utilize NLP")
   - What EXACT objectives/goals are mentioned in BOTH? (e.g., "both aim to detect plagiarism", "both focus on academic integrity")
   - What EXACT problem domain do BOTH address? (e.g., "both target academic papers", "both focus on research similarity")
   - What EXACT tools, frameworks, or approaches do BOTH mention? (List them specifically)

EXAMPLE OF GOOD EXPLANATION:
"Both studies share the same purpose of detecting plagiarism and text similarity in academic works using AI and NLP. The methods (BERT, cosine similarity) and objectives (academic integrity) are nearly identical, despite different wording. Both researches utilize transformer-based models like BERT to identify semantic similarities in academic papers. Both employ cosine similarity algorithms to measure text similarity. Both aim to maintain academic integrity and prevent plagiarism in academic writing. The target domain is identical - both focus on academic research papers and student theses."

CRITICAL REQUIREMENTS:
- Start with "Both studies share..." or "Both researches share..."
- Mention EXACT technology names from BOTH abstracts (BERT, RoBERTa, cosine similarity, NLP, IoT, etc.)
- Mention EXACT objectives from BOTH abstracts (academic integrity, plagiarism detection, etc.)
- Quote or reference specific phrases that appear in BOTH abstracts
- Be EXTREMELY SPECIFIC - don't say "both use AI" say "both use BERT and NLP"
- Don't be vague - always mention exact names of technologies, methods, or objectives
- List ALL technologies/methods that appear in BOTH abstracts
- Make it clear WHY they are similar by citing exact, specific similarities
- Write in simple, clear language but be very specific about details

WRITING STYLE:
- Use simple, everyday language - like explaining to a friend
- Avoid academic jargon - say "they use the same method" not "they employ identical methodologies"
- Use examples - "both mention BERT" instead of "both utilize transformer architectures"
- Be direct - "These are very similar" not "There exists a high degree of similarity"
- Keep sentences short and clear
- Use bullet points or lists when helpful
- Make it easy to understand - imagine explaining to someone who isn't a researcher`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Error generating explanation:', error)
    // Deep comprehensive fallback explanation
    const avgSim = ((lexicalSim + semanticSim) / 2) * 100
    const isConceptual = semanticSim > lexicalSim + 0.15
    const isLexical = lexicalSim > semanticSim + 0.15
    const lexicalPercent = (lexicalSim * 100).toFixed(1)
    const semanticPercent = (semanticSim * 100).toFixed(1)
    
    if (avgSim >= 70) {
      return `**Are the titles similar?** 
Yes, the titles "${proposedTitle}" and "${existingTitle}" share similar words and talk about the same topic.

**What problem are they solving?**
Both researches are trying to solve the same problem. ${isConceptual ? `Even though they use different words, they mean the same thing - like saying "car" vs "automobile". The semantic similarity (${semanticPercent}%) is much higher than word similarity (${lexicalPercent}%), which means they have the same ideas even if written differently.` : isLexical ? `They use many of the same words (${lexicalPercent}% word similarity), showing they're talking about the same thing.` : `They are very similar in both words (${lexicalPercent}%) and meaning (${semanticPercent}%).`}

**What methods do they use?**
Both researches use similar technologies, tools, or methods to solve the problem.

**What makes them similar?**
- They share many of the same words and phrases
- They use similar technologies or tools
- They have the same goals or objectives
- They solve the same problem in similar ways

**Why are they similar?**
The similarity score is ${avgSim.toFixed(0)}%, which means these two researches are very similar. ${isConceptual ? `Even though the words are different, the ideas are the same.` : `They use many of the same words and have similar ideas.`}

**Bottom line**
These researches are too similar - they might be copies or lack originality. You should review them carefully.`
    } else if (avgSim >= 40) {
      return `**Are the titles similar?**
The titles "${proposedTitle}" and "${existingTitle}" share some similar words, but they might focus on slightly different things.

**What problem are they solving?**
${isConceptual ? `They might be solving related problems, but not exactly the same. The meaning similarity (${semanticPercent}%) is higher than word similarity (${lexicalPercent}%), so they have similar ideas but different wording.` : isLexical ? `They share some words (${lexicalPercent}% word similarity), which means they're in the same research area, but they might solve different problems.` : `They have some overlap in both words (${lexicalPercent}%) and meaning (${semanticPercent}%), but they're not identical.`}

**What methods do they use?**
They might use some similar tools or methods, but also have differences in their approach.

**What makes them similar?**
- They share some words or phrases
- They might use some of the same technologies
- They're in the same research area
- But they have enough differences to be considered separate

**Why are they similar?**
The similarity score is ${avgSim.toFixed(0)}%, which means they're somewhat similar but not too much. They're related but different enough.

**Bottom line**
These researches are somewhat similar but different enough. They're probably okay, but you should still review them to make sure they're original enough.`
    } else {
      return `**Are the titles similar?**
The titles "${proposedTitle}" and "${existingTitle}" are different and talk about different topics.

**What problem are they solving?**
They are solving different problems. ${isConceptual ? `Even though there might be a small connection in meaning (${semanticPercent}%), they are clearly different researches.` : `They don't share many words (${lexicalPercent}%) or similar meanings (${semanticPercent}%).`}

**What methods do they use?**
They use different methods, tools, or technologies to solve their problems.

**What makes them similar?**
Not much - they are different researches with different goals and methods.

**Why are they similar?**
The similarity score is ${avgSim.toFixed(0)}%, which is low. This means they are different researches.

**Bottom line**
These researches are different enough - they are original and don't overlap much.`
    }
  }
}

// Combined Lexical and Semantic Similarity Calculation
async function calculateCosineSimilarity(
  proposedTitle: string,
  proposedConcept: string,
  existingResearches: Array<{ 
    id?: string
    title: string
    abstract: string
    year?: number
    course?: string
  }>,
  genAI: GoogleGenerativeAI
): Promise<Array<{
  id?: string
  title: string
  abstract: string
  year?: number
  course?: string
  titleSimilarity: number
  abstractSimilarity: number
  overallSimilarity: number
  lexicalSimilarity: number
  semanticSimilarity: number
  similarityType: 'Lexical' | 'Conceptual' | 'Both'
  explanation: string
  algorithmScores: {
    nGram: number
    fingerprint: number
    rabinKarp: number
    lcs: number
    sentenceSimilarity: number
    featureSimilarity: number
    multiAlgoComposite: number
    confidence: number
  }
}>> {
  // Enhanced TF-IDF cosine similarity with improved preprocessing
  
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
    'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'about', 'into', 'through', 'during', 'including', 'against', 'among',
    'throughout', 'despite', 'towards', 'upon', 'concerning'
  ])

  // Word similarity using Levenshtein distance
  const wordSimilarity = (word1: string, word2: string): number => {
    if (word1 === word2) return 1.0
    if (word1.length === 0 || word2.length === 0) return 0
    
    const longer = word1.length > word2.length ? word1 : word2
    const shorter = word1.length > word2.length ? word2 : word1
    
    // If words are very different in length, similarity is low
    if (longer.length - shorter.length > 3) return 0
    
    // Check if one word contains the other (for compound words)
    if (longer.includes(shorter) && shorter.length >= 4) return 0.7
    
    // Simple character overlap similarity
    const commonChars = [...shorter].filter(char => longer.includes(char)).length
    return commonChars / longer.length
  }

  // Enhanced preprocessing with better normalization
  const preprocess = (text: string): string[] => {
    if (!text) return []
    
    return text
      .toLowerCase()
      // Keep numbers and hyphens for technical terms
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(word => {
        // Keep words longer than 2 chars and not stop words
        // Also keep numbers
        return (word.length > 2 && !stopWords.has(word)) || /^\d+$/.test(word)
      })
      .map(word => {
        // More aggressive stemming
        const original = word
        
        // Remove common suffixes
        if (word.length > 6) {
          if (word.endsWith('tion')) return word.slice(0, -4)
          if (word.endsWith('sion')) return word.slice(0, -4)
          if (word.endsWith('ment')) return word.slice(0, -4)
          if (word.endsWith('ness')) return word.slice(0, -4)
        }
        if (word.length > 5) {
          if (word.endsWith('ing')) return word.slice(0, -3)
          if (word.endsWith('ity')) return word.slice(0, -3)
          if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
        }
        if (word.length > 4) {
          if (word.endsWith('ed')) return word.slice(0, -2)
          if (word.endsWith('ly')) return word.slice(0, -2)
          if (word.endsWith('er')) return word.slice(0, -2)
        }
        if (word.length > 3) {
          if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
        }
        
        return word
      })
      .filter(word => word.length > 0)
  }

  // Create n-grams (1-gram, 2-gram, and 3-gram) for better matching
  const createNGrams = (words: string[]): string[] => {
    const ngrams: string[] = [...words] // 1-grams
    
    // 2-grams
    for (let i = 0; i < words.length - 1; i++) {
      ngrams.push(`${words[i]} ${words[i + 1]}`)
    }
    
    // 3-grams for longer phrases
    for (let i = 0; i < words.length - 2; i++) {
      ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
    }
    
    return ngrams
  }

  // Character-level n-grams for fuzzy matching
  const createCharNGrams = (word: string, n: number = 3): string[] => {
    const charNgrams: string[] = []
    for (let i = 0; i <= word.length - n; i++) {
      charNgrams.push(word.substring(i, i + n))
    }
    return charNgrams
  }

  const calculateTfIdf = (
    text: string,
    allTexts: string[]
  ): Map<string, number> => {
    const words = preprocess(text)
    const ngrams = createNGrams(words)
    const wordCounts = new Map<string, number>()
    
    ngrams.forEach(ngram => {
      wordCounts.set(ngram, (wordCounts.get(ngram) || 0) + 1)
    })

    const tfIdf = new Map<string, number>()
    const totalDocs = allTexts.length
    
    if (totalDocs === 0) return tfIdf
    
    // Preprocess all documents once for efficiency
    const preprocessedDocs = allTexts.map(doc => ({
      words: preprocess(doc),
      ngrams: createNGrams(preprocess(doc))
    }))
    
    wordCounts.forEach((count, ngram) => {
      // Check exact match
      let docsWithNgram = preprocessedDocs.filter(doc => 
        doc.ngrams.includes(ngram)
      ).length
      
      // If no exact match, check for fuzzy similarity (for single words)
      if (docsWithNgram === 0 && ngram.split(' ').length === 1) {
        const word = ngram
        docsWithNgram = preprocessedDocs.filter(doc => {
            return doc.words.some(docWord => {
              const sim = wordSimilarity(word, docWord)
              return sim > 0.55 // Lowered threshold for better accuracy (was 0.6)
            })
        }).length
        
        // Boost similarity score if fuzzy match found
        if (docsWithNgram > 0) {
          const tf = count / ngrams.length
          const idf = Math.log((totalDocs + 1) / (docsWithNgram + 1)) + 1
          // Reduce weight for fuzzy matches but still include them
          tfIdf.set(ngram, tf * idf * 0.7)
          return
        }
      }
      
      // Improved IDF calculation with smoothing
      const idf = Math.log((totalDocs + 1) / (docsWithNgram + 1)) + 1
      const tf = count / ngrams.length
      tfIdf.set(ngram, tf * idf)
    })

    return tfIdf
  }

  const cosineSimilarity = (
    vec1: Map<string, number>,
    vec2: Map<string, number>
  ): number => {
    const allWords = new Set([...vec1.keys(), ...vec2.keys()])
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    let fuzzyMatchScore = 0

    // Exact matches
    allWords.forEach(word => {
      const val1 = vec1.get(word) || 0
      const val2 = vec2.get(word) || 0
      dotProduct += val1 * val2
      norm1 += val1 * val1
      norm2 += val2 * val2
    })

    // Add fuzzy matching for single-word ngrams
    const vec1Words = Array.from(vec1.keys()).filter(w => w.split(' ').length === 1)
    const vec2Words = Array.from(vec2.keys()).filter(w => w.split(' ').length === 1)
    
    vec1Words.forEach(word1 => {
      const val1 = vec1.get(word1) || 0
      if (val1 === 0) return
      
      vec2Words.forEach(word2 => {
        const val2 = vec2.get(word2) || 0
        if (val2 === 0) return
        
        // Skip if already matched exactly
        if (word1 === word2) return
        
        const sim = wordSimilarity(word1, word2)
        if (sim > 0.55) { // Lowered threshold for better accuracy (was 0.6)
          // Add fuzzy match contribution (weighted by similarity)
          fuzzyMatchScore += val1 * val2 * sim * 0.35 // Increased weight (was 0.3)
        }
      })
    })

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
    if (denominator === 0) return 0
    
    // Combine exact match and fuzzy match scores
    const exactSimilarity = dotProduct / denominator
    const fuzzyContribution = fuzzyMatchScore / (denominator + 1)
    
    return Math.max(0, Math.min(1, exactSimilarity + fuzzyContribution))
  }

  const allTitles = [
    proposedTitle,
    ...existingResearches.map(r => r.title)
  ]
  const allAbstracts = [
    proposedConcept,
    ...existingResearches.map(r => r.abstract)
  ]

  // Get semantic embeddings for proposed research
  console.log('Getting semantic embeddings for proposed research...')
  const proposedTitleEmbedding = await getEmbedding(proposedTitle, genAI)
  const proposedConceptEmbedding = await getEmbedding(proposedConcept, genAI)
  
  // Calculate lexical similarity (TF-IDF)
  const proposedTitleVec = calculateTfIdf(proposedTitle, allTitles)
  const proposedConceptVec = calculateTfIdf(proposedConcept, allAbstracts)

  // Process all researches with both lexical and semantic similarity
  const results = await Promise.all(
    existingResearches.map(async (research, index) => {
      // Lexical similarity
      const existingTitleVec = calculateTfIdf(research.title, allTitles)
      const existingAbstractVec = calculateTfIdf(research.abstract, allAbstracts)

      const titleLexicalSim = cosineSimilarity(proposedTitleVec, existingTitleVec)
      const abstractLexicalSim = cosineSimilarity(proposedConceptVec, existingAbstractVec)
      
      // Word overlap similarity
      const titleWords = new Set(preprocess(proposedTitle))
      const abstractWords = new Set(preprocess(proposedConcept))
      const existingTitleWords = new Set(preprocess(research.title))
      const existingAbstractWords = new Set(preprocess(research.abstract))
      
      const titleOverlap = titleWords.size > 0 
        ? [...titleWords].filter(w => existingTitleWords.has(w)).length / titleWords.size
        : 0
      const abstractOverlap = abstractWords.size > 0
        ? [...abstractWords].filter(w => existingAbstractWords.has(w)).length / abstractWords.size
        : 0
      
      const enhancedTitleLexical = titleLexicalSim * 0.7 + titleOverlap * 0.3
      const enhancedAbstractLexical = abstractLexicalSim * 0.7 + abstractOverlap * 0.3
      const lexicalSim = enhancedTitleLexical * 0.4 + enhancedAbstractLexical * 0.6

      // Semantic similarity using embeddings
      let titleSemanticSim = 0
      let abstractSemanticSim = 0
      let semanticSim = 0

      if (proposedTitleEmbedding.length > 0) {
        const existingTitleEmbedding = await getEmbedding(research.title, genAI)
        if (existingTitleEmbedding.length > 0) {
          titleSemanticSim = cosineSimilarityEmbeddings(proposedTitleEmbedding, existingTitleEmbedding)
        }
      }

      if (proposedConceptEmbedding.length > 0) {
        const existingAbstractEmbedding = await getEmbedding(research.abstract, genAI)
        if (existingAbstractEmbedding.length > 0) {
          abstractSemanticSim = cosineSimilarityEmbeddings(proposedConceptEmbedding, existingAbstractEmbedding)
        }
      }

      semanticSim = titleSemanticSim * 0.4 + abstractSemanticSim * 0.6

      // ============================================================
      // MULTI-ALGORITHM SIMILARITY DETECTION (Enhanced Security)
      // ============================================================
      
      // Run all advanced algorithms on title comparison
      const titleMultiAlgo = calculateMultiAlgorithmSimilarity(proposedTitle, research.title)
      
      // Run all advanced algorithms on abstract comparison
      const abstractMultiAlgo = calculateMultiAlgorithmSimilarity(proposedConcept, research.abstract)
      
      // Combine multi-algorithm scores
      const multiAlgoTitleScore = titleMultiAlgo.composite
      const multiAlgoAbstractScore = abstractMultiAlgo.composite
      const multiAlgoOverallScore = multiAlgoTitleScore * 0.4 + multiAlgoAbstractScore * 0.6
      
      // Calculate confidence-weighted score
      const avgConfidence = (titleMultiAlgo.confidence + abstractMultiAlgo.confidence) / 2
      
      // ============================================================
      // COMPREHENSIVE OVERALL SIMILARITY (6 ALGORITHMS)
      // ============================================================
      // Title algorithms (40% weight) - Excluding Semantic and ML Feature
      const titleAlgorithms = [
        enhancedTitleLexical,      // TF-IDF Lexical
        titleMultiAlgo.nGram,      // N-Gram
        titleMultiAlgo.fingerprint, // Fingerprinting
        titleMultiAlgo.rabinKarp,  // Rabin-Karp
        titleMultiAlgo.lcs,        // LCS
        titleMultiAlgo.sentence,   // Sentence Similarity
      ]
      
      // Abstract algorithms (60% weight) - Excluding Semantic and ML Feature
      const abstractAlgorithms = [
        enhancedAbstractLexical,      // TF-IDF Lexical
        abstractMultiAlgo.nGram,      // N-Gram
        abstractMultiAlgo.fingerprint, // Fingerprinting
        abstractMultiAlgo.rabinKarp,  // Rabin-Karp
        abstractMultiAlgo.lcs,        // LCS
        abstractMultiAlgo.sentence,   // Sentence Similarity
      ]
      
      // Calculate average of all 6 algorithms for title and abstract
      const avgTitleScore = titleAlgorithms.reduce((sum, score) => sum + score, 0) / titleAlgorithms.length
      const avgAbstractScore = abstractAlgorithms.reduce((sum, score) => sum + score, 0) / abstractAlgorithms.length
      
      // Overall similarity: weighted average of all 6 algorithms
      // This represents the TRUE average of all 6 detection algorithms
      let overallSim = avgTitleScore * 0.4 + avgAbstractScore * 0.6
      
      // ============================================================
      // ADVANCED MULTI-ALGORITHM SECURITY VALIDATIONS
      // ============================================================
      
      // 1. Cross-Algorithm Consensus Detection
      // Check if multiple algorithms independently detect high similarity
      const highSimilarityCount = [
        titleMultiAlgo.nGram > 0.6,
        titleMultiAlgo.fingerprint > 0.6,
        titleMultiAlgo.rabinKarp > 0.6,
        titleMultiAlgo.lcs > 0.6,
        abstractMultiAlgo.nGram > 0.6,
        abstractMultiAlgo.fingerprint > 0.6,
        abstractMultiAlgo.rabinKarp > 0.6,
        abstractMultiAlgo.lcs > 0.6
      ].filter(Boolean).length
      
      if (highSimilarityCount >= 4) {
        // 4+ algorithms agree on high similarity - very strong evidence
        overallSim = Math.min(1, overallSim * 1.15) // 15% boost for strong consensus
      } else if (highSimilarityCount >= 3) {
        // 3 algorithms agree - moderate evidence
        overallSim = Math.min(1, overallSim * 1.10) // 10% boost for moderate consensus
      }
      
      // 2. Structural Similarity Detection (LCS + Fingerprint)
      // Detect if document structure is copied even with word changes
      const structuralSimilarity = (abstractMultiAlgo.lcs + abstractMultiAlgo.fingerprint) / 2
      if (structuralSimilarity > 0.7 && enhancedAbstractLexical < 0.4) {
        // High structural similarity but low lexical = sophisticated plagiarism
        overallSim = Math.min(1, overallSim * 1.18) // 18% boost for structural plagiarism
      }
      
      // 3. Pattern-Based Plagiarism Detection (N-Gram + Rabin-Karp)
      // Detect repeated patterns and phrases
      const patternSimilarity = (abstractMultiAlgo.nGram + abstractMultiAlgo.rabinKarp) / 2
      if (patternSimilarity > 0.65) {
        // High pattern similarity indicates copied phrases
        overallSim = Math.min(1, overallSim * 1.12) // 12% boost for pattern copying
      }
      
      // 4. Sentence-Level Plagiarism Detection
      // Check if individual sentences are copied
      if (abstractMultiAlgo.sentence > 0.7) {
        // High sentence similarity even with different words
        overallSim = Math.min(1, overallSim * 1.14) // 14% boost for sentence plagiarism
      }
      
      // 5. Title Plagiarism with Abstract Similarity
      // Detect if title is very similar AND abstract has some similarity
      if (enhancedTitleLexical > 0.8 && avgAbstractScore > 0.3) {
        // Same/similar title with related content = likely plagiarism
        overallSim = Math.min(1, overallSim * 1.10) // 10% boost for title+content match
      }
      
      // 6. Fingerprint Hash Collision Detection
      // Multiple hash matches indicate direct copying
      if (titleMultiAlgo.fingerprint > 0.75 && abstractMultiAlgo.fingerprint > 0.75) {
        // Very high fingerprint similarity = direct copy
        overallSim = Math.min(1, overallSim * 1.20) // 20% boost for hash collision
      }
      
      // 7. Sequential Text Similarity (LCS)
      // Long common subsequences indicate large copied sections
      if (abstractMultiAlgo.lcs > 0.75) {
        // Very long common subsequence = substantial copying
        overallSim = Math.min(1, overallSim * 1.13) // 13% boost for sequential copying
      }
      
      // 8. Multi-Pattern Agreement (N-Gram + Rabin-Karp + Fingerprint)
      // Triple agreement on pattern matching
      const patternAgreement = (abstractMultiAlgo.nGram + abstractMultiAlgo.rabinKarp + abstractMultiAlgo.fingerprint) / 3
      if (patternAgreement > 0.7) {
        // All pattern algorithms agree = strong evidence
        overallSim = Math.min(1, overallSim * 1.16) // 16% boost for triple pattern agreement
      }
      
      // 9. Confidence-Weighted Security Enhancement
      // Higher confidence means more reliable detection
      if (avgConfidence > 0.85) {
        overallSim = Math.min(1, overallSim * 1.08) // 8% boost for very high confidence
      } else if (avgConfidence > 0.75) {
        overallSim = Math.min(1, overallSim * 1.05) // 5% boost for high confidence
      }
      
      // 10. Synonym Substitution Detection
      // Detect if words are changed but sentence structure remains
      if (abstractMultiAlgo.sentence > 0.6 && abstractMultiAlgo.lcs > 0.5 && enhancedAbstractLexical < 0.35) {
        // High sentence/structure similarity but low word match = synonym substitution
        overallSim = Math.min(1, overallSim * 1.15) // 15% boost for synonym plagiarism
      }
      
      // Calculate combined title and abstract similarity for display
      const combinedTitleSim = avgTitleScore
      const combinedAbstractSim = avgAbstractScore

      // Determine similarity type with multi-algorithm context
      let similarityType: 'Lexical' | 'Conceptual' | 'Both'
      if (lexicalSim > 0.5 && semanticSim > 0.5 && multiAlgoOverallScore > 0.5) {
        similarityType = 'Both'
      } else if ((semanticSim > lexicalSim + 0.2) || (multiAlgoAbstractScore > 0.6 && abstractMultiAlgo.sentence > 0.6)) {
        similarityType = 'Conceptual'
      } else {
        similarityType = 'Lexical'
      }

      // Generate explanation
      const explanation = await generateSimilarityExplanation(
        proposedTitle,
        proposedConcept,
        research.title,
        research.abstract,
        lexicalSim,
        semanticSim,
        genAI
      )

      return {
        id: research.id,
        title: research.title,
        abstract: research.abstract,
        year: research.year,
        course: research.course,
        titleSimilarity: Math.round(combinedTitleSim * 10000) / 10000,
        abstractSimilarity: Math.round(combinedAbstractSim * 10000) / 10000,
        overallSimilarity: Math.round(overallSim * 10000) / 10000,
        lexicalSimilarity: Math.round(lexicalSim * 10000) / 10000,
        semanticSimilarity: Math.round(semanticSim * 10000) / 10000,
        similarityType,
        explanation,
        // Multi-algorithm detailed scores for transparency and security
        algorithmScores: {
          nGram: Math.round(abstractMultiAlgo.nGram * 10000) / 10000,
          fingerprint: Math.round(abstractMultiAlgo.fingerprint * 10000) / 10000,
          rabinKarp: Math.round(abstractMultiAlgo.rabinKarp * 10000) / 10000,
          lcs: Math.round(abstractMultiAlgo.lcs * 10000) / 10000,
          sentenceSimilarity: Math.round(abstractMultiAlgo.sentence * 10000) / 10000,
          featureSimilarity: Math.round(abstractMultiAlgo.feature * 10000) / 10000,
          multiAlgoComposite: Math.round(multiAlgoOverallScore * 10000) / 10000,
          confidence: Math.round(avgConfidence * 10000) / 10000
        }
      }
    })
  )

  return results.sort((a, b) => b.overallSimilarity - a.overallSimilarity)
}

async function generateGeminiReport(
  proposedTitle: string,
  proposedConcept: string,
  similarities: Array<{
    id?: string
    title: string
    abstract: string
    year?: number
    course?: string
    titleSimilarity: number
    abstractSimilarity: number
    overallSimilarity: number
  }>
): Promise<string> {
  // Read Gemini API key from .env file
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    console.error('GEMINI_API_KEY is missing from .env file')
    throw new Error('GEMINI_API_KEY is not set in environment variables. Please add it to your .env file.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  // Get top 3 most similar researches
  const topSimilar = similarities.slice(0, 3)

  const prompt = `You are an expert research analyst. Analyze the similarity between a proposed research and existing researches.

PROPOSED RESEARCH:
Title: ${proposedTitle}
Concept: ${proposedConcept}

EXISTING RESEARCHES FROM DATABASE WITH SIMILARITY SCORES:
${topSimilar
  .map(
    (r, i) => `
${i + 1}. Title: ${r.title}
   Year: ${r.year || 'N/A'}
   Course: ${r.course || 'N/A'}
   Abstract: ${r.abstract}
   Title Similarity: ${(r.titleSimilarity * 100).toFixed(2)}%
   Abstract Similarity: ${(r.abstractSimilarity * 100).toFixed(2)}%
   Overall Similarity: ${(r.overallSimilarity * 100).toFixed(2)}%
`
  )
  .join('\n')}

Please generate a comprehensive similarity analysis report that includes:
1. Executive Summary - Overall assessment of similarity
2. Title Analysis - Comparison of proposed title with existing titles
3. Concept Analysis - Comparison of proposed concept with existing abstracts
4. Risk Assessment - Level of similarity risk (Low/Medium/High)
5. Recommendations - Suggestions for improving originality if needed
6. Conclusion - Final verdict on the proposed research

Format the report in a clear, professional manner suitable for academic review.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Gemini API error:', error)
    // Return fallback report instead of throwing
    return `SIMILARITY ANALYSIS REPORT

PROPOSED RESEARCH:
Title: ${proposedTitle}
Concept: ${proposedConcept.substring(0, 300)}...

TOP SIMILAR RESEARCHES:
${topSimilar
  .map(
    (r, i) => `
${i + 1}. ${r.title}
   Overall Similarity: ${(r.overallSimilarity * 100).toFixed(2)}%
   Title Similarity: ${(r.titleSimilarity * 100).toFixed(2)}%
   Abstract Similarity: ${(r.abstractSimilarity * 100).toFixed(2)}%
   Year: ${r.year || 'N/A'}
   Course: ${r.course || 'N/A'}
`
  )
  .join('\n')}

ANALYSIS:
The similarity analysis has been completed. ${topSimilar.length > 0 ? `The highest similarity score is ${(topSimilar[0].overallSimilarity * 100).toFixed(2)}%.` : 'No similar researches found.'}

Note: AI-generated detailed analysis is currently unavailable. Please review the similarity scores above.`
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received request body:', {
      proposedTitle: body.proposedTitle,
      proposedConceptLength: body.proposedConcept?.length || 0,
      proposedConceptPreview: body.proposedConcept?.substring(0, 100) || 'EMPTY'
    })

    const { proposedTitle, proposedConcept } = body

    if (!proposedTitle || !proposedConcept) {
      const missing = []
      if (!proposedTitle) missing.push('proposedTitle')
      if (!proposedConcept) missing.push('proposedConcept')
      
      console.error('Missing required parameters:', missing)
      return NextResponse.json(
        { 
          error: 'Proposed title and concept are required',
          details: `Missing parameters: ${missing.join(', ')}`,
          received: {
            proposedTitle: proposedTitle || 'EMPTY',
            proposedConcept: proposedConcept ? `${proposedConcept.length} characters` : 'EMPTY'
          }
        },
        { status: 400 }
      )
    }

    // Get Supabase client (using public client for similarity check - no auth required)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase configuration is missing' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch all existing researches from the database
    console.log('Fetching researches from database...')
    console.log('Supabase URL:', supabaseUrl)
    
    const { data: researches, error: dbError } = await supabase
      .from('researches')
      .select('id, title, abstract, year, course')
    
    console.log('Database query result:', { 
      count: researches?.length || 0, 
      error: dbError?.message,
      sample: researches?.slice(0, 2)
    })

    if (dbError) {
      console.error('Database error details:', {
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code
      })
      return NextResponse.json(
        { 
          error: 'Failed to fetch existing researches from database', 
          details: dbError.message,
          hint: 'Check if Row Level Security (RLS) policies allow public read access to researches table'
        },
        { status: 500 }
      )
    }

    const existingResearches = (researches || []).map(r => ({
      id: r.id,
      title: r.title || '',
      abstract: r.abstract || '',
      year: r.year,
      course: r.course,
    }))

    console.log(`Found ${existingResearches.length} researches in database to compare against`)
    
    // Log first few researches for debugging
    if (existingResearches.length > 0) {
      console.log('Sample researches:', existingResearches.slice(0, 3).map(r => ({
        id: r.id,
        title: r.title.substring(0, 50),
        abstractLength: r.abstract.length
      })))
    }

    // If no researches in database, return early
    if (existingResearches.length === 0) {
      return NextResponse.json({
        success: true,
        proposedTitle,
        proposedConcept,
        similarities: [],
        report: `No existing researches found in the database to compare against.\n\nYour proposed research:\nTitle: ${proposedTitle}\nConcept: ${proposedConcept}\n\nThis research appears to be unique as there are no existing researches in the database for comparison.`,
        totalComparisons: 0,
        message: 'No researches found in database for comparison'
      })
    }

    // Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set in environment variables' },
        { status: 500 }
      )
    }
    const genAI = new GoogleGenerativeAI(apiKey)

    // Calculate similarity (lexical + semantic)
    console.log('Calculating similarity (lexical + semantic)...')
    console.log('Proposed title:', proposedTitle)
    console.log('Proposed concept length:', proposedConcept.length)
    
    const similarities = await calculateCosineSimilarity(
      proposedTitle,
      proposedConcept,
      existingResearches,
      genAI
    )

    console.log(`Similarity calculation complete. Found ${similarities.length} comparisons.`)
    
    // Log top 3 similarities for debugging
    if (similarities.length > 0) {
      console.log('Top 3 similarities:', similarities.slice(0, 3).map(s => ({
        title: s.title.substring(0, 50),
        overall: (s.overallSimilarity * 100).toFixed(2) + '%',
        lexical: (s.lexicalSimilarity * 100).toFixed(2) + '%',
        semantic: (s.semanticSimilarity * 100).toFixed(2) + '%',
        type: s.similarityType
      })))
    }

    // Generate report using Gemini API
    let report = ''
    try {
      report = await generateGeminiReport(
        proposedTitle,
        proposedConcept,
        similarities
      )
      console.log('Gemini report generated successfully')
    } catch (geminiError) {
      console.error('Gemini report generation failed (using fallback):', geminiError)
      // Return results with fallback report even if Gemini fails
      report = `Similarity Analysis Report\n\n` +
        `Proposed Research Title: ${proposedTitle}\n\n` +
        `Proposed Research Concept: ${proposedConcept.substring(0, 200)}...\n\n` +
        `Similarity Results:\n` +
        similarities
          .slice(0, 5)
          .map(
            (s, i) =>
              `${i + 1}. ${s.title}\n   Overall Similarity: ${(s.overallSimilarity * 100).toFixed(2)}%\n   Type: ${s.similarityType}\n`
          )
          .join('\n')
    }

    return NextResponse.json({
      success: true,
      proposedTitle,
      proposedConcept,
      similarities: similarities.slice(0, 3), // Return top 3
      report,
      totalComparisons: similarities.length,
    })
  } catch (error) {
    console.error('Similarity check error:', error)
    return NextResponse.json(
      { error: 'Failed to check similarity', details: String(error) },
      { status: 500 }
    )
  }
}


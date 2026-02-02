import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { scoreSemanticSimilarity, GeminiSimilarityResult } from '@/lib/gemini-similarity'
import { calculateAccurateCosine, AccurateCosineResult } from '@/lib/accurate-cosine-similarity'
import { fastSimilarityPipeline, FastPipelineResult } from '@/lib/fast-similarity-pipeline'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

// Initialize AI providers
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

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

// ============================================================================
// CONCEPT GATE - STRICT PROBLEM-BASED SIMILARITY CHECKER
// ============================================================================

interface ConceptGateResult {
  coreProblemQuery: string
  coreProblemDb: string
  sameProblem: boolean
  sameUsers: boolean
  sameDomain: boolean
  sameIntent: boolean
  coreOverlapPct: number
  conceptSimilarityPct: number
  verdict: 'accepted' | 'rejected'
  reason: string
}

async function runConceptGate(
  queryTitle: string,
  queryConcept: string,
  dbTitle: string,
  dbConcept: string
): Promise<ConceptGateResult | null> {
  const prompt = `You are a strict thesis concept similarity checker.

Compare Research Query vs Database Research ONLY by:
- core problem being solved
- target users/beneficiaries
- domain
- intent/outcome

Ignore technology, methodology, ISO 25010, Agile/RAD, and generic thesis structure.

INPUT QUERY:
Title: ${queryTitle}
Concept: ${queryConcept}

DATABASE RESEARCH:
Title: ${dbTitle}
Concept Summary: ${dbConcept}

Return JSON with this exact structure:
{
  "coreProblemQuery": "...(1 sentence)",
  "coreProblemDb": "...(1 sentence)",
  "sameProblem": true or false,
  "sameUsers": true or false,
  "sameDomain": true or false,
  "sameIntent": true or false,
  "coreOverlapPct": 0-100,
  "conceptSimilarityPct": 0-100,
  "verdict": "accepted" or "rejected",
  "reason": "2-3 academic sentences"
}

SCORING RULES (MUST FOLLOW):
- If sameProblem=false AND sameUsers=false AND sameDomain=false AND sameIntent=false AND coreOverlapPct=0,
  conceptSimilarityPct MUST be 0 and verdict must be "rejected".
- If sameProblem=false, conceptSimilarityPct MUST NOT exceed 15.
- verdict is "accepted" only if conceptSimilarityPct >= 10.

Return ONLY the JSON, no additional text.`

const modelPriority = [
  // Gemini first
  { provider: 'gemini', model: 'gemini-2.5-flash' },

  // Optional secondary Gemini fallback
  { provider: 'gemini', model: 'gemini-2.5-pro' },

  // OpenAI fallback
  { provider: 'openai', model: 'gpt-4-turbo-preview' },
  { provider: 'openai', model: 'gpt-4' },
  { provider: 'openai', model: 'gpt-3.5-turbo' }
];



  for (const { provider, model } of modelPriority) {
    try {
      if (provider === 'openai' && !process.env.OPENAI_API_KEY) continue
      if (provider === 'gemini' && !process.env.GEMINI_API_KEY) continue

      // Wrap API call with retry logic
      const apiCall = async () => {
        if (provider === 'openai') {
          const completion = await openai.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: 'You are an expert academic research evaluator. Return only valid JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 1000
          })
          return completion.choices[0]?.message?.content || ''
        } else if (provider === 'gemini') {
          const geminiModel = genAI.getGenerativeModel({ model })
          const result = await geminiModel.generateContent(prompt)
          return result.response.text()
        }
        return ''
      };
      
      const responseText = await retryWithBackoff(apiCall, 3, 2000);

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) continue

      const parsed = JSON.parse(jsonMatch[0]) as ConceptGateResult
      
      // Validate the response follows the rules
      const completelyDifferent = !parsed.sameProblem && !parsed.sameUsers && 
                                   !parsed.sameDomain && !parsed.sameIntent && 
                                   parsed.coreOverlapPct === 0
      
      if (completelyDifferent && parsed.conceptSimilarityPct !== 0) {
        parsed.conceptSimilarityPct = 0
        parsed.verdict = 'rejected'
      }
      
      if (!parsed.sameProblem && parsed.conceptSimilarityPct > 15) {
        parsed.conceptSimilarityPct = 15
      }
      
      if (parsed.conceptSimilarityPct < 10) {
        parsed.verdict = 'rejected'
      }

      console.log(`✅ Concept gate (${model}): ${parsed.verdict} - ${parsed.conceptSimilarityPct}%`)
      return parsed

    } catch (error) {
      console.error(`Concept gate (${model}) failed:`, error)
      continue
    }
  }

  console.warn('⚠️  All concept gate models failed')
  return null
}

// ============================================================================
// STOP WORDS AND TEXT PREPROCESSING
// ============================================================================
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
  'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'using'
])

function preprocessText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Remove special chars
    .split(/\s+/)
    .filter(word => word.length > 2) // Remove very short words
    .filter(word => !STOP_WORDS.has(word)) // Remove stop words
}

// ============================================================================
// ADVANCED SIMILARITY DETECTION ALGORITHMS
// ============================================================================

// 1. N-GRAM TEXT MATCHING
function generateNGrams(text: string, n: number): string[] {
  const words = preprocessText(text) // Use improved preprocessing
  const ngrams: string[] = []
  
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '))
  }
  
  return ngrams
}

function nGramSimilarity(text1: string, text2: string, n: number = 4): number {
  // Test multiple n-gram sizes for better accuracy
  const sizes = [3, 4, 5]
  const similarities = sizes.map(size => {
    const ngrams1 = new Set(generateNGrams(text1, size))
    const ngrams2 = new Set(generateNGrams(text2, size))
    
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0
    
    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)))
    const union = new Set([...ngrams1, ...ngrams2])
    
    return intersection.size / union.size
  })
  
  // Return weighted average favoring larger n-grams
  return (similarities[0] * 0.3 + similarities[1] * 0.4 + similarities[2] * 0.3)
}

// 2. FINGERPRINTING / WINNOWING ALGORITHM
function fingerprint(text: string, windowSize: number = 5): Set<string> {
  const hashes: string[] = []
  const ngrams = generateNGrams(text, 4)
  
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

// 6. CONCEPT EXTRACTION - Extract key concepts from research text
function extractKeyConcepts(text: string): {
  problemDomain: string[]
  methodology: string[]
  technologies: string[]
  applicationArea: string[]
  outcomes: string[]
} {
  const lowerText = text.toLowerCase()
  
  // Problem domain keywords - EXPANDED to better capture research problems
  const problemKeywords = [
    // Action verbs
    'detect', 'detection', 'identify', 'identification', 'recognition', 'recognize',
    'classify', 'classification', 'categorize', 'categorization',
    'analyze', 'analysis', 'examine', 'examination',
    'predict', 'prediction', 'forecast', 'forecasting',
    'monitor', 'monitoring', 'track', 'tracking',
    'measure', 'measurement', 'quantify', 'quantification',
    'assess', 'assessment', 'evaluate', 'evaluation',
    'diagnose', 'diagnosis', 'identify condition',
    'prevent', 'prevention', 'avoid', 'mitigate', 'mitigation',
    'optimize', 'optimization', 'maximize', 'minimize',
    'improve', 'improvement', 'enhance', 'enhancement',
    'solve', 'solution', 'address', 'resolve',
    'manage', 'management', 'control', 'automate', 'automation',
    'recommend', 'recommendation', 'suggest', 'suggestion',
    'verify', 'verification', 'validate', 'validation',
    'search', 'searching', 'retrieve', 'retrieval',
    'generate', 'generation', 'create', 'creation',
    'filter', 'filtering', 'sort', 'sorting',
    
    // Problem descriptors
    'problem', 'issue', 'challenge', 'difficulty',
    'risk', 'threat', 'vulnerability', 'attack',
    'error', 'fault', 'failure', 'defect', 'bug',
    'disease', 'illness', 'disorder', 'symptom',
    'fraud', 'spam', 'fake', 'counterfeit',
    'waste', 'pollution', 'contamination',
    'delay', 'bottleneck', 'inefficiency',
    'shortage', 'scarcity', 'lack',
    'conflict', 'dispute', 'disagreement'
  ]
  
  // Methodology keywords - distinguish implementation from problem
  const methodologyKeywords = [
    'algorithm', 'model', 'method', 'approach', 'technique', 'framework',
    'system', 'architecture', 'design', 'implementation', 'development',
    'machine learning', 'deep learning', 'neural network', 'cnn', 'rnn', 'lstm',
    'supervised', 'unsupervised', 'reinforcement', 'transfer learning',
    'feature extraction', 'data processing', 'training', 'testing', 'validation',
    'pipeline', 'workflow', 'process', 'methodology',
    'agile', 'waterfall', 'scrum', 'iterative',
    'prototype', 'proof of concept', 'mvp'
  ]
  
  // Application area keywords - EXPANDED for better domain matching
  const applicationKeywords = [
    // General domains
    'healthcare', 'health', 'medical', 'clinical', 'hospital', 'patient',
    'education', 'learning', 'teaching', 'student', 'academic', 'school', 'university',
    'agriculture', 'farming', 'crop', 'livestock', 'soil', 'harvest',
    'security', 'cybersecurity', 'safety', 'protection', 'surveillance',
    'transportation', 'traffic', 'vehicle', 'parking', 'navigation', 'logistics',
    'finance', 'banking', 'payment', 'transaction', 'investment', 'trading',
    'retail', 'shopping', 'store', 'customer', 'sales', 'inventory',
    'manufacturing', 'production', 'factory', 'assembly', 'quality control',
    'entertainment', 'gaming', 'media', 'music', 'video', 'movie',
    
    // Specific domains
    'social media', 'social network', 'communication', 'messaging',
    'e-commerce', 'online shopping', 'marketplace',
    'smart city', 'smart home', 'home automation', 'iot',
    'environmental', 'climate', 'weather', 'sustainability',
    'energy', 'power', 'electricity', 'renewable',
    'disaster', 'emergency', 'crisis', 'rescue',
    'tourism', 'travel', 'hotel', 'booking',
    'sports', 'fitness', 'exercise', 'athletics',
    'real estate', 'property', 'housing',
    'government', 'public service', 'civic',
    'legal', 'law', 'justice', 'compliance',
    'human resources', 'recruitment', 'hiring', 'employee'
  ]
  
  // Technology keywords - kept minimal (least important for concept similarity)
  const technologyKeywords = [
    'ai', 'artificial intelligence', 'ml', 'machine learning', 'computer vision',
    'nlp', 'natural language processing', 'image processing', 'video processing',
    'sensor', 'iot', 'cloud', 'mobile', 'web', 'android', 'ios',
    'tensorflow', 'pytorch', 'opencv', 'python', 'java', 'javascript',
    'react', 'angular', 'vue', 'node', 'django', 'flask',
    'mysql', 'mongodb', 'postgresql', 'firebase', 'aws', 'azure'
  ]
  
  // Outcome keywords
  const outcomeKeywords = [
    'accuracy', 'precision', 'recall', 'f1-score',
    'efficiency', 'performance', 'speed', 'throughput',
    'quality', 'effectiveness', 'success rate',
    'productivity', 'output', 'yield',
    'reliability', 'stability', 'robustness',
    'usability', 'user experience', 'satisfaction',
    'accessibility', 'availability', 'uptime',
    'scalability', 'flexibility', 'adaptability',
    'cost reduction', 'savings', 'economical',
    'time saving', 'faster', 'quicker',
    'automation', 'automated', 'autonomous',
    'real-time', 'instant', 'immediate',
    'accurate', 'precise', 'reliable'
  ]
  
  const findMatches = (keywords: string[]) => {
    return keywords.filter(keyword => lowerText.includes(keyword))
  }
  
  return {
    problemDomain: findMatches(problemKeywords),
    methodology: findMatches(methodologyKeywords),
    technologies: findMatches(technologyKeywords),
    applicationArea: findMatches(applicationKeywords),
    outcomes: findMatches(outcomeKeywords)
  }
}

// 7. ENHANCED CONCEPT SIMILARITY - Compare core research problems
function conceptSimilarity(text1: string, text2: string): number {
  const concepts1 = extractKeyConcepts(text1)
  const concepts2 = extractKeyConcepts(text2)
  
  // Calculate similarity for each concept category
  const calculateCategoryMatch = (arr1: string[], arr2: string[]) => {
    if (arr1.length === 0 && arr2.length === 0) return 0
    if (arr1.length === 0 || arr2.length === 0) return 0
    
    const set1 = new Set(arr1)
    const set2 = new Set(arr2)
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    return intersection.size / union.size
  }
  
  // Weight different concept categories
  const problemMatch = calculateCategoryMatch(concepts1.problemDomain, concepts2.problemDomain)
  const methodMatch = calculateCategoryMatch(concepts1.methodology, concepts2.methodology)
  const techMatch = calculateCategoryMatch(concepts1.technologies, concepts2.technologies)
  const appMatch = calculateCategoryMatch(concepts1.applicationArea, concepts2.applicationArea)
  const outcomeMatch = calculateCategoryMatch(concepts1.outcomes, concepts2.outcomes)
  
  // STRICTER SCORING: Problem domain + application area must match for high similarity
  // If addressing different problems or different application areas, cap the score
  const coreProblemMatch = problemMatch * 0.5 + appMatch * 0.5
  
  // If core problem match is very low, cap the entire concept similarity
  let conceptScore = 0
  
  if (coreProblemMatch < 0.15) {
    // Very different core problems - cap at 15%
    conceptScore = Math.min(0.15, coreProblemMatch * 1.5)
  } else if (coreProblemMatch < 0.30) {
    // Somewhat different problems - cap at 30%
    conceptScore = Math.min(0.30, 
      problemMatch * 0.40 +
      appMatch * 0.35 +
      methodMatch * 0.15 +
      techMatch * 0.05 +
      outcomeMatch * 0.05
    )
  } else {
    // Similar core problems - use full weighted scoring
    conceptScore = 
      problemMatch * 0.40 +  // What problem are they solving?
      appMatch * 0.35 +      // Where is it applied?
      methodMatch * 0.15 +   // How do they solve it? (less important)
      techMatch * 0.05 +     // What tech do they use? (least important)
      outcomeMatch * 0.05    // What results do they achieve? (least important)
  }
  
  return conceptScore
}

// 8. MACHINE LEARNING-INSPIRED FEATURE EXTRACTION
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
function calculateMultiAlgorithmSimilarity(text1: string, text2: string, lightweight: boolean = false): {
  nGram: number
  fingerprint: number
  rabinKarp: number
  lcs: number
  sentence: number
  feature: number
  concept: number
  composite: number
  confidence: number
} {
  // For lightweight mode, use faster approximate algorithms
  if (lightweight) {
    const nGram = nGramSimilarity(text1, text2, 2) // Shorter n-grams = faster
    const fingerprintScore = fingerprintSimilarity(text1, text2)
    const rabinKarp = rabinKarpSimilarity(text1, text2, 10) // Shorter pattern = faster
    
    // Skip expensive algorithms (sentence, feature, concept similarity)
    // Use n-gram as approximation for all
    const fastScore = (nGram + fingerprintScore + rabinKarp) / 3
    
    return {
      nGram,
      fingerprint: fingerprintScore,
      rabinKarp,
      lcs: fastScore, // Approximate
      sentence: fastScore, // Approximate
      feature: fastScore, // Approximate
      concept: fastScore, // Approximate
      composite: fastScore,
      confidence: 0.7 // Lower confidence for lightweight
    }
  }
  
  // Full analysis (for top candidates only)
  const nGram = nGramSimilarity(text1, text2, 3)
  const fingerprintScore = fingerprintSimilarity(text1, text2)
  const rabinKarp = rabinKarpSimilarity(text1, text2, 20)
  const lcs = longestCommonSubsequence(text1, text2)
  const sentence = sentenceSimilarity(text1, text2)
  const feature = featureSimilarity(text1, text2)
  const concept = conceptSimilarity(text1, text2)
  
  // Weighted composite score (tuned for academic plagiarism detection)
  // Increased weights for semantic and concept algorithms
  const weights = {
    nGram: 0.15,
    fingerprint: 0.12,
    rabinKarp: 0.08,
    lcs: 0.10,
    sentence: 0.15,
    feature: 0.08,
    concept: 0.32  // ENHANCED: Concept similarity is now the dominant factor (32%)
  }
  
  const composite = 
    nGram * weights.nGram +
    fingerprintScore * weights.fingerprint +
    rabinKarp * weights.rabinKarp +
    lcs * weights.lcs +
    sentence * weights.sentence +
    feature * weights.feature +
    concept * weights.concept
  
  // Calculate confidence based on agreement between algorithms
  const scores = [nGram, fingerprintScore, rabinKarp, lcs, sentence, feature, concept]
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
    concept,
    composite,
    confidence
  }
}

// ============================================================================
// ORIGINAL EMBEDDING AND SIMILARITY FUNCTIONS (UNUSED - Kept for reference)
// ============================================================================

// Combined Lexical Similarity Calculation (No AI/Embeddings)
function generateFallbackExplanation(
  proposedTitle: string,
  proposedConcept: string,
  existingTitle: string,
  existingThesisBrief: string,
  lexicalSim: number,
  multiAlgoSim: number,
  conceptSim: number
): string {
  const avgSim = ((lexicalSim + multiAlgoSim + conceptSim) / 3) * 100
  const lexicalPercent = (lexicalSim * 100).toFixed(1)
  const multiAlgoPercent = (multiAlgoSim * 100).toFixed(1)
  const conceptPercent = (conceptSim * 100).toFixed(1)
  
  // Extract concepts for comparison
  const concepts1 = extractKeyConcepts(proposedConcept)
  const concepts2 = extractKeyConcepts(existingThesisBrief)
  
  if (avgSim >= 70) {
    return `**Are the titles similar?** 
Yes, the titles "${proposedTitle}" and "${existingTitle}" share similar words and talk about the same topic.

**Are they solving the same problem?**
Yes, the researches appear to be solving the same or very similar problems. The concept similarity analysis (${conceptPercent}%) shows they address similar problem domains and applications.

**What concepts do they share?**
- Problem Domain: ${concepts1.problemDomain.length > 0 && concepts2.problemDomain.length > 0 ? 'Both researches focus on similar problems (' + [...new Set([...concepts1.problemDomain, ...concepts2.problemDomain])].slice(0, 3).join(', ') + ')' : 'Similar problem areas'}
- Application: ${concepts1.applicationArea.length > 0 && concepts2.applicationArea.length > 0 ? 'Same application domain (' + [...new Set([...concepts1.applicationArea, ...concepts2.applicationArea])].slice(0, 2).join(', ') + ')' : 'Related applications'}
- Methods: ${concepts1.methodology.length > 0 && concepts2.methodology.length > 0 ? 'Similar approaches (' + [...new Set([...concepts1.methodology, ...concepts2.methodology])].slice(0, 3).join(', ') + ')' : 'Related methodologies'}

**What makes them similar?**
- They share many of the same words and phrases (Lexical: ${lexicalPercent}%)
- They use similar technologies or tools
- They have the same goals or objectives  
- The core concepts and ideas are very similar (Concept: ${conceptPercent}%)
- They solve the same problem in similar ways (Overall: ${multiAlgoPercent}%)

**Why are they similar?**
The similarity score is ${avgSim.toFixed(0)}%, which means these two researches are very similar both in wording AND in their core concepts.

**Bottom line**
These researches are too similar - they might be addressing the same problem with the same approach. You should significantly differentiate your research concept or choose a different problem to solve.`
  } else if (avgSim >= 40) {
    return `**Are the titles similar?**
The titles "${proposedTitle}" and "${existingTitle}" share some similar words, but they might focus on slightly different things.

**Are they solving the same problem?**
They might be solving related problems, but not exactly the same. The concept analysis shows ${conceptPercent}% similarity - they're in the same general area but with different focus.

**What concepts do they share?**
- Problem Domain: ${concepts1.problemDomain.length > 0 && concepts2.problemDomain.length > 0 ? 'Some overlap in problem areas' : 'Different problem focus'}
- Application: ${concepts1.applicationArea.length > 0 && concepts2.applicationArea.length > 0 ? 'Related but distinct application domains' : 'Different applications'}  
- Approach: The methodologies and approaches have some similarities but also notable differences

**What makes them similar?**
- They share some words or phrases (Lexical: ${lexicalPercent}%)
- They might use some of the same technologies
- They're in the same research area
- Some conceptual overlap (Concept: ${conceptPercent}%)
- But they have enough differences to be considered separate (Overall: ${multiAlgoPercent}%)

**Why are they similar?**
The similarity score is ${avgSim.toFixed(0)}%, which means they're somewhat similar but different enough in their core concepts and approaches.

**Bottom line**
These researches are somewhat similar but different enough. Consider emphasizing what makes your research unique - different methodology, different application, or different problem focus.`
  } else {
    return `**Are the titles similar?**
The titles "${proposedTitle}" and "${existingTitle}" are different and talk about different topics.

**Are they solving the same problem?**
No, they are solving different problems. The concept analysis shows only ${conceptPercent}% similarity - they're addressing different research questions or applications.

**What concepts do they share?**
- Limited overlap detected across problem domains, methodologies, and applications
- May use some common technologies but for different purposes
- Different research goals and outcomes

**What makes them similar?**
Not much - they are different researches with different goals and methods:
- Low word similarity (Lexical: ${lexicalPercent}%)
- Different core concepts (Concept: ${conceptPercent}%)
- Different overall approach (Overall: ${multiAlgoPercent}%)

**Why are they similar?**
The similarity score is ${avgSim.toFixed(0)}%, which is low. This means they are different researches addressing different problems or using different approaches.

**Bottom line**
These researches are sufficiently different - they address different problems, use different approaches, or target different applications. Your research appears to be original and distinct from the existing work.`
  }
}

// Generate fallback report without AI
function generateFallbackReport(
  proposedTitle: string,
  proposedConcept: string,
  similarities: Array<{
    title: string
    overallSimilarity: number
    similarityType: string
  }>
): string {
  return `SIMILARITY ANALYSIS REPORT

PROPOSED RESEARCH:
Title: ${proposedTitle}
Concept: ${proposedConcept.substring(0, 300)}...

TOP SIMILAR RESEARCHES:
${similarities.slice(0, 5)
  .map(
    (r, i) => `
${i + 1}. ${r.title}
   Overall Similarity: ${(r.overallSimilarity * 100).toFixed(2)}%
   Type: ${r.similarityType}
`
  )
  .join('\n')}

ANALYSIS:
The similarity analysis has been completed using multiple algorithmic approaches including:
- N-Gram text matching
- Fingerprinting/Winnowing algorithm
- Rabin-Karp string matching
- Longest Common Subsequence (LCS)
- Sentence-level similarity
- TF-IDF lexical analysis

${similarities.length > 0 ? `The highest similarity score detected is ${(similarities[0].overallSimilarity * 100).toFixed(2)}%.` : 'No similar researches found.'}

Note: This analysis uses advanced algorithmic similarity detection without AI-generated explanations.`
}

// Fast Pipeline Report Generator
function generateFastPipelineReport(
  proposedTitle: string,
  proposedConcept: string,
  similarities: Array<{
    title: string
    percentage: number
    interpretation: string
    avgSimilarity: number
    maxSimilarity: number
    vectorSimilarity?: number
    geminiScores?: {
      topicSimilarity: number
      objectiveSimilarity: number
      methodologySimilarity: number
      datasetScopeSimilarity: number
      weightedPercentage: number
    }
  }>,
  performance: {
    totalTime: number
    embeddingTime: number
    vectorSearchTime: number
    detailedAnalysisTime: number
    geminiTime: number
    candidatesTotal: number
    candidatesAfterThreshold: number
    candidatesAnalyzed: number
    candidatesWithGemini: number
  }
): string {
  const topMatch = similarities[0]
  
  return `FAST SIMILARITY ANALYSIS REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROPOSED RESEARCH:
Title: ${proposedTitle}
Concept: ${proposedConcept.substring(0, 300)}${proposedConcept.length > 300 ? '...' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOP SIMILAR RESEARCHES:
${similarities.slice(0, 5)
  .map(
    (r, i) => `
${i + 1}. ${r.title}
   ├─ Overall Similarity: ${r.percentage}% (${r.interpretation})
   ├─ Average Chunk Similarity: ${(r.avgSimilarity * 100).toFixed(1)}%
   ├─ Maximum Chunk Similarity: ${(r.maxSimilarity * 100).toFixed(1)}%
   ${r.vectorSimilarity ? `├─ Vector Search Score: ${(r.vectorSimilarity * 100).toFixed(1)}%` : ''}
   ${r.geminiScores ? `└─ Gemini Validation: Topic ${(r.geminiScores.topicSimilarity * 100).toFixed(0)}%, Objective ${(r.geminiScores.objectiveSimilarity * 100).toFixed(0)}%, Methodology ${(r.geminiScores.methodologySimilarity * 100).toFixed(0)}%, Dataset ${(r.geminiScores.datasetScopeSimilarity * 100).toFixed(0)}%` : '└─ (No Gemini validation)'}
`
  )
  .join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSIS ARCHITECTURE (Fast Pipeline):

✓ Text Preprocessing & Chunking
  → Removed references, boilerplate
  → Chunked into 600-token segments with 100-token overlap

✓ Embedding Generation (Gemini text-embedding-004)
  → Generated semantic embeddings for all chunks
  → Cached for fast re-use

✓ Vector Search (Top-K Candidates)
  → Searched ${performance.candidatesTotal} researches
  → Selected top ${performance.candidatesAnalyzed} candidates
  → Filtered by 30% threshold: ${performance.candidatesAfterThreshold} passed

✓ Detailed Chunk-Level Analysis
  → All-pairs chunk comparison
  → Aggregation: (60% average) + (40% maximum)

${performance.candidatesWithGemini > 0 ? `✓ Gemini AI Validation (Top ${performance.candidatesWithGemini})
  → 4-dimension semantic scoring
  → Topic, Objective, Methodology, Dataset analysis
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERFORMANCE METRICS:

Total Processing Time: ${(performance.totalTime / 1000).toFixed(2)}s
├─ Embedding: ${performance.embeddingTime}ms
├─ Vector Search: ${performance.vectorSearchTime}ms
├─ Detailed Analysis: ${performance.detailedAnalysisTime}ms
└─ Gemini Validation: ${performance.geminiTime}ms

Speedup: ~${Math.round((performance.candidatesTotal * 3000) / performance.totalTime)}x faster than naive approach
Efficiency: Processed ${performance.candidatesAnalyzed} of ${performance.candidatesTotal} researches (${((performance.candidatesAnalyzed / performance.candidatesTotal) * 100).toFixed(1)}%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONCLUSION:

${topMatch ? 
  `The highest similarity detected is ${topMatch.percentage}% with "${topMatch.title}".
This indicates ${topMatch.interpretation.toLowerCase()}.

${topMatch.percentage >= 80 ? 
  '⚠️  WARNING: Very high similarity detected. This may indicate substantial overlap or potential plagiarism. Please review carefully.' :
topMatch.percentage >= 60 ?
  '⚠️  CAUTION: High similarity detected. Significant overlap exists. Consider revising to increase originality.' :
topMatch.percentage >= 40 ?
  'ℹ️  MODERATE: Moderate similarity found. Some overlap exists but may be acceptable depending on context.' :
  '✓ LOW: Low similarity detected. Research appears reasonably distinct.'}`
  : 
  'No significant similarity found. This research appears to be unique.'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Note: This analysis uses state-of-the-art semantic embeddings and AI validation
for the most accurate similarity detection.`
}

// Combined Lexical Similarity Calculation (No AI/Embeddings)
async function calculateCosineSimilarity(
  proposedTitle: string,
  proposedConcept: string,
  existingResearches: Array<{ 
    id?: string
    title: string
    thesis_brief: string
    year?: number
    course?: string
    researchers?: string[]
  }>
): Promise<Array<{
  id?: string
  title: string
  thesis_brief: string
  year?: number
  course?: string
  researchers?: string[]
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
    ...existingResearches.map(r => r.thesis_brief)
  ]

  // Calculate lexical similarity (TF-IDF)
  const proposedTitleVec = calculateTfIdf(proposedTitle, allTitles)
  const proposedConceptVec = calculateTfIdf(proposedConcept, allAbstracts)

  // ===================================================================
  // FAST TWO-PASS APPROACH: Quick filter → Detailed analysis
  // ===================================================================
  console.log('Phase 1: Quick pre-filtering...')
  
  // PASS 1: Quick lexical filtering (fast, no heavy algorithms)
  const quickResults = existingResearches.map((research, index) => {
    const existingTitleVec = calculateTfIdf(research.title, allTitles)
    const existingAbstractVec = calculateTfIdf(research.thesis_brief, allAbstracts)

    const titleLexicalSim = cosineSimilarity(proposedTitleVec, existingTitleVec)
    const abstractLexicalSim = cosineSimilarity(proposedConceptVec, existingAbstractVec)
    
    // Quick overall score (TF-IDF only)
    const quickScore = titleLexicalSim * 0.35 + abstractLexicalSim * 0.65
    
    return {
      research,
      index,
      quickScore,
      titleLexicalSim,
      abstractLexicalSim
    }
  })
  
  // Sort by quick score and split into tiers
  // TOP 3: Full detailed analysis (all 7 algorithms)
  // NEXT 7: Lightweight analysis (faster approximations)
  const sortedCandidates = quickResults.sort((a, b) => b.quickScore - a.quickScore)
  
  const top3Candidates = sortedCandidates.slice(0, 3)
  const next7Candidates = sortedCandidates.slice(3, 10)
  
  console.log(`Phase 1 complete: Selected top 3 for full analysis + 7 for lightweight analysis from ${existingResearches.length} researches`)
  
  // PASS 2A: Full detailed analysis on TOP 3 only
  console.log('Phase 2A: Full multi-algorithm analysis on top 3 candidates...')
  const top3Results = await Promise.all(
    top3Candidates.map(async ({ research, index, titleLexicalSim, abstractLexicalSim }) => {
      const titleWords = new Set(preprocess(proposedTitle))
      const abstractWords = new Set(preprocess(proposedConcept))
      const existingTitleWords = new Set(preprocess(research.title))
      const existingAbstractWords = new Set(preprocess(research.thesis_brief))
      
      const titleOverlap = titleWords.size > 0 
        ? [...titleWords].filter(w => existingTitleWords.has(w)).length / titleWords.size
        : 0
      const abstractOverlap = abstractWords.size > 0
        ? [...abstractWords].filter(w => existingAbstractWords.has(w)).length / abstractWords.size
        : 0
      
      const enhancedTitleLexical = titleLexicalSim * 0.7 + titleOverlap * 0.3
      const enhancedAbstractLexical = abstractLexicalSim * 0.7 + abstractOverlap * 0.3
      const lexicalSim = enhancedTitleLexical * 0.35 + enhancedAbstractLexical * 0.65

      // FULL analysis with all 7 algorithms
      const titleMultiAlgo = calculateMultiAlgorithmSimilarity(proposedTitle, research.title, false)
      const abstractMultiAlgo = calculateMultiAlgorithmSimilarity(proposedConcept, research.thesis_brief, false)
      
      // Combine multi-algorithm scores
      const multiAlgoTitleScore = titleMultiAlgo.composite
      const multiAlgoAbstractScore = abstractMultiAlgo.composite
      const multiAlgoOverallScore = multiAlgoTitleScore * 0.4 + multiAlgoAbstractScore * 0.6
      
      // Calculate confidence-weighted score
      const avgConfidence = (titleMultiAlgo.confidence + abstractMultiAlgo.confidence) / 2
      
      // ============================================================
      // CONCEPT-BASED SIMILARITY ENHANCEMENT (STRICTER)
      // ============================================================
      // Check if the researches are addressing the same core concept
      const conceptualMatch = abstractMultiAlgo.concept
      
      // STRICTER: Only boost if conceptual match is actually significant
      // This aligns with AI concept gate logic (different problems = low similarity)
      let conceptBoost = 1.0
      if (conceptualMatch > 0.50) {
        // Very high concept match - likely same core idea
        conceptBoost = 1.30
      } else if (conceptualMatch > 0.35) {
        // Moderate-high concept match - related ideas
        conceptBoost = 1.20
      } else if (conceptualMatch > 0.25) {
        // Some concept overlap
        conceptBoost = 1.10
      } else if (conceptualMatch > 0.15) {
        // Slight concept overlap
        conceptBoost = 1.05
      }
      // If conceptualMatch <= 0.15, no boost (different core problems)
      
      // ============================================================
      // COMPREHENSIVE OVERALL SIMILARITY (7 ALGORITHMS + CONCEPT)
      // ============================================================
      // Title algorithms (40% weight)
      const titleAlgorithms = [
        enhancedTitleLexical,      // TF-IDF Lexical
        titleMultiAlgo.nGram,      // N-Gram
        titleMultiAlgo.fingerprint, // Fingerprinting
        titleMultiAlgo.rabinKarp,  // Rabin-Karp
        titleMultiAlgo.lcs,        // LCS
        titleMultiAlgo.sentence,   // Sentence Similarity
        titleMultiAlgo.concept     // Concept Similarity
      ]
      
      // Abstract algorithms (60% weight)
      const abstractAlgorithms = [
        enhancedAbstractLexical,      // TF-IDF Lexical
        abstractMultiAlgo.nGram,      // N-Gram
        abstractMultiAlgo.fingerprint, // Fingerprinting
        abstractMultiAlgo.rabinKarp,  // Rabin-Karp
        abstractMultiAlgo.lcs,        // LCS
        abstractMultiAlgo.sentence,   // Sentence Similarity
        abstractMultiAlgo.concept     // Concept Similarity
      ]
      
      // Calculate average of all 7 algorithms for title and abstract
      const avgTitleScore = titleAlgorithms.reduce((sum, score) => sum + score, 0) / titleAlgorithms.length
      const avgAbstractScore = abstractAlgorithms.reduce((sum, score) => sum + score, 0) / abstractAlgorithms.length
      
      // ============================================================
      // IDENTICAL/NEAR-IDENTICAL TEXT DETECTION
      // ============================================================
      // Check if texts are identical or near-identical
      const titleIdentical = proposedTitle.trim().toLowerCase() === research.title.trim().toLowerCase()
      const abstractIdentical = proposedConcept.trim().toLowerCase() === research.thesis_brief.trim().toLowerCase()
      
      // Check if very high similarity across multiple algorithms (likely identical)
      const veryHighScores = titleAlgorithms.filter(s => s > 0.9).length + 
                             abstractAlgorithms.filter(s => s > 0.9).length
      
      // If text is identical or nearly identical, set to very high score
      let overallSim: number
      if ((titleIdentical && abstractIdentical) || veryHighScores >= 10) {
        // Texts are identical or virtually identical
        overallSim = 0.98 // 98% to account for minor preprocessing differences
      } else if (titleIdentical || abstractIdentical || veryHighScores >= 7) {
        // One is identical or most algorithms show very high similarity
        overallSim = Math.max(0.95, (avgTitleScore * 0.4 + avgAbstractScore * 0.6) * conceptBoost)
      } else {
        // Normal calculation with concept boost
        overallSim = (avgTitleScore * 0.4 + avgAbstractScore * 0.6) * conceptBoost
      }
      
      // ============================================================
      // ADVANCED MULTI-ALGORITHM SECURITY VALIDATIONS
      // ============================================================
      
      // 1. Cross-Algorithm Consensus Detection
      // Check if multiple algorithms independently detect high similarity
      const highSimilarityCount = [
        titleMultiAlgo.nGram > 0.4,        // More sensitive threshold
        titleMultiAlgo.fingerprint > 0.4,   // More sensitive threshold
        titleMultiAlgo.rabinKarp > 0.4,     // More sensitive threshold
        titleMultiAlgo.lcs > 0.4,           // More sensitive threshold
        abstractMultiAlgo.nGram > 0.4,      // More sensitive threshold
        abstractMultiAlgo.fingerprint > 0.4, // More sensitive threshold
        abstractMultiAlgo.rabinKarp > 0.4,   // More sensitive threshold
        abstractMultiAlgo.lcs > 0.4,         // More sensitive threshold
        abstractMultiAlgo.concept > 0.35,    // ENHANCED: Lower threshold for concept detection
        titleMultiAlgo.concept > 0.35        // ENHANCED: Check title concepts too
      ].filter(Boolean).length
      
      if (highSimilarityCount >= 7) {
        // 7+ algorithms agree on high similarity - very strong evidence
        overallSim = Math.min(1, overallSim * 1.30) // 30% boost for strong consensus
      } else if (highSimilarityCount >= 5) {
        // 5-6 algorithms agree - strong evidence
        overallSim = Math.min(1, overallSim * 1.22) // 22% boost for strong consensus
      } else if (highSimilarityCount >= 4) {
        // 4 algorithms agree - moderate evidence
        overallSim = Math.min(1, overallSim * 1.15) // 15% boost for moderate consensus
      } else if (highSimilarityCount >= 3) {
        // 3 algorithms agree - some evidence
        overallSim = Math.min(1, overallSim * 1.08) // 8% boost for some consensus
      }
      
      // 2. Concept-Based Plagiarism Detection (STRICTER THRESHOLDS)
      // Detect if the core concept is the same even with different wording
      // Skip if already detected as identical
      if (overallSim < 0.95) {
        if (abstractMultiAlgo.concept > 0.50) {
          // Very high concept similarity = same core idea (more strict threshold)
          overallSim = Math.min(1, overallSim * 1.25) // 25% boost for conceptual match
        } else if (abstractMultiAlgo.concept > 0.35 && enhancedAbstractLexical < 0.45) {
          // High concept similarity but low word match = paraphrased plagiarism (stricter)
          overallSim = Math.min(1, overallSim * 1.18) // 18% boost for paraphrased concepts
        } else if (abstractMultiAlgo.concept > 0.25 && enhancedAbstractLexical < 0.35) {
          // Moderate concept similarity with very low word match = sophisticated paraphrasing
          overallSim = Math.min(1, overallSim * 1.12) // 12% boost for sophisticated paraphrasing
        }
        // If concept < 0.25, no boost (different core problems)
      }
      
      // 3. Structural Similarity Detection (LCS + Fingerprint)
      // Detect if document structure is copied even with word changes
      // Skip additional boosts if already at very high similarity
      if (overallSim < 0.95) {
        const structuralSimilarity = (abstractMultiAlgo.lcs + abstractMultiAlgo.fingerprint) / 2
        if (structuralSimilarity > 0.7 && enhancedAbstractLexical < 0.4) {
          // High structural similarity but low lexical = sophisticated plagiarism
          overallSim = Math.min(1, overallSim * 1.18) // 18% boost for structural plagiarism
        }
        
        // 4. Pattern-Based Plagiarism Detection (N-Gram + Rabin-Karp)
        // Detect repeated patterns and phrases
        const patternSimilarity = (abstractMultiAlgo.nGram + abstractMultiAlgo.rabinKarp) / 2
        if (patternSimilarity > 0.65) {
          // High pattern similarity indicates copied phrases
          overallSim = Math.min(1, overallSim * 1.12) // 12% boost for pattern copying
        }
        
        // 5. Sentence-Level Plagiarism Detection
        // Check if individual sentences are copied
        if (abstractMultiAlgo.sentence > 0.7) {
          // High sentence similarity even with different words
          overallSim = Math.min(1, overallSim * 1.14) // 14% boost for sentence plagiarism
        }
        
        // 6. Title Plagiarism with Abstract Similarity
        // Detect if title is very similar AND abstract has some similarity
        if (enhancedTitleLexical > 0.8 && avgAbstractScore > 0.3) {
          // Same/similar title with related content = likely plagiarism
          overallSim = Math.min(1, overallSim * 1.10) // 10% boost for title+content match
        }
        
        // 7. Fingerprint Hash Collision Detection
        // Multiple hash matches indicate direct copying
        if (titleMultiAlgo.fingerprint > 0.75 && abstractMultiAlgo.fingerprint > 0.75) {
          // Very high fingerprint similarity = direct copy
          overallSim = Math.min(1, overallSim * 1.20) // 20% boost for hash collision
        }
        
        // 8. Sequential Text Similarity (LCS)
        // Long common subsequences indicate large copied sections
        if (abstractMultiAlgo.lcs > 0.75) {
          // Very long common subsequence = substantial copying
          overallSim = Math.min(1, overallSim * 1.13) // 13% boost for sequential copying
        }
        
        // 9. Multi-Pattern Agreement (N-Gram + Rabin-Karp + Fingerprint)
        // Triple agreement on pattern matching
        const patternAgreement = (abstractMultiAlgo.nGram + abstractMultiAlgo.rabinKarp + abstractMultiAlgo.fingerprint) / 3
        if (patternAgreement > 0.7) {
          // All pattern algorithms agree = strong evidence
          overallSim = Math.min(1, overallSim * 1.16) // 16% boost for triple pattern agreement
        }
        
        // 10. Confidence-Weighted Security Enhancement
        // Higher confidence means more reliable detection
        if (avgConfidence > 0.85) {
          overallSim = Math.min(1, overallSim * 1.08) // 8% boost for very high confidence
        } else if (avgConfidence > 0.75) {
          overallSim = Math.min(1, overallSim * 1.05) // 5% boost for high confidence
        }
        
        // 11. Synonym Substitution Detection
        // Detect if words are changed but sentence structure remains
        if (abstractMultiAlgo.sentence > 0.6 && abstractMultiAlgo.lcs > 0.5 && enhancedAbstractLexical < 0.35) {
          // High sentence/structure similarity but low word match = synonym substitution
          overallSim = Math.min(1, overallSim * 1.15) // 15% boost for synonym plagiarism
        }
      }
      
      // Calculate combined title and abstract similarity for display
      const combinedTitleSim = avgTitleScore
      const combinedAbstractSim = avgAbstractScore

      // Determine similarity type with multi-algorithm and concept context
      let similarityType: 'Lexical' | 'Conceptual' | 'Both'
      if (lexicalSim > 0.5 && multiAlgoOverallScore > 0.5) {
        similarityType = 'Both'
      } else if (abstractMultiAlgo.concept > 0.6 || (multiAlgoAbstractScore > 0.6 && abstractMultiAlgo.sentence > 0.6)) {
        // High concept similarity OR high semantic similarity = Conceptual
        similarityType = 'Conceptual'
      } else {
        similarityType = 'Lexical'
      }

      // ============================================================
      // ACCURATE COSINE SIMILARITY (DISABLED - Too slow)
      // ============================================================
      // This embedding-based approach was taking 80+ seconds per comparison
      // Disabled to improve performance from 40+ minutes to under 1 minute
      
      /* DISABLED - Uncomment to re-enable embedding-based analysis
      let accurateCosineResult: AccurateCosineResult | null = null
      
      // Run accurate cosine similarity for cases with moderate to high similarity
      // This provides the most accurate semantic similarity using Gemini embeddings
      if (overallSim > 0.25 && process.env.GEMINI_API_KEY) {
        try {
          console.log(`[Accurate Cosine] Analyzing: ${research.title.substring(0, 50)}...`)
          accurateCosineResult = await calculateAccurateCosine(
            proposedConcept,
            research.thesis_brief,
            600, // chunk size (500-800 tokens)
            100  // overlap (100 tokens)
          )
          
          console.log(`[Accurate Cosine] Result: ${accurateCosineResult.percentage}% (${accurateCosineResult.interpretation})`)
          
          // Use accurate cosine as the authoritative semantic score
          // Formula: (60% avg) + (40% max) with penalties
          const accurateCosineScore = accurateCosineResult.finalSimilarity
          
          // Blend with algorithmic score: 50% algo + 50% accurate cosine
          // This balances traditional algorithms with semantic embeddings
          overallSim = (overallSim * 0.50) + (accurateCosineScore * 0.50)
          
          console.log(`[Accurate Cosine] Blended overall similarity: ${(overallSim * 100).toFixed(2)}%`)
        } catch (error) {
          console.error('[Accurate Cosine] Error:', error)
          // Fallback to Gemini semantic scoring if accurate cosine fails
        }
      }
      */ // END DISABLED ACCURATE COSINE

      // ============================================================
      // GEMINI SEMANTIC SIMILARITY SCORING (DISABLED - Too slow)
      // ============================================================
      // Also causes rate limits and slow processing
      // Using pure algorithm-based scoring for speed
      
      /* DISABLED - Uncomment to re-enable Gemini scoring
      let geminiResult: GeminiSimilarityResult | null = null
      
      // Run Gemini semantic scoring if accurate cosine wasn't used
      if (!accurateCosineResult && overallSim > 0.25 && process.env.GEMINI_API_KEY) {
        try {
          console.log(`[Gemini Scoring] Analyzing similarity for: ${research.title.substring(0, 50)}...`)
          geminiResult = await scoreSemanticSimilarity(
            proposedTitle,
            proposedConcept,
            research.title,
            research.thesis_brief,
            2 // 2 retries for stability
          )
          
          if (geminiResult.isValid) {
            console.log(`[Gemini Scoring] Result: ${geminiResult.weightedPercentage}%`, geminiResult.scores)
            
            const geminiScore = geminiResult.weightedPercentage / 100
            
            // Blend Gemini score with algorithmic score (70% algo, 30% Gemini)
            overallSim = (overallSim * 0.70) + (geminiScore * 0.30)
            
            console.log(`[Gemini Scoring] Adjusted overall similarity: ${(overallSim * 100).toFixed(2)}%`)
          } else {
            console.warn(`[Gemini Scoring] Failed: ${geminiResult.error}`)
          }
        } catch (error) {
          console.error('[Gemini Scoring] Unexpected error:', error)
        }
      }
      */ // END DISABLED GEMINI SCORING

      // Generate explanation using fallback only (no Gemini API)
      const explanation = generateFallbackExplanation(
        proposedTitle,
        proposedConcept,
        research.title,
        research.thesis_brief,
        lexicalSim,
        multiAlgoOverallScore,
        abstractMultiAlgo.concept
      )

      return {
        id: research.id,
        title: research.title,
        thesis_brief: research.thesis_brief,
        year: research.year,
        course: research.course,
        researchers: research.researchers,
        titleSimilarity: Math.round(combinedTitleSim * 10000) / 10000,
        abstractSimilarity: Math.round(combinedAbstractSim * 10000) / 10000,
        overallSimilarity: Math.round(overallSim * 10000) / 10000,
        lexicalSimilarity: Math.round(lexicalSim * 10000) / 10000,
        semanticSimilarity: Math.round(multiAlgoOverallScore * 10000) / 10000,
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
          conceptSimilarity: Math.round(abstractMultiAlgo.concept * 10000) / 10000,
          multiAlgoComposite: Math.round(multiAlgoOverallScore * 10000) / 10000,
          confidence: Math.round(avgConfidence * 10000) / 10000
        }
        // Note: Gemini and Accurate Cosine disabled for performance
      }
    })
  )
  
  // PASS 2B: Lightweight analysis on next 7 candidates
  console.log('Phase 2B: Lightweight analysis on next 7 candidates...')
  const next7Results = await Promise.all(
    next7Candidates.map(async ({ research, index, titleLexicalSim, abstractLexicalSim }) => {
      const enhancedTitleLexical = titleLexicalSim
      const enhancedAbstractLexical = abstractLexicalSim
      const lexicalSim = enhancedTitleLexical * 0.35 + enhancedAbstractLexical * 0.65

      // LIGHTWEIGHT analysis (faster approximations)
      const titleMultiAlgo = calculateMultiAlgorithmSimilarity(proposedTitle, research.title, true)
      const abstractMultiAlgo = calculateMultiAlgorithmSimilarity(proposedConcept, research.thesis_brief, true)
      
      const multiAlgoTitleScore = titleMultiAlgo.composite
      const multiAlgoAbstractScore = abstractMultiAlgo.composite
      const multiAlgoOverallScore = multiAlgoTitleScore * 0.35 + multiAlgoAbstractScore * 0.65
      
      const avgConfidence = (titleMultiAlgo.confidence + abstractMultiAlgo.confidence) / 2
      const combinedTitleSim = multiAlgoTitleScore
      const combinedAbstractSim = multiAlgoAbstractScore
      
      let overallSim = (combinedTitleSim * 0.4 + combinedAbstractSim * 0.6)
      const similarityType: 'Lexical' | 'Conceptual' | 'Both' = 'Lexical'
      
      const explanation = `Lightweight similarity analysis: ${(overallSim * 100).toFixed(1)}% match using fast algorithms`

      return {
        id: research.id,
        title: research.title,
        thesis_brief: research.thesis_brief,
        year: research.year,
        course: research.course,
        researchers: research.researchers,
        titleSimilarity: Math.round(combinedTitleSim * 10000) / 10000,
        abstractSimilarity: Math.round(combinedAbstractSim * 10000) / 10000,
        overallSimilarity: Math.round(overallSim * 10000) / 10000,
        lexicalSimilarity: Math.round(lexicalSim * 10000) / 10000,
        semanticSimilarity: Math.round(multiAlgoOverallScore * 10000) / 10000,
        similarityType,
        explanation,
        algorithmScores: {
          nGram: Math.round(abstractMultiAlgo.nGram * 10000) / 10000,
          fingerprint: Math.round(abstractMultiAlgo.fingerprint * 10000) / 10000,
          rabinKarp: Math.round(abstractMultiAlgo.rabinKarp * 10000) / 10000,
          lcs: Math.round(abstractMultiAlgo.lcs * 10000) / 10000,
          sentenceSimilarity: Math.round(abstractMultiAlgo.sentence * 10000) / 10000,
          featureSimilarity: Math.round(abstractMultiAlgo.feature * 10000) / 10000,
          conceptSimilarity: Math.round(abstractMultiAlgo.concept * 10000) / 10000,
          multiAlgoComposite: Math.round(multiAlgoOverallScore * 10000) / 10000,
          confidence: Math.round(avgConfidence * 10000) / 10000
        }
      }
    })
  )
  
  // Add remaining researches with quick scores only (no detailed analysis needed)
  const detailedIds = new Set([...top3Results.map(r => r.id), ...next7Results.map(r => r.id)])
  const remainingResults = quickResults
    .filter(qr => !detailedIds.has(qr.research.id))
    .map(({ research, quickScore, titleLexicalSim, abstractLexicalSim }) => ({
      id: research.id,
      title: research.title,
      thesis_brief: research.thesis_brief,
      year: research.year,
      course: research.course,
      researchers: research.researchers,
      titleSimilarity: Math.round(titleLexicalSim * 10000) / 10000,
      abstractSimilarity: Math.round(abstractLexicalSim * 10000) / 10000,
      overallSimilarity: Math.round(quickScore * 10000) / 10000,
      lexicalSimilarity: Math.round(quickScore * 10000) / 10000,
      semanticSimilarity: Math.round(quickScore * 10000) / 10000,
      similarityType: 'Lexical' as const,
      explanation: 'Quick TF-IDF similarity score (detailed analysis not performed for low matches)',
      algorithmScores: {
        nGram: 0,
        fingerprint: 0,
        rabinKarp: 0,
        lcs: 0,
        sentenceSimilarity: 0,
        featureSimilarity: 0,
        conceptSimilarity: 0,
        multiAlgoComposite: Math.round(quickScore * 10000) / 10000,
        confidence: 0.5
      }
    }))
  
  // Combine all results: 3 full + 7 lightweight + 22 quick
  const allResults = [...top3Results, ...next7Results, ...remainingResults]
  console.log(`Phase 2 complete: ${top3Results.length} full + ${next7Results.length} lightweight + ${remainingResults.length} quick = ${allResults.length} total results`)

  return allResults.sort((a, b) => b.overallSimilarity - a.overallSimilarity)
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

    // Validate that we have content to check
    // Title can be empty, but we must have concept
    if (!proposedConcept || proposedConcept.trim().length === 0) {
      console.error('Missing required parameter: proposedConcept')
      return NextResponse.json(
        { 
          error: 'Research concept is required',
          details: 'Missing parameter: proposedConcept',
          received: {
            proposedTitle: proposedTitle || 'EMPTY',
            proposedConcept: proposedConcept ? `${proposedConcept.length} characters` : 'EMPTY'
          }
        },
        { status: 400 }
      )
    }

    // Use title or default to "Untitled Research"
    const titleToUse = proposedTitle && proposedTitle.trim() ? proposedTitle.trim() : 'Untitled Research'

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
      .select('id, title, thesis_brief, year, course, researchers')
    
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
      thesis_brief: r.thesis_brief || '',
      year: r.year,
      course: r.course,
      researchers: r.researchers || [],
    }))

    console.log(`Found ${existingResearches.length} researches in database to compare against`)
    
    // Log first few researches for debugging
    if (existingResearches.length > 0) {
      console.log('Sample researches:', existingResearches.slice(0, 3).map(r => ({
        id: r.id,
        title: r.title.substring(0, 50),
        thesisBriefLength: r.thesis_brief.length
      })))
    }

    // If no researches in database, return early
    if (existingResearches.length === 0) {
      return NextResponse.json({
        success: true,
        proposedTitle: titleToUse,
        proposedConcept,
        similarities: [],
        report: `No existing researches found in the database to compare against.\n\nYour proposed research:\nTitle: ${titleToUse}\nConcept: ${proposedConcept}\n\nThis research appears to be unique as there are no existing researches in the database for comparison.`,
        totalComparisons: 0,
        message: 'No researches found in database for comparison'
      })
    }

    // ============================================================
    // HYBRID PIPELINE: Algorithm Filtering → AI Validation
    // ============================================================
    console.log('Starting HYBRID SIMILARITY PIPELINE (Algorithm → AI Validation)...')
    console.log(`Comparing against ${existingResearches.length} researches`)
    
    const startTime = Date.now()

    // STEP 1: Use algorithms to get top 3 candidates
    console.log('Step 1: Running multi-algorithm similarity calculation...')
    const algorithmStartTime = Date.now()
    
    const similarities = await calculateCosineSimilarity(
      titleToUse,
      proposedConcept,
      existingResearches
    )

    console.log(`Algorithm calculation complete. Found ${similarities.length} comparisons.`)
    
    // Sort by overall similarity and get top 3
    const top3Candidates = similarities
      .sort((a, b) => b.overallSimilarity - a.overallSimilarity)
      .slice(0, 3)
    
    const algorithmTime = Date.now() - algorithmStartTime
    
    console.log('Top 3 candidates from algorithms:', top3Candidates.map(s => ({
      title: s.title.substring(0, 50),
      algorithmScore: (s.overallSimilarity * 100).toFixed(2) + '%'
    })))

    // STEP 2: AI Validation DISABLED (too slow with rate limits)
    // Using algorithm scores only for faster results
    console.log('Step 2: Skipping AI validation (using algorithm scores only)...')
    
    const aiValidatedResults = top3Candidates.map(c => ({ 
      ...c, 
      pipelineUsed: 'hybrid-algorithm-only',
      algorithmSimilarity: c.overallSimilarity,
      aiSimilarity: c.overallSimilarity, // Use algorithm score as AI score
      semanticSimilarity: c.overallSimilarity,
      explanation: c.explanation || 'Analysis based on multi-algorithm calculation (TF-IDF, N-Gram, Cosine Similarity)'
    }))

    console.log(`✅ Processing complete for ${aiValidatedResults.length} candidates (algorithm-based)`)

    /* AI VALIDATION DISABLED - Uncomment to re-enable
    const aiStartTime = Date.now()
    
    let aiValidatedResults = []
    let useAI = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    
    if (useAI && top3Candidates.length > 0) {
      try {
        aiValidatedResults = await Promise.all(
          top3Candidates.map(async (candidate) => {
            const gateResult = await runConceptGate(
              titleToUse,
              proposedConcept,
              candidate.title,
              candidate.thesis_brief
            )
            
            // Combine algorithm score with AI validation
            const aiSimilarity = gateResult ? gateResult.conceptSimilarityPct / 100 : candidate.overallSimilarity
            const combinedSimilarity = gateResult 
              ? (candidate.overallSimilarity * 0.3 + aiSimilarity * 0.7) // 30% algorithm, 70% AI
              : candidate.overallSimilarity
            
            return {
              ...candidate,
              overallSimilarity: combinedSimilarity,
              algorithmSimilarity: candidate.overallSimilarity,
              aiSimilarity: aiSimilarity,
              semanticSimilarity: aiSimilarity,
              conceptGate: gateResult,
              explanation: gateResult?.reason || candidate.explanation,
              pipelineUsed: 'hybrid-validated'
            }
          })
        )
        
        console.log(`✅ AI validation complete for ${aiValidatedResults.length} candidates`)
      } catch (error) {
        console.error('AI validation failed, using algorithm scores only:', error)
        aiValidatedResults = top3Candidates.map(c => ({ 
          ...c, 
          pipelineUsed: 'hybrid-fallback',
          aiValidationFailed: true
        }))
      }
    } else {
      console.log('⚠️  No AI provider available, using algorithm scores only')
      aiValidatedResults = top3Candidates.map(c => ({ 
        ...c, 
        pipelineUsed: 'algorithm-only',
        aiValidationSkipped: true
      }))
    }
    
    const aiTime = Date.now() - aiStartTime
    */ // END OF DISABLED AI VALIDATION
    
    const totalTime = Date.now() - startTime

    // Sort by final combined similarity
    const finalResults = aiValidatedResults.sort((a, b) => b.overallSimilarity - a.overallSimilarity)

    // Generate comprehensive report
    let report = `ALGORITHM-BASED SIMILARITY ANALYSIS (Fast Mode)\n`
    report += `${'='.repeat(80)}\n\n`
    report += `Proposed Research:\n`
    report += `Title: ${titleToUse}\n`
    report += `Concept: ${proposedConcept.substring(0, 200)}${proposedConcept.length > 200 ? '...' : ''}\n\n`
    report += `Analysis Method: Multi-Algorithm Pipeline\n`
    report += `  Algorithms: TF-IDF, Cosine Similarity, N-Gram, Fingerprint, LCS\n`
    report += `  Note: AI validation disabled for faster processing\n`
    report += `Total Database Entries: ${existingResearches.length}\n`
    report += `Candidates Analyzed: ${top3Candidates.length}\n`
    report += `Processing Time: ${totalTime}ms (Algorithm: ${algorithmTime}ms)\n\n`
    
    if (finalResults.length === 0) {
      report += `No similar research found in database.\n`
    } else {
      report += `Top ${finalResults.length} Most Similar Research:\n\n`
      finalResults.forEach((sim, idx) => {
        report += `${idx + 1}. ${sim.title}\n`
        report += `   Overall Similarity: ${(sim.overallSimilarity * 100).toFixed(1)}%\n`
        report += `   Lexical Similarity: ${(sim.lexicalSimilarity * 100).toFixed(1)}%\n`
        
        if ('algorithmScores' in sim && sim.algorithmScores) {
          report += `   Algorithm Breakdown:\n`
          report += `     - N-Gram: ${(sim.algorithmScores.nGram * 100).toFixed(1)}%\n`
          report += `     - Fingerprint: ${(sim.algorithmScores.fingerprint * 100).toFixed(1)}%\n`
          report += `     - Rabin-Karp: ${(sim.algorithmScores.rabinKarp * 100).toFixed(1)}%\n`
          report += `     - LCS: ${(sim.algorithmScores.lcs * 100).toFixed(1)}%\n`
          report += `     - Sentence Sim: ${(sim.algorithmScores.sentenceSimilarity * 100).toFixed(1)}%\n`
          report += `     - Feature Sim: ${(sim.algorithmScores.featureSimilarity * 100).toFixed(1)}%\n`
        }
        
        report += `   Year: ${sim.year || 'N/A'}\n`
        report += `   Course: ${sim.course || 'N/A'}\n\n`
      })
    }
    
    console.log('Hybrid similarity report generated')

    return NextResponse.json({
      success: true,
      proposedTitle: titleToUse,
      proposedConcept,
      similarities: finalResults,
      report,
      totalComparisons: similarities.length,
      candidatesEvaluated: top3Candidates.length,
      aiValidated: false, // AI validation disabled
      performance: {
        totalTime,
        algorithmTime,
        aiValidationTime: 0, // No AI validation
        averagePerComparison: similarities.length > 0 ? algorithmTime / similarities.length : 0
      },
      pipelineUsed: 'algorithm-only'
    })
  } catch (error) {
    console.error('Similarity check error:', error)
    return NextResponse.json(
      { error: 'Failed to check similarity', details: String(error) },
      { status: 500 }
    )
  }
}


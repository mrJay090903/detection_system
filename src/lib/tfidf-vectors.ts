/**
 * Fast TF-IDF + Cosine utilities
 * - Precompute DF/IDF once
 * - Optional bigrams
 * - Min/Max DF filtering
 * - Faster cosine via intersection
 */

const STOP_WORDS = new Set([
  // basic
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as',
  'is','was','are','were','been','be','have','has','had','do','does','did','will','would',
  'should','could','may','might','must','can','this','that','these','those','what','which',
  'who','when','where','why','how','all','each','every','both','few','more','most','other',
  'some','such','no','nor','not','only','own','same','so','than','too','very','just',
  'about','into','through','during','including','against','among','throughout','despite',
  'towards','upon','concerning',

  // academic boilerplate (only remove the most generic ones)
  'study','research','thesis','paper','work',
  'proposed','provide','provides','help','helps',
  'develop','developed','create','created','build','built','make','makes'
])

export type TfIdfVector = Record<string, number>

export type TfIdfIndexOptions = {
  minTokenLen?: number           // default 3
  useBigrams?: boolean           // default true
  minDf?: number                 // default 2
  maxDfRatio?: number            // default 0.8
  topK?: number                  // default 400
}

export type TfIdfIndex = {
  idf: Map<string, number>
  totalDocs: number
  options: Required<TfIdfIndexOptions>
}

/** Normalize text -> tokens */
export function normalizeText(text: string, minLen = 3): string[] {
  if (!text) return []

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length >= minLen)
    .filter(w => !STOP_WORDS.has(w))
    .filter(w => !/^\d+$/.test(w))
}

/** Add bigrams like "record_management" to capture concepts */
function addBigrams(tokens: string[]): string[] {
  if (tokens.length < 2) return tokens
  const bigrams: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]}_${tokens[i + 1]}`)
  }
  return tokens.concat(bigrams)
}

/**
 * Build TF-IDF index:
 * - DF count per token (unique per doc)
 * - IDF per token
 */
export function buildTfIdfIndex(corpus: string[], opts: TfIdfIndexOptions = {}): TfIdfIndex {
  const options: Required<TfIdfIndexOptions> = {
    minTokenLen: opts.minTokenLen ?? 3,
    useBigrams: opts.useBigrams ?? true,
    minDf: opts.minDf ?? 1,
    maxDfRatio: opts.maxDfRatio ?? 0.85,
    topK: opts.topK ?? 600
  }

  const totalDocs = Math.max(corpus.length, 1)
  const df = new Map<string, number>()

  for (const doc of corpus) {
    let tokens = normalizeText(doc, options.minTokenLen)
    if (options.useBigrams) tokens = addBigrams(tokens)

    // unique tokens per doc for DF
    const unique = new Set(tokens)
    unique.forEach(t => df.set(t, (df.get(t) ?? 0) + 1))
  }

  const maxDf = Math.floor(options.maxDfRatio * totalDocs)

  // compute IDF with smoothing
  const idf = new Map<string, number>()
  df.forEach((d, token) => {
    if (d < options.minDf) return
    if (d > maxDf) return
    const value = Math.log((totalDocs + 1) / (d + 1)) + 1
    idf.set(token, value)
  })

  return { idf, totalDocs, options }
}

/**
 * Vectorize text using a prebuilt index (fast!)
 * - TF: count/total
 * - TF-IDF: TF * IDF
 * - Optional topK pruning by weight
 */
export function vectorizeTfIdf(text: string, index: TfIdfIndex): TfIdfVector {
  let tokens = normalizeText(text, index.options.minTokenLen)
  if (index.options.useBigrams) tokens = addBigrams(tokens)

  const counts = new Map<string, number>()
  for (const t of tokens) {
    if (!index.idf.has(t)) continue
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }

  const total = Math.max(tokens.length, 1)
  const vec: TfIdfVector = {}

  counts.forEach((count, token) => {
    const tf = count / total
    const idf = index.idf.get(token)!
    vec[token] = tf * idf
  })

  // prune to topK strongest weights (reduces noise + speeds cosine)
  const topK = index.options.topK
  const entries = Object.entries(vec)
  if (entries.length > topK) {
    entries.sort((a, b) => b[1] - a[1])
    const pruned: TfIdfVector = {}
    for (let i = 0; i < topK; i++) pruned[entries[i][0]] = entries[i][1]
    return pruned
  }

  return vec
}

/**
 * Faster cosine similarity:
 * - dot product only over intersection
 * - norms computed separately
 */
export function cosineSimilarity(vec1: TfIdfVector, vec2: TfIdfVector): number {
  const keys1 = Object.keys(vec1)
  const keys2 = Object.keys(vec2)
  if (keys1.length === 0 || keys2.length === 0) return 0

  // choose smaller vector for intersection iteration
  const [small, big] =
    keys1.length <= keys2.length ? [vec1, vec2] : [vec2, vec1]

  let dot = 0
  let norm1 = 0
  let norm2 = 0

  for (const k in vec1) norm1 += vec1[k] * vec1[k]
  for (const k in vec2) norm2 += vec2[k] * vec2[k]

  for (const k in small) {
    const b = big[k]
    if (b !== undefined) dot += small[k] * b
  }

  const denom = Math.sqrt(norm1) * Math.sqrt(norm2)
  return denom === 0 ? 0 : dot / denom
}

/** Build combined text for similarity */
export function buildResearchText(title: string, thesisBrief: string): string {
  return `${title} ${thesisBrief}`.trim()
}

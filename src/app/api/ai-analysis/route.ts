import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getJson } from 'serpapi';
import path from 'path';
import { execFileSync } from 'child_process';
import fs from 'fs';

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

export const maxDuration = 300;

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
    const response = await Promise.race([
      getJson({ engine: 'google', q: query, api_key: apiKey, num: numResults, hl: 'en' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SerpAPI timeout')), 8000)),
    ]);
    const organic = (response as any).organic_results || [];
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
    const response = await Promise.race([
      getJson({ engine: 'google_scholar', q: query, api_key: apiKey, num: numResults, hl: 'en' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SerpAPI timeout')), 8000)),
    ]);
    const organic = (response as any).organic_results || [];
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

// ============================================================================
// KEY PHRASE EXTRACTOR
// Extracts 5–15 meaningful phrases (3–10 words) from title + concept text
// ============================================================================

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','being','have','has',
  'had','do','does','did','will','would','shall','should','may','might',
  'must','can','could','this','that','these','those','it','its','they',
  'them','their','there','then','than','as','if','so','yet','nor','not',
  'also','about','into','through','during','before','after','above','below',
  'between','out','off','over','under','again','further','once','here',
  'when','where','why','how','all','each','every','both','few','more',
  'most','other','some','such','no','only','same','too','very','just',
  'student','research','study','system','using','based','approach',
]);

function extractKeyPhrases(title: string, concept: string): string[] {
  const phrases: string[] = [];

  // 1. Always include the full title (cleaned)
  const cleanTitle = title.replace(/^bu thematic area:\s*/i, '').trim();
  if (cleanTitle.length >= 10) phrases.push(cleanTitle);

  // 2. Build a pool of tokens from title + first 3000 chars of concept
  const textPool = `${cleanTitle}. ${concept.substring(0, 3000)}`;

  // Tokenise into sentences then words
  const sentences = textPool
    .split(/[.?!\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  const candidateSet = new Set<string>();

  for (const sentence of sentences) {
    // Simple word tokenisation – keep alphanumeric runs & hyphens
    const words = sentence.match(/\b[a-zA-Z][\w'-]*[a-zA-Z]\b/g) || [];
    if (words.length < 3) continue;

    // Slide window of 3–10 words
    for (let winLen = 10; winLen >= 3; winLen--) {
      for (let start = 0; start <= words.length - winLen; start++) {
        const window = words.slice(start, start + winLen);

        // Reject if first or last word is a stop word
        if (
          STOP_WORDS.has(window[0].toLowerCase()) ||
          STOP_WORDS.has(window[window.length - 1].toLowerCase())
        ) continue;

        // Score: count non-stop words inside the phrase
        const meaningful = window.filter(w => !STOP_WORDS.has(w.toLowerCase())).length;
        if (meaningful < 2) continue;

        const phrase = window.join(' ');

        // Deduplicate case-insensitively + skip if already covered by title
        const phraseLC = phrase.toLowerCase();
        if (
          !candidateSet.has(phraseLC) &&
          !cleanTitle.toLowerCase().includes(phraseLC)
        ) {
          candidateSet.add(phraseLC);
          // Store original-cased phrase
          phrases.push(phrase);
        }

        // Stop once we have enough
        if (phrases.length >= 30) break;
      }
      if (phrases.length >= 30) break;
    }
    if (phrases.length >= 30) break;
  }

  // 3. Score each candidate: prefer longer & more technical phrases
  const scored = phrases.map(p => {
    const words = p.split(' ');
    const nonStop = words.filter(w => !STOP_WORDS.has(w.toLowerCase())).length;
    // Prefer mid-length (5–8 words) and high non-stop ratio
    const lengthScore = words.length >= 5 && words.length <= 8 ? 2 : 1;
    const techScore = nonStop / words.length;
    return { phrase: p, score: lengthScore * techScore * words.length };
  });

  scored.sort((a, b) => b.score - a.score);

  // 4. Return top 5–15, deduplicated by overlap
  const final: string[] = [];
  for (const { phrase } of scored) {
    if (final.length >= 15) break;
    // Skip if this phrase is a substring of an already-chosen phrase
    const alreadyCovered = final.some(
      f => f.toLowerCase().includes(phrase.toLowerCase()) ||
           phrase.toLowerCase().includes(f.toLowerCase())
    );
    if (!alreadyCovered) final.push(phrase);
  }

  return final.slice(0, 15);
}

// Verify match breakdown entries and text highlights using SerpAPI
async function verifySerpResults(
  matchEntries: Array<{ name: string; type: string; year: string; link: string; whyMatches: string[]; rubric: any; whatsDifferent: string[] }>,
  textHighlights: Array<{ matchedText: string; source: string; sourceUrl: string; matchType: string; similarity: number }>,
  proposedTitle: string,
  proposedConcept: string
): Promise<{
  verifiedMatches: Array<{ name: string; type: string; year: string; link: string; whyMatches: string[]; rubric: any; whatsDifferent: string[]; serpVerified: boolean; serpResults: SerpWebResult[] }>;
  verifiedHighlights: Array<{ matchedText: string; source: string; sourceUrl: string; matchType: string; similarity: number; serpVerified: boolean; serpResults: SerpWebResult[]; scholarResults: SerpWebResult[] }>;
  webCitations: Array<{ title: string; url: string; snippet: string; source: string; foundVia: 'breakdown' | 'highlight' | 'title' | 'phrase'; date?: string }>;
  phraseHighlights: Array<{
    phrase: string;
    isTitle: boolean;
    serpResults: SerpWebResult[];
    scholarResults: SerpWebResult[];
    foundOnWeb: boolean;
    bestUrl: string;
    bestSource: string;
    bestSnippet: string;
  }>;
}> {
  const hasSerpApi = !!process.env.SERPAPI_API_KEY;
  
  if (!hasSerpApi) {
    console.log('[SerpAPI] No SERPAPI_API_KEY configured, skipping web verification');
    return {
      verifiedMatches: matchEntries.map(m => ({ ...m, serpVerified: false, serpResults: [] })),
      verifiedHighlights: textHighlights.map(h => ({ ...h, serpVerified: false, serpResults: [], scholarResults: [] })),
      webCitations: [],
      phraseHighlights: [],
    };
  }

  console.log(`[SerpAPI] Verifying ${matchEntries.length} matches and ${textHighlights.length} highlights`);
  const allCitations: Array<{ title: string; url: string; snippet: string; source: string; foundVia: 'breakdown' | 'highlight' | 'title' | 'phrase'; date?: string }> = [];
  const seenUrls = new Set<string>();

  const addCitation = (result: SerpWebResult, via: 'breakdown' | 'highlight' | 'title' | 'phrase') => {
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
    // no inter-batch sleep — per-call timeout already guards against hangs
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
    // no inter-batch sleep — per-call timeout already guards against hangs
  }

  console.log(`[SerpAPI] Verification complete. Found ${allCitations.length} unique web citations`);
  console.log(`[SerpAPI] Verified matches: ${verifiedMatches.filter(m => m.serpVerified).length}/${verifiedMatches.length}`);
  console.log(`[SerpAPI] Verified highlights: ${verifiedHighlights.filter(h => h.serpVerified).length}/${verifiedHighlights.length}`);

  // 4. Key Phrase Internet Search — extract up to 10 phrases and search each on Google + Scholar
  const keyPhrases = extractKeyPhrases(proposedTitle, proposedConcept).slice(0, 10);
  const cleanTitle = proposedTitle.replace(/^bu thematic area:\s*/i, '').trim();
  console.log(`[SerpAPI] Searching ${keyPhrases.length} key phrases on the web`);

  const phraseHighlights: Array<{
    phrase: string;
    isTitle: boolean;
    serpResults: SerpWebResult[];
    scholarResults: SerpWebResult[];
    foundOnWeb: boolean;
    bestUrl: string;
    bestSource: string;
    bestSnippet: string;
  }> = [];

  const PHRASE_BATCH = 5;
  for (let i = 0; i < keyPhrases.length; i += PHRASE_BATCH) {
    const batch = keyPhrases.slice(i, i + PHRASE_BATCH);
    const batchResults = await Promise.all(
      batch.map(async (phrase) => {
        const isTitle = phrase.toLowerCase() === cleanTitle.toLowerCase();
        const [googleRes, scholarRes] = await Promise.all([
          serpSearchGoogle(`"${phrase}"`, 5).catch(() => [] as SerpWebResult[]),
          serpSearchScholar(phrase, 5).catch(() => [] as SerpWebResult[]),
        ]);
        const allRes = [...googleRes, ...scholarRes];
        allRes.forEach(r => addCitation(r, 'phrase'));
        const best = allRes[0];
        return {
          phrase,
          isTitle,
          serpResults: googleRes.slice(0, 5),
          scholarResults: scholarRes.slice(0, 5),
          foundOnWeb: allRes.length > 0,
          bestUrl: best?.link || '',
          bestSource: best?.title || '',
          bestSnippet: best?.snippet || '',
        };
      })
    );
    phraseHighlights.push(...batchResults);
    // no sleep — per-call 8 s timeout already guards against hangs
  }

  const phraseFound = phraseHighlights.filter(p => p.foundOnWeb).length;
  console.log(`[SerpAPI] Phrases found on web: ${phraseFound}/${phraseHighlights.length}`);

  return { verifiedMatches, verifiedHighlights, webCitations: allCitations, phraseHighlights };
}

// ============================================================================
// WEB SIMILARITY SCAN ENGINE  (Turnitin-style)
// Fetches real web pages found via SerpAPI and runs three matching layers:
//   1. Exact copy   – 8-word shingle overlap ≥ 50%
//   2. Near match   – TF-IDF cosine similarity ≥ 0.85
//   3. Paraphrase   – TF-IDF cosine similarity 0.65–0.84
// ============================================================================

interface WebHighlightSpan {
  start: number;
  end: number;
  matchType: 'exact' | 'near' | 'paraphrase';
  confidence: number;
  sourceUrl: string;
  sourceTitle: string;
  sourceSnippet: string;
  /** The actual sentence/passage from the source page that matched */
  matchedSourceText: string;
  /** The proposed sentence text (for frontend fuzzy fallback) */
  proposedSentText: string;
}

interface WebSourceMatch {
  url: string;
  title: string;
  matchPercentage: number;
  /** Pairs of { proposedText, sourceText } for side-by-side display */
  matchedSentences: Array<{ proposedText: string; sourceText: string; confidence: number; matchType: string }>;
  highlights: WebHighlightSpan[];
}

interface WebScanResult {
  overallSimilarity: number;
  sources: WebSourceMatch[];
  highlights: WebHighlightSpan[];
  scannedUrls: number;
}

/**
 * Fetch clean article text from a list of URLs.
 * On environments where Python/.venv is available (local dev), uses trafilatura for
 * best-quality extraction.  On Vercel / any environment without Python, falls back
 * to a fast Node.js fetch + HTML-strip, which runs entirely in the same process.
 */
async function fetchPagesText(urls: string[]): Promise<Record<string, string>> {
  if (urls.length === 0) return {};

  // ── Try Python/trafilatura if the venv exists locally ────────────────────
  const pythonPath = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
  const scriptPath = path.join(process.cwd(), 'scripts', 'trafilatura_extract.py');
  if (fs.existsSync(pythonPath) && fs.existsSync(scriptPath)) {
    try {
      const output = execFileSync(pythonPath, [scriptPath], {
        input: JSON.stringify(urls),
        encoding: 'utf-8',
        timeout: 30_000,
        maxBuffer: 20 * 1024 * 1024,
        env: { ...process.env, PYTHONUTF8: '1' },
      });
      const parsed = JSON.parse(output);
      if (parsed && typeof parsed === 'object') {
        console.log('[PageFetch] trafilatura OK for', urls.length, 'URLs');
        return parsed;
      }
    } catch (e) {
      console.warn('[PageFetch] trafilatura failed, falling back to Node fetch:', (e as Error).message?.slice(0, 80));
    }
  }

  // ── Pure-Node fallback (works on Vercel) ─────────────────────────────────
  console.log('[PageFetch] Using Node.js fetch for', urls.length, 'URLs');
  const result: Record<string, string> = {};
  const fetchOne = async (url: string): Promise<[string, string]> => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AcademicBot/1.0)' },
      });
      clearTimeout(timer);
      if (!res.ok) return [url, ''];
      const html = await res.text();
      // Strip tags, scripts, styles → plain text
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#?\w+;/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 50_000);
      return [url, text];
    } catch {
      return [url, ''];
    }
  };

  const pairs = await Promise.all(urls.map(fetchOne));
  for (const [url, text] of pairs) result[url] = text;
  return result;
}

/** Split text into sentences AND record their char start/end positions */
function getSentencesWithPositions(text: string): Array<{ text: string; start: number; end: number }> {
  const result: Array<{ text: string; start: number; end: number }> = [];

  // Strategy 1: Split on sentence-ending punctuation (.!?) followed by space/newline/end
  const re1 = /[^.!?\n]{15,}?[.!?]+(?=\s|$)/g;
  let m: RegExpExecArray | null;
  const covered = new Set<number>(); // track covered char ranges

  while ((m = re1.exec(text)) !== null) {
    const raw = m[0];
    const s = raw.trim();
    if (s.split(/\s+/).length < 4) continue;
    const leadWS = raw.length - raw.trimStart().length;
    const start = m.index + leadWS;
    const end = start + s.length;
    if (end <= text.length) {
      result.push({ text: s, start, end });
      for (let c = start; c < end; c++) covered.add(c);
    }
  }

  // Strategy 2: Split on newlines for lines that weren't captured by punctuation regex
  const lineRe = /[^\n]+/g;
  while ((m = lineRe.exec(text)) !== null) {
    const raw = m[0];
    const s = raw.trim();
    if (s.split(/\s+/).length < 5 || s.length < 25) continue;
    const leadWS = raw.length - raw.trimStart().length;
    const start = m.index + leadWS;
    const end = start + s.length;
    // Skip if mostly already covered
    let overlapCount = 0;
    for (let c = start; c < end; c++) if (covered.has(c)) overlapCount++;
    if (overlapCount > (end - start) * 0.5) continue;
    if (end <= text.length) {
      result.push({ text: s, start, end });
      for (let c = start; c < end; c++) covered.add(c);
    }
  }

  // Strategy 3: Sliding-window fallback for remaining uncovered text chunks
  // This catches text without punctuation or newlines (e.g., pasted paragraphs)
  const MIN_CHUNK = 60;
  let chunkStart = -1;
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && !covered.has(i)) {
      if (chunkStart === -1) chunkStart = i;
    } else {
      if (chunkStart !== -1) {
        const chunk = text.slice(chunkStart, i).trim();
        if (chunk.length >= MIN_CHUNK && chunk.split(/\s+/).length >= 5) {
          const cLeadWS = text.slice(chunkStart, i).length - text.slice(chunkStart, i).trimStart().length;
          result.push({ text: chunk, start: chunkStart + cLeadWS, end: chunkStart + cLeadWS + chunk.length });
        }
        chunkStart = -1;
      }
    }
  }

  // Sort by position
  result.sort((a, b) => a.start - b.start);
  return result;
}

/** Lowercase word-only tokens, stop-words removed */
function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\b[a-z][a-z'-]*[a-z]\b/g) || [])
    .filter(w => !STOP_WORDS.has(w) && w.length > 2);
}

/** TF-only cosine similarity between two token arrays */
function cosineSim(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const fa: Record<string, number> = {};
  const fb: Record<string, number> = {};
  for (const t of a) fa[t] = (fa[t] || 0) + 1;
  for (const t of b) fb[t] = (fb[t] || 0) + 1;
  let dot = 0, ma = 0, mb = 0;
  const all = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  for (const t of all) {
    const av = fa[t] || 0, bv = fb[t] || 0;
    dot += av * bv; ma += av * av; mb += bv * bv;
  }
  return ma && mb ? dot / (Math.sqrt(ma) * Math.sqrt(mb)) : 0;
}

/** N-word shingle set from text */
function getShinglesSet(text: string, n = 10): Set<string> {
  const words = text.toLowerCase().match(/\b[a-z][a-z'-]*\b/g) || [];
  const s = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) s.add(words.slice(i, i + n).join(' '));
  return s;
}

async function performWebSimilarityScan(
  proposedText: string,
  phraseHighlights: Array<{ serpResults?: any[]; scholarResults?: any[]; foundOnWeb?: boolean }>
): Promise<WebScanResult> {
  // Collect unique candidate URLs from SerpAPI phrase results
  const urlMap = new Map<string, { title: string; snippet: string }>();
  for (const ph of phraseHighlights) {
    for (const r of [...(ph.serpResults || []), ...(ph.scholarResults || [])]) {
      if (r?.link && !urlMap.has(r.link) && urlMap.size < 8) {
        urlMap.set(r.link, { title: r.title || '', snippet: r.snippet || '' });
      }
    }
    if (urlMap.size >= 8) break;
  }

  const urlEntries = Array.from(urlMap.entries()).slice(0, 5);
  if (urlEntries.length === 0) return { overallSimilarity: 0, sources: [], highlights: [], scannedUrls: 0 };

  const proposedSentences = getSentencesWithPositions(proposedText);
  const proposedShingles  = getShinglesSet(proposedText, 10);
  const proposedLen       = proposedText.length;

  // Batch-fetch page texts (trafilatura locally, Node fetch on Vercel)
  const urlList = urlEntries.map(([url]) => url);
  const extractedTexts = await fetchPagesText(urlList);
  const pageTexts = urlEntries.map(([url, meta]) => ({
    url, title: meta.title, snippet: meta.snippet,
    text: extractedTexts[url] || '',
  }));

  const allHighlights: WebHighlightSpan[] = [];
  const sources: WebSourceMatch[] = [];

  for (const { url, title, snippet, text } of pageTexts) {
    if (text.length < 100) continue;

    const sourceShingles   = getShinglesSet(text, 10);
    const sourceSentences  = getSentencesWithPositions(text).slice(0, 150);
    const matchedSpans: WebHighlightSpan[] = [];
    const matchedPairs: Array<{ proposedText: string; sourceText: string; confidence: number; matchType: string }> = [];
    let   matchedChars = 0;

    for (const ps of proposedSentences) {
      const pTokens = tokenize(ps.text);
      if (pTokens.length < 4) continue;

      // Find the best-matching source sentence (used for both A and B/C display)
      let bestCos = 0;
      let bestSourceSentText = '';
      for (const ss of sourceSentences) {
        const s = cosineSim(pTokens, tokenize(ss.text));
        if (s > bestCos) { bestCos = s; bestSourceSentText = ss.text; }
        if (bestCos >= 0.98) break;
      }

      // ── A: Exact copy via shingle overlap ─────────────────────────────
      const sentShingles = getShinglesSet(ps.text, 10);
      let shinHits = 0;
      for (const sh of sentShingles) if (sourceShingles.has(sh)) shinHits++;
      const exactRatio = sentShingles.size > 0 ? shinHits / sentShingles.size : 0;

      if (exactRatio >= 0.5) {
        const srcText = bestSourceSentText || snippet;
        matchedSpans.push({ start: ps.start, end: ps.end, matchType: 'exact',
          confidence: Math.round(exactRatio * 100), sourceUrl: url, sourceTitle: title, sourceSnippet: snippet,
          matchedSourceText: srcText, proposedSentText: ps.text });
        matchedChars += ps.end - ps.start;
        matchedPairs.push({ proposedText: ps.text, sourceText: srcText,
          confidence: Math.round(exactRatio * 100), matchType: 'exact' });
        continue;
      }

      // ── B: Near-exact / C: Paraphrase via TF-IDF cosine ──────────────
      if (bestCos >= 0.85) {
        const mType = bestCos >= 0.92 ? 'exact' : 'near';
        matchedSpans.push({ start: ps.start, end: ps.end, matchType: mType,
          confidence: Math.round(bestCos * 100), sourceUrl: url, sourceTitle: title, sourceSnippet: snippet,
          matchedSourceText: bestSourceSentText, proposedSentText: ps.text });
        matchedChars += ps.end - ps.start;
        matchedPairs.push({ proposedText: ps.text, sourceText: bestSourceSentText,
          confidence: Math.round(bestCos * 100), matchType: mType });
      } else if (bestCos >= 0.65) {
        matchedSpans.push({ start: ps.start, end: ps.end, matchType: 'paraphrase',
          confidence: Math.round(bestCos * 100), sourceUrl: url, sourceTitle: title, sourceSnippet: snippet,
          matchedSourceText: bestSourceSentText, proposedSentText: ps.text });
        matchedChars += Math.round((ps.end - ps.start) * 0.5);
        matchedPairs.push({ proposedText: ps.text, sourceText: bestSourceSentText,
          confidence: Math.round(bestCos * 100), matchType: 'paraphrase' });
      }
    }

    if (matchedSpans.length === 0) continue;

    const matchPct = proposedLen > 0 ? Math.min(Math.round((matchedChars / proposedLen) * 100), 100) : 0;
    allHighlights.push(...matchedSpans);
    sources.push({ url, title, matchPercentage: matchPct, matchedSentences: matchedPairs.slice(0, 10), highlights: matchedSpans });
  }

  // Sort sources by match%
  sources.sort((a, b) => b.matchPercentage - a.matchPercentage);

  // Merge overlapping global highlights (keep highest confidence)
  allHighlights.sort((a, b) => a.start - b.start || b.confidence - a.confidence);
  const merged: WebHighlightSpan[] = [];
  for (const h of allHighlights) {
    const prev = merged[merged.length - 1];
    if (prev && h.start < prev.end) {
      if (h.end > prev.end) prev.end = h.end;
      if (h.confidence > prev.confidence) {
        prev.matchType = h.matchType;
        prev.confidence = h.confidence;
        prev.matchedSourceText = h.matchedSourceText;
      }
    } else merged.push({ ...h });
  }

  const totalChars = merged.reduce((s, h) => s + (h.end - h.start), 0);
  const overall    = proposedLen > 0 ? Math.min(Math.round((totalChars / proposedLen) * 100), 100) : 0;
  const scanned    = pageTexts.filter(p => p.text.length >= 100).length;

  console.log(`[WebScan] Scanned ${scanned}/${urlEntries.length} pages | ${merged.length} spans | ${overall}% similarity`);
  return { overallSimilarity: overall, sources, highlights: merged, scannedUrls: scanned };
}
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
    .replace(/\r\n?/g, '\n') // Normalize line endings to \n
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control chars but keep \n (\x0A) and \r→already replaced
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
"CRITICAL: Do NOT use any markdown formatting — no **bold**, no *italic*, no # headers, no > blockquotes.",
"Use plain text labels exactly as shown below. Never wrap labels in ** or any other markdown syntax.",
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
"Write your recommendations using EXACTLY these five labeled sections. Use bullet points (-) for each item.",
"",
"FOCUS AREAS",
"List which SPECIFIC parts of the proposed research need the most attention. For each item, state:",
"  - The field name (Problem/Need, Objectives, Scope/Context, or Inputs/Outputs)",
"  - The EXACT sentence or phrase in the proposed research that is the problem",
"  - Why that specific sentence/phrase overlaps with existing work or needs revision",
"Format: [Field] — [Exact sentence from proposed research] — [Why it needs attention]",
"If no focus areas are needed, write: No specific focus areas required.",
"- ...",
"- ...",
"",
"MAIN ISSUES",
"List the biggest conceptual overlap or originality problems found. Reference which field each issue affects (Problem/Need, Objectives, Scope/Context, Inputs/Outputs).",
"If none, write: No major issues found.",
"- ...",
"- ...",
"- ...",
"",
"REQUIRED CHANGES",
"List the exact changes the researcher MUST make to differentiate from existing work. Be specific: name the section to rewrite and what to change it to.",
"If the research is approved, write: No required changes.",
"- ...",
"- ...",
"- ...",
"",
"SUGGESTED IMPROVEMENTS",
"Optional improvements to strengthen originality and academic contribution. Reference the specific section to improve.",
"- ...",
"- ...",
"",
"STRENGTHS",
"What is already original and well-differentiated — what should be kept as-is?",
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
"For each matching passage found on the internet, output EXACTLY this format (NO markdown, NO **bold**, NO *italic*):",
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
  { provider: "google", model: "gemini-2.5-flash" },

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

    // Parse structured recommendation sections
    const parseRecommendationSection = (sectionName: string): string[] => {
      const escaped = sectionName.replace(/[/()]/g, '\\$&');
      const re = new RegExp(
        `${escaped}[\\s\\S]*?\\n([\\s\\S]*?)(?=\\n(?:FOCUS AREAS|MAIN ISSUES|REQUIRED CHANGES|SUGGESTED IMPROVEMENTS|STRENGTHS|===|$))`,
        'i'
      );
      const m = analysis.match(re);
      if (!m) return [];
      return m[1]
        .split('\n')
        .map((l: string) => l.replace(/^[-•·]\s*/, '').trim())
        .filter((l: string) => l.length > 4 && !/^\.\.\.$/.test(l));
    };

    const recommendations = {
      focusAreas:           parseRecommendationSection('FOCUS AREAS'),
      mainIssues:           parseRecommendationSection('MAIN ISSUES'),
      requiredChanges:      parseRecommendationSection('REQUIRED CHANGES'),
      suggestedImprovements:parseRecommendationSection('SUGGESTED IMPROVEMENTS'),
      strengths:            parseRecommendationSection('STRENGTHS'),
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

    // Match the section header in multiple formats AI might output
    const highlightsSectionMatch =
      analysis.match(/={2,}\s*TEXT MATCH HIGHLIGHTS\s*={2,}([\s\S]*)$/i) ||
      analysis.match(/\*{2}TEXT MATCH HIGHLIGHTS\*{2}[^\n]*\n([\s\S]*)$/i) ||
      analysis.match(/TEXT MATCH HIGHLIGHTS[:\s]*([\s\S]*)$/i);

    if (highlightsSectionMatch) {
      const rawSection = highlightsSectionMatch[1];
      // Debug: show the first 400 chars so we can see what format the AI used
      console.log('[Text Highlights] Raw section preview:\n', rawSection.substring(0, 400));

      // Split on any HIGHLIGHT N variant including markdown bold:
      //   HIGHLIGHT 1:  HIGHLIGHT [1]:  **HIGHLIGHT 1:**  HIGHLIGHT 1 -  HIGHLIGHT 1
      const highlightBlocks = rawSection
        .split(/\*{0,2}HIGHLIGHT\s*\[?\d+\]?\*{0,2}\s*[:\-]?\s*\*{0,2}/i)
        .filter(b => b.trim().length > 0);

      for (let bi = 0; bi < highlightBlocks.length; bi++) {
        const block = highlightBlocks[bi];

        // Extract Matched Text: try richest match first
        let matchedText = '';

        // 1) Smart/straight double quotes
        let m = block.match(/Matched Text:\s*[\u201c"](([\s\S]*?))[\u201d"]/i);
        if (m) matchedText = m[1];

        // 2) Single quotes or backticks
        if (!matchedText) {
          const mq = block.match(/Matched Text:\s*[\u2018\u2019'`]([\s\S]*?)[\u2018\u2019'`]/i);
          if (mq) matchedText = mq[1];
        }

        // 3) No quotes: everything up to next labelled field (multiline \n safe)
        if (!matchedText) {
          const mf = block.match(/Matched Text:\s*([\s\S]+?)(?=\n[ \t]*(?:Source|Source URL|Match Type|Similarity)\s*:)/i);
          if (mf) matchedText = mf[1];
        }

        // 4) Last resort: rest of first line
        if (!matchedText) {
          const ml = block.match(/Matched Text:\s*([^\n]+)/i);
          if (ml) matchedText = ml[1];
        }

        // Strip surrounding quote / markdown chars
        matchedText = matchedText
          .trim()
          .replace(/^[\u201c\u201d\u2018\u2019"'`\-*]+|[\u201c\u201d\u2018\u2019"'`\-*]+$/g, '')
          .trim();

        if (matchedText.length < 4) {
          console.log(`[Text Highlights] Block ${bi + 1}: skipped (text too short/empty)`);
          continue;
        }

        // Other fields
        const sourceLineMatch = block.match(/^[ \t]*Source:\s*(?!URL)([^\n]+)/im);
        const sourceUrlMatch  = block.match(/Source URL:\s*([^\n]+)/i);
        const matchTypeMatch  = block.match(/Match Type:\s*([^\n]+)/i);
        const similarityMatch = block.match(/Similarity:\s*(\d+(?:\.\d+)?)\s*%/i);

        textHighlights.push({
          matchedText,
          source: sourceLineMatch ? sourceLineMatch[1].trim() : 'Unknown Source',
          sourceUrl: sourceUrlMatch ? sourceUrlMatch[1].trim() : 'N/A',
          matchType: matchTypeMatch ? matchTypeMatch[1].trim() : 'Unknown',
          similarity: similarityMatch ? parseFloat(similarityMatch[1]) : 0,
        });

        console.log(`[Text Highlights] Block ${bi + 1}: "${matchedText.substring(0, 60)}" type=${matchTypeMatch?.[1] ?? 'Unknown'}`);
      }
    } else {
      console.log('[Text Highlights] Section header not found in AI response');
    }

    console.log(`[Text Highlights] Total parsed: ${textHighlights.length} passages`);
    if (textHighlights.length > 0) {
      console.log(`[Text Highlights] First 3:`, textHighlights.slice(0, 3).map(h => ({ text: h.matchedText.substring(0, 50), type: h.matchType, source: h.source.substring(0, 40) })));
    }

    const fieldAssessment = {
      scores: fieldScores,
      rationales: fieldRationales,
      recommendations,
      average: null as number | null
    };
    
    // ============================================================================
    // SERPAPI WEB VERIFICATION - Verify matches and highlights with real internet data
    // ============================================================================
    console.log('[SerpAPI] Starting web verification of AI-generated matches and highlights...');
    const serpVerification = await verifySerpResults(matchEntries, textHighlights, safeUserTitle, safeUserConcept);

    // ============================================================================
    // WEB SIMILARITY SCAN — fetch real pages + run shingle / cosine matching
    // ============================================================================
    console.log('[WebScan] Starting full document scan against real web pages...');
    const webScan = await performWebSimilarityScan(safeUserConcept, serpVerification.phraseHighlights);
    console.log(`[WebScan] Done: ${webScan.scannedUrls} pages scanned, ${webScan.highlights.length} spans, overall ${webScan.overallSimilarity}%`);

    // Filter out the database source from match breakdown — the user only wants external matches
    const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const existingNorm = normalizeTitle(safeExistingTitle);
    const existingWords = new Set(existingNorm.split(' ').filter(w => w.length > 3));

    const filteredMatches = serpVerification.verifiedMatches.filter(m => {
      const mNorm = normalizeTitle(m.name);
      // Exact or near-exact title match
      if (mNorm === existingNorm) return false;
      if (existingNorm.includes(mNorm) || mNorm.includes(existingNorm)) return false;
      // High word overlap (>70% of words match)
      const mWords = new Set(mNorm.split(' ').filter(w => w.length > 3));
      if (mWords.size === 0 || existingWords.size === 0) return true;
      let overlap = 0;
      for (const w of mWords) if (existingWords.has(w)) overlap++;
      const overlapRatio = overlap / Math.min(mWords.size, existingWords.size);
      return overlapRatio < 0.7;
    });

    const matchBreakdown = {
      matches: filteredMatches,
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

      // Full proposed text — used by the frontend for inline word/sentence highlighting
      proposedText: safeUserConcept,

      // Turnitin-style web scan results: highlight spans + per-source breakdown
      webScan,

      // Match Breakdown & Source List (now SerpAPI-verified)
      matchBreakdown,
      
      // Text Match Highlights (now SerpAPI-verified)
      textHighlights: serpVerification.verifiedHighlights,
      
      // Key Phrase Internet Search results
      phraseHighlights: serpVerification.phraseHighlights,
      
      // Web Citations from SerpAPI (real internet sources)
      webCitations: serpVerification.webCitations,
      
      // SerpAPI verification summary
      serpVerification: {
        enabled: !!process.env.SERPAPI_API_KEY,
        matchesVerified: serpVerification.verifiedMatches.filter(m => m.serpVerified).length,
        matchesTotal: serpVerification.verifiedMatches.length,
        highlightsVerified: serpVerification.verifiedHighlights.filter(h => h.serpVerified).length,
        highlightsTotal: serpVerification.verifiedHighlights.length,
        phrasesFound: serpVerification.phraseHighlights.filter(p => p.foundOnWeb).length,
        phrasesTotal: serpVerification.phraseHighlights.length,
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

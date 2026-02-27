import { NextResponse } from 'next/server';
import { getJson } from 'serpapi';

// ============================================================================
// WEB SEARCH API - Uses Serper API (primary) and SerpAPI (fallback)
// ============================================================================

export const maxDuration = 60;

// Rate limiting
const searchRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const SEARCH_RATE_LIMIT_MAX = 20; // requests per window
const SEARCH_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkSearchRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = searchRateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    searchRateLimitMap.set(identifier, { count: 1, resetTime: now + SEARCH_RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: SEARCH_RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= SEARCH_RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: SEARCH_RATE_LIMIT_MAX - entry.count };
}

// Types for search results
interface WebSearchResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  source: string;
  date?: string;
}

interface SearchResponse {
  query: string;
  results: WebSearchResult[];
  totalResults: number;
}

// ============================================================================
// SERPER API - Primary search provider
// ============================================================================

// Search the web using Serper API Google Search
async function searchGoogleSerper(query: string, numResults: number = 5): Promise<WebSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey || apiKey === 'your_serper_api_key_here') {
    throw new Error('SERPER_API_KEY is not configured');
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
        gl: 'us',
        hl: 'en',
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const organicResults = data.organic || [];

    return organicResults.map((result: any, index: number) => ({
      position: index + 1,
      title: result.title || '',
      link: result.link || '',
      snippet: result.snippet || '',
      source: result.displayedLink || result.link || '',
      date: result.date || undefined,
    }));
  } catch (error) {
    console.error('[Serper API] Search error:', error);
    throw error;
  }
}

// Search Google Scholar using Serper API
async function searchGoogleScholarSerper(query: string, numResults: number = 5): Promise<WebSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey || apiKey === 'your_serper_api_key_here') {
    throw new Error('SERPER_API_KEY is not configured');
  }

  try {
    const response = await fetch('https://google.serper.dev/scholar', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper Scholar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const organicResults = data.organic || [];

    return organicResults.map((result: any, index: number) => ({
      position: index + 1,
      title: result.title || '',
      link: result.link || '',
      snippet: result.snippet || '',
      source: result.publicationInfo?.summary || result.displayedLink || '',
      date: result.publicationInfo?.summary?.match(/\d{4}/)?.[0] || undefined,
    }));
  } catch (error) {
    console.error('[Serper Scholar API] Search error:', error);
    // Return empty array on error - will fall back to SerpAPI
    return [];
  }
}

// ============================================================================
// SERPAPI - Fallback search provider
// ============================================================================

// Search the web using SerpAPI Google Search
async function searchGoogle(query: string, numResults: number = 5): Promise<WebSearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is not configured');
  }

  try {
    const response = await getJson({
      engine: 'google',
      q: query,
      api_key: apiKey,
      num: numResults,
      hl: 'en',
    });

    const organicResults = response.organic_results || [];

    return organicResults.map((result: any, index: number) => ({
      position: index + 1,
      title: result.title || '',
      link: result.link || '',
      snippet: result.snippet || '',
      source: result.displayed_link || result.source || '',
      date: result.date || undefined,
    }));
  } catch (error) {
    console.error('[SerpAPI] Search error:', error);
    throw error;
  }
}

// Search Google Scholar for academic sources
async function searchGoogleScholar(query: string, numResults: number = 5): Promise<WebSearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is not configured');
  }

  try {
    const response = await getJson({
      engine: 'google_scholar',
      q: query,
      api_key: apiKey,
      num: numResults,
      hl: 'en',
    });

    const organicResults = response.organic_results || [];

    return organicResults.map((result: any, index: number) => ({
      position: index + 1,
      title: result.title || '',
      link: result.link || '',
      snippet: result.snippet || '',
      source: result.publication_info?.summary || result.displayed_link || '',
      date: result.publication_info?.summary?.match(/\d{4}/)?.[0] || undefined,
    }));
  } catch (error) {
    console.error('[SerpAPI Scholar] Search error:', error);
    // Fall back to regular Google search if Scholar fails
    return [];
  }
}

// ============================================================================
// POST handler - Search for text matches on the internet
// ============================================================================
export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIP =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rateLimit = checkSearchRateLimit(clientIP);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.', retryAfter: Math.ceil(SEARCH_RATE_LIMIT_WINDOW / 1000) },
        { status: 429 }
      );
    }

    // Check if at least one search provider is configured
    const hasSerper = process.env.SERPER_API_KEY && process.env.SERPER_API_KEY !== 'your_serper_api_key_here';
    const hasSerpAPI = process.env.SERPAPI_API_KEY;

    if (!hasSerper && !hasSerpAPI) {
      return NextResponse.json(
        { error: 'Web search is not configured. Please add SERPER_API_KEY or SERPAPI_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    const data = await request.json();
    const { queries, mode } = data;

    // `queries` is an array of objects: { text: string, type: 'breakdown' | 'highlight' }
    // `mode` is 'breakdown' | 'highlight' | 'both'
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json(
        { error: 'No search queries provided' },
        { status: 400 }
      );
    }

    // Limit queries to prevent abuse
    const MAX_QUERIES = 15;
    const limitedQueries = queries.slice(0, MAX_QUERIES);

    console.log(`[Web Search] Processing ${limitedQueries.length} queries (mode: ${mode || 'both'})`);

    const results: Array<{
      originalQuery: string;
      type: string;
      googleResults: WebSearchResult[];
      scholarResults: WebSearchResult[];
    }> = [];

    // Process queries with concurrency control (max 3 at a time)
    const BATCH_SIZE = 3;
    for (let i = 0; i < limitedQueries.length; i += BATCH_SIZE) {
      const batch = limitedQueries.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (queryItem: { text: string; type: string }) => {
          const searchText = queryItem.text.trim().substring(0, 256);
          if (searchText.length < 10) {
            return {
              originalQuery: queryItem.text,
              type: queryItem.type,
              googleResults: [] as WebSearchResult[],
              scholarResults: [] as WebSearchResult[],
            };
          }

          // Wrap text in quotes for exact/phrase match
          const phraseQuery = `"${searchText}"`;

          // Try Serper API first, fall back to SerpAPI if it fails
          let googleResults: WebSearchResult[] = [];
          let scholarResults: WebSearchResult[] = [];

          // Try Google Search
          try {
            if (hasSerper) {
              googleResults = await searchGoogleSerper(phraseQuery, 5);
              console.log(`[Serper] Google search successful for: "${searchText.substring(0, 50)}..."`);
            } else {
              throw new Error('Serper not configured');
            }
          } catch (serperError) {
            console.log(`[Serper] Failed, trying SerpAPI...`);
            if (hasSerpAPI) {
              try {
                googleResults = await searchGoogle(phraseQuery, 5);
                console.log(`[SerpAPI] Google search successful for: "${searchText.substring(0, 50)}..."`);
              } catch (serpApiError) {
                console.error(`[SerpAPI] Google search failed:`, serpApiError);
                googleResults = [];
              }
            }
          }

          // Try Scholar Search
          try {
            if (hasSerper) {
              scholarResults = await searchGoogleScholarSerper(searchText, 5);
              console.log(`[Serper] Scholar search successful for: "${searchText.substring(0, 50)}..."`);
            } else {
              throw new Error('Serper not configured');
            }
          } catch (serperError) {
            console.log(`[Serper Scholar] Failed, trying SerpAPI...`);
            if (hasSerpAPI) {
              try {
                scholarResults = await searchGoogleScholar(searchText, 5);
                console.log(`[SerpAPI] Scholar search successful for: "${searchText.substring(0, 50)}..."`);
              } catch (serpApiError) {
                console.error(`[SerpAPI] Scholar search failed:`, serpApiError);
                scholarResults = [];
              }
            }
          }

          return {
            originalQuery: queryItem.text,
            type: queryItem.type,
            googleResults,
            scholarResults,
          };
        })
      );

      results.push(...batchResults);

      // Add small delay between batches to avoid rate limiting from SerpAPI
      if (i + BATCH_SIZE < limitedQueries.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Compile summary statistics
    const totalGoogleHits = results.reduce((sum, r) => sum + r.googleResults.length, 0);
    const totalScholarHits = results.reduce((sum, r) => sum + r.scholarResults.length, 0);

    console.log(`[Web Search] Completed: ${totalGoogleHits} Google results, ${totalScholarHits} Scholar results`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalQueries: results.length,
        totalGoogleHits,
        totalScholarHits,
        queriesWithResults: results.filter(r => r.googleResults.length > 0 || r.scholarResults.length > 0).length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Web Search] Error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Web search failed',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

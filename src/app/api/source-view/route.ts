import { NextResponse } from 'next/server';

export const maxDuration = 30;

/**
 * Fetches a web page, strips HTML, and returns clean text content.
 * Used by the source-view page to display source text with highlights.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    console.log(`[SourceView] Fetching: ${url}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const html = await res.text();

    // Extract page title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : parsedUrl.hostname;

    // Strip HTML to clean text — preserve paragraph structure
    const text = html
      // Remove scripts, styles, nav, header, footer, aside
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      // Add newlines for block elements
      .replace(/<\/(p|div|h[1-6]|li|tr|br|blockquote|section|article)>/gi, '\n')
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      // Strip remaining tags
      .replace(/<[^>]+>/g, ' ')
      // Decode entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&#?\w+;/g, ' ')
      // Clean whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/(\n\s*){3,}/g, '\n\n')
      .trim()
      .slice(0, 50000); // Limit to 50K chars

    console.log(`[SourceView] Extracted ${text.length} chars from ${parsedUrl.hostname}`);

    return NextResponse.json({
      success: true,
      url,
      pageTitle,
      text,
      hostname: parsedUrl.hostname,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SourceView] Error:', msg);

    if (msg.includes('abort')) {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

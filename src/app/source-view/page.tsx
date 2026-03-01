"use client"

import { useState, useEffect, Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle, Highlighter, Globe, FileText } from "lucide-react"

function SourceViewContent() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageTitle, setPageTitle] = useState("")
  const [pageText, setPageText] = useState("")
  const [hostname, setHostname] = useState("")

  const sourceUrl = searchParams.get("url") || ""
  const matchedText = searchParams.get("matched") || ""
  const flaggedSentence = searchParams.get("sentence") || ""

  useEffect(() => {
    if (!sourceUrl) {
      setError("No source URL provided")
      setIsLoading(false)
      return
    }

    const fetchSource = async () => {
      try {
        setIsLoading(true)
        const res = await fetch("/api/source-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sourceUrl }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Failed to fetch source (${res.status})`)
        }

        const data = await res.json()
        setPageTitle(data.pageTitle || "")
        setPageText(data.text || "")
        setHostname(data.hostname || "")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load source page")
      } finally {
        setIsLoading(false)
      }
    }

    fetchSource()
  }, [sourceUrl])

  // Find and highlight matched text in the source page
  const highlightedContent = useMemo(() => {
    if (!pageText) return null

    // Primary text to highlight is matchedText (the exact text from source that was found)
    const textToHighlight = matchedText && matchedText.length > 10 ? matchedText : flaggedSentence

    if (!textToHighlight || textToHighlight.length < 10) {
      // No text to highlight — show plain text
      return [{ text: pageText, highlighted: false, key: 0 }]
    }

    const lowerText = pageText.toLowerCase()
    const normalizedHighlight = textToHighlight.toLowerCase().trim()

    type MatchPos = { start: number; end: number }
    let matchPos: MatchPos | null = null

    // Strategy 1: Direct exact substring match (case-insensitive)
    let idx = lowerText.indexOf(normalizedHighlight)
    if (idx !== -1) {
      matchPos = { start: idx, end: idx + textToHighlight.length }
    }

    // Strategy 2: Normalize whitespace and try again
    if (!matchPos) {
      const normText = lowerText.replace(/\s+/g, ' ')
      const normHighlight = normalizedHighlight.replace(/\s+/g, ' ')
      idx = normText.indexOf(normHighlight)
      if (idx !== -1) {
        // Map back to original text position (approximate)
        matchPos = { start: idx, end: idx + normHighlight.length }
      }
    }

    // Strategy 3: Try finding first 100 characters of the matched text
    if (!matchPos && textToHighlight.length > 100) {
      const firstPart = textToHighlight.substring(0, 100).toLowerCase().trim()
      idx = lowerText.indexOf(firstPart)
      if (idx !== -1) {
        matchPos = { start: idx, end: idx + textToHighlight.length }
      }
    }

    // Strategy 4: Word-by-word overlap for more fuzzy matching
    if (!matchPos) {
      const highlightWords = normalizedHighlight.split(/\s+/).filter(w => w.length > 3)
      if (highlightWords.length >= 5) {
        const srcWords = lowerText.split(/\s+/)
        const minWords = Math.min(highlightWords.length, 20) // Look for first 20 words
        
        for (let i = 0; i <= srcWords.length - minWords; i++) {
          const windowWords = srcWords.slice(i, i + minWords)
          let matchCount = 0
          for (const hw of highlightWords.slice(0, minWords)) {
            if (windowWords.includes(hw)) matchCount++
          }
          if (matchCount / minWords >= 0.7) { // 70% word overlap
            // Convert word position to char position
            const precedingText = srcWords.slice(0, i).join(' ')
            const windowText = windowWords.join(' ')
            const start = precedingText.length + (i > 0 ? 1 : 0)
            const end = start + Math.min(textToHighlight.length, windowText.length * 2)
            matchPos = { start, end: Math.min(end, pageText.length) }
            break
          }
        }
      }
    }

    if (!matchPos) {
      // No match found - return plain text
      console.warn('[Source Highlight] Could not find match for:', textToHighlight.substring(0, 100))
      return [{ text: pageText, highlighted: false, key: 0 }]
    }

    // Build segments with highlighting
    const segments: Array<{ text: string; highlighted: boolean; key: number }> = []
    
    if (matchPos.start > 0) {
      segments.push({ 
        text: pageText.slice(0, matchPos.start), 
        highlighted: false, 
        key: 0 
      })
    }
    
    segments.push({ 
      text: pageText.slice(matchPos.start, matchPos.end), 
      highlighted: true, 
      key: 1 
    })
    
    if (matchPos.end < pageText.length) {
      segments.push({ 
        text: pageText.slice(matchPos.end), 
        highlighted: false, 
        key: 2 
      })
    }

    return segments
  }, [pageText, matchedText, flaggedSentence])

  // Count highlighted segments
  const highlightCount = highlightedContent?.filter(s => s.highlighted).length || 0

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Globe className="w-8 h-8 text-indigo-600" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-700">Fetching Source Page</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Loading content from <span className="font-medium text-indigo-600">{hostname || sourceUrl}</span>
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-800 mb-2">Failed to Load Source</h2>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Original URL Instead
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-800 truncate">{pageTitle || hostname}</h1>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-500 hover:text-indigo-700 truncate block"
              >
                {sourceUrl}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {highlightCount > 0 && (
              <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[11px] font-bold border border-red-200">
                {highlightCount} match{highlightCount !== 1 ? "es" : ""} found
              </span>
            )}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Original
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Flagged sentence banner */}
        {flaggedSentence && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Highlighter className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Flagged Text from Your Document</div>
                <p className="text-sm text-amber-900 leading-relaxed">&quot;{flaggedSentence}&quot;</p>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-3 rounded bg-red-200 border border-red-400" />
            Matched / similar text in source
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-400">{pageText.length.toLocaleString()} characters extracted</span>
        </div>

        {/* Source text with highlights */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Source Content</span>
            <span className="text-xs text-slate-400 ml-auto">{hostname}</span>
          </div>
          <div className="p-6 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-[system-ui] max-h-[80vh] overflow-y-auto">
            {highlightedContent && highlightedContent.length > 0 ? (
              highlightedContent.map((seg) =>
                seg.highlighted ? (
                  <mark
                    key={seg.key}
                    className="bg-red-200 border-b-2 border-red-500 rounded-sm px-0.5 text-red-900 font-medium"
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={seg.key}>{seg.text}</span>
                )
              )
            ) : (
              <span className="text-slate-400 italic">No content extracted</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SourceViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <SourceViewContent />
    </Suspense>
  )
}

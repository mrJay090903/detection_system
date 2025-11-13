"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Loader2, ArrowLeft, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"
import Link from "next/link"

interface SimilarityResult {
  id?: string
  title: string
  abstract: string
  year?: number
  course?: string
  titleSimilarity: number
  abstractSimilarity: number
  overallSimilarity: number
  lexicalSimilarity?: number
  semanticSimilarity?: number
  similarityType?: 'Lexical' | 'Conceptual' | 'Both'
  explanation?: string
}

interface SimilarityResponse {
  success: boolean
  proposedTitle: string
  proposedConcept: string
  similarities: SimilarityResult[]
  report: string
  totalComparisons: number
}

export function SimilarityResults() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [result, setResult] = useState<SimilarityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkSimilarity = async () => {
      const proposedTitle = searchParams.get("title")
      const proposedConcept = searchParams.get("concept")

      if (!proposedTitle || !proposedConcept) {
        setError("Missing required parameters")
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch("/api/similarity/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            proposedTitle: proposedTitle.trim(),
            proposedConcept: proposedConcept.trim(),
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to check similarity")
        }

        if (data.success) {
          setResult(data)
        } else {
          throw new Error(data.error || "Unknown error occurred")
        }
      } catch (err) {
        console.error("Error checking similarity:", err)
        setError(err instanceof Error ? err.message : "Failed to check similarity")
      } finally {
        setIsLoading(false)
      }
    }

    checkSimilarity()
  }, [searchParams])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Analyzing similarity...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!result) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Title */}
          <div className="text-center space-y-2 mb-6">
            <h1 className="text-3xl font-bold tracking-tight">
              Similarity Analysis Results
            </h1>
            <p className="text-muted-foreground">
              Detailed comparison against {result.totalComparisons} existing researches
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">

          {/* Proposed Research Info */}
          <Card>
            <CardHeader>
              <CardTitle>Proposed Research</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Title:
                </h3>
                <p className="text-base">{result.proposedTitle}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Concept:
                </h3>
                <p className="text-base whitespace-pre-wrap">
                  {result.proposedConcept}
                </p>
              </div>
            </CardContent>
          </Card>

              {/* Similarity Graph */}
              {result.similarities.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Similarity Percentage Graph</CardTitle>
                    <CardDescription>
                      Visual representation of similarity scores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={result.similarities.slice(0, 10).map((s, i) => ({
                          name: `#${i + 1}`,
                          title: s.title.substring(0, 30) + (s.title.length > 30 ? '...' : ''),
                          overall: (s.overallSimilarity * 100).toFixed(1),
                          titleSim: (s.titleSimilarity * 100).toFixed(1),
                          abstractSim: (s.abstractSimilarity * 100).toFixed(1),
                        }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          label={{ value: 'Similarity (%)', angle: -90, position: 'insideLeft' }}
                          domain={[0, 100]}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number) => `${value}%`}
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                        />
                        <Legend />
                        <Bar dataKey="overall" fill="#0088FE" name="Overall Similarity" />
                        <Bar dataKey="titleSim" fill="#00C49F" name="Title Similarity" />
                        <Bar dataKey="abstractSim" fill="#FFBB28" name="Abstract Similarity" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Similarity Results */}
              {result.similarities.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Similarity Results</CardTitle>
                    <CardDescription>
                      Top {result.similarities.length} most similar researches from database
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                  {result.similarities.map((similarity, index) => {
                    const overallPercent = similarity.overallSimilarity * 100
                    const riskLevel =
                      overallPercent >= 70
                        ? "High"
                        : overallPercent >= 40
                        ? "Medium"
                        : "Low"
                    const riskColor =
                      overallPercent >= 70
                        ? "text-red-600 bg-red-50 border-red-200"
                        : overallPercent >= 40
                        ? "text-yellow-600 bg-yellow-50 border-yellow-200"
                        : "text-green-600 bg-green-50 border-green-200"

                    return (
                      <div
                        key={index}
                        className={`p-4 border rounded-lg ${riskColor}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-muted-foreground">
                                #{index + 1}
                              </span>
                              <h4 className="font-semibold text-base">
                                {similarity.title}
                              </h4>
                            </div>
                            {(similarity.year || similarity.course) && (
                              <div className="flex gap-3 text-sm text-muted-foreground mb-2">
                                {similarity.year && (
                                  <span>Year: {similarity.year}</span>
                                )}
                                {similarity.course && (
                                  <span>• Course: {similarity.course}</span>
                                )}
                              </div>
                            )}
                            <p className="text-sm mt-2 line-clamp-3">
                              {similarity.abstract}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold">
                              {overallPercent.toFixed(2)}%
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">
                              Overall Similarity
                            </div>
                            <div
                              className={`text-xs font-semibold px-2 py-1 rounded ${ 
                                overallPercent >= 70
                                  ? "bg-red-100 text-red-700"
                                  : overallPercent >= 40
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {riskLevel} Risk
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">
                              Title Similarity
                            </div>
                            <div className="text-lg font-semibold">
                              {(similarity.titleSimilarity * 100).toFixed(2)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">
                              Abstract Similarity
                            </div>
                            <div className="text-lg font-semibold">
                              {(similarity.abstractSimilarity * 100).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                        
                        {/* Lexical and Semantic Similarity Breakdown */}
                        {(similarity.lexicalSimilarity !== undefined || similarity.semanticSimilarity !== undefined) && (
                          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                            {similarity.lexicalSimilarity !== undefined && (
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">
                                  Lexical Similarity
                                </div>
                                <div className="text-sm font-medium">
                                  {(similarity.lexicalSimilarity * 100).toFixed(2)}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Word-based matching
                                </div>
                              </div>
                            )}
                            {similarity.semanticSimilarity !== undefined && (
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">
                                  Semantic Similarity
                                </div>
                                <div className="text-sm font-medium">
                                  {(similarity.semanticSimilarity * 100).toFixed(2)}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Meaning-based matching
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Similarity Type Badge */}
                        {similarity.similarityType && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Similarity Type:</span>
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded ${ 
                                  similarity.similarityType === 'Both'
                                    ? 'bg-blue-100 text-blue-700'
                                    : similarity.similarityType === 'Conceptual'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {similarity.similarityType}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Explanation - Why is this similar? */}
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="20" 
                                height="20" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="text-primary"
                              >
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 16v-4"/>
                                <path d="M12 8h.01"/>
                              </svg>
                            </div>
                            <h5 className="text-base font-bold text-foreground">
                              Why is this similar?
                            </h5>
                          </div>
                          {similarity.explanation ? (
                            <div className="space-y-4">
                              {similarity.explanation.split('\n').map((paragraph, idx) => {
                                const trimmed = paragraph.trim()
                                if (!trimmed) return null
                                
                                // Handle markdown-style bold headers (e.g., **Explanation:** or **Are the titles similar?**)
                                const boldMatch = trimmed.match(/^\*\*(.+?)\*\*(.*)$/)
                                if (boldMatch) {
                                  const header = boldMatch[1].replace(/:/g, '')
                                  let content = boldMatch[2].trim()
                                  
                                  // Highlight specific technologies, methods, and objectives in content
                                  const highlightSpecificTerms = (text: string) => {
                                    // Common technology and method terms
                                    const techTerms = [
                                      'BERT', 'RoBERTa', 'GPT', 'NLP', 'AI', 'IoT', 'blockchain', 
                                      'cosine similarity', 'TF-IDF', 'machine learning', 'deep learning',
                                      'transformer', 'neural network', 'Arduino', 'Raspberry Pi',
                                      'academic integrity', 'plagiarism detection', 'text similarity',
                                      'semantic analysis', 'embedding', 'vectorization'
                                    ]
                                    let highlighted = text
                                    techTerms.forEach(term => {
                                      const regex = new RegExp(`\b${term.replace(/[.*+?^${}()|[\\]/g, '\$&')}\b`, 'gi')
                                      highlighted = highlighted.replace(regex, (match) => 
                                        `<span class="font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">${match}</span>`
                                      )
                                    })
                                    return highlighted
                                  }
                                  
                                  if (content) {
                                    content = highlightSpecificTerms(content)
                                  }
                                  
                                  // Check if this is the main explanation section
                                  const isExplanation = header.toLowerCase().includes('explanation')
                                  
                                  // Get icon based on header content
                                  const getIcon = (headerText: string) => {
                                    if (headerText.toLowerCase().includes('explanation')) {
                                      return (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                          <path d="M13 8H8"/>
                                          <path d="M17 12H8"/>
                                        </svg>
                                      )
                                    }
                                    if (headerText.toLowerCase().includes('title')) {
                                      return (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                                        </svg>
                                      )
                                    }
                                    if (headerText.toLowerCase().includes('problem')) {
                                      return (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="12" cy="12" r="10"/>
                                          <path d="M12 16v-4"/>
                                          <path d="M12 8h.01"/>
                                        </svg>
                                      )
                                    }
                                    if (headerText.toLowerCase().includes('method')) {
                                      return (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                                        </svg>
                                      )
                                    }
                                    if (headerText.toLowerCase().includes('makes') || headerText.toLowerCase().includes('similar')) {
                                      return (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                                        </svg>
                                      )
                                    }
                                    if (headerText.toLowerCase().includes('why')) {
                                      return (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                          <line x1="12" y1="22.08" x2="12" y2="12"/>
                                        </svg>
                                      )
                                    }
                                    if (headerText.toLowerCase().includes('bottom') || headerText.toLowerCase().includes('line')) {
                                      return (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                                        </svg>
                                      )
                                    }
                                    return (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 16v-4"/>
                                        <path d="M12 8h.01"/>
                                      </svg>
                                    )
                                  }
                                  
                                  const isBottomLine = header.toLowerCase().includes('bottom') || header.toLowerCase().includes('line')
                                  
                                  return (
                                    <div 
                                      key={idx} 
                                      className={`${isExplanation ? 'bg-primary/5 border-l-4 border-l-primary' : isBottomLine ? 'bg-primary/5 border-l-4 border-l-primary' : 'bg-card'} rounded-lg p-4 border shadow-sm`}
                                    >
                                      <div className="flex items-start gap-3 mb-2">
                                        <div className={`p-1.5 rounded-md ${isExplanation || isBottomLine ? 'bg-primary/10' : 'bg-muted'}`}>
                                          {getIcon(header)}
                                        </div>
                                        <h6 className={`font-bold text-foreground ${isExplanation || isBottomLine ? 'text-base' : 'text-sm'} flex-1`}>
                                          {header}
                                        </h6>
                                      </div>
                                      {content && (
                                        <div className={isExplanation ? 'mt-3' : 'ml-11'}>
                                          {content.includes('•') || content.includes('-') ? (
                                            <ul className="space-y-2 text-sm text-foreground/90 leading-relaxed">
                                              {content.split(/[•-]/).filter(item => item.trim()).map((item, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                  <span className="text-primary mt-1.5 shrink-0">•</span>
                                                  <span dangerouslySetInnerHTML={{ __html: item.trim() }} />
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <p 
                                              className={`text-sm text-foreground/90 leading-relaxed ${isExplanation ? 'text-base' : ''}`}
                                              dangerouslySetInnerHTML={{ __html: content }}
                                            />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                }
                                
                                // Regular paragraph
                                return (
                                  <div key={idx} className="bg-card rounded-lg p-3 border">
                                    <p className="text-sm text-foreground/90 leading-relaxed">
                                      {trimmed}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="bg-card rounded-lg p-4 border shadow-sm">
                                <div className="flex items-start gap-3 mb-2">
                                  <div className="p-1.5 rounded-md bg-muted">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10"/>
                                      <path d="M12 16v-4"/>
                                      <path d="M12 8h.01"/>
                                    </svg>
                                  </div>
                                  <h6 className="font-bold text-sm text-foreground flex-1">
                                    {similarity.similarityType === 'Conceptual' ? 'Conceptual Similarity' : similarity.similarityType === 'Lexical' ? 'Word-Based Similarity' : 'Both Types of Similarity'}
                                  </h6>
                                </div>
                                <div className="ml-11 space-y-2">
                                  <p className="text-sm text-foreground/90 leading-relaxed">
                                    {similarity.similarityType === 'Conceptual' 
                                      ? `These researches share similar core concepts and objectives, even though they use different wording. The semantic similarity (${similarity.semanticSimilarity ? (similarity.semanticSimilarity * 100).toFixed(1) : 'N/A'}%) being higher than lexical similarity (${similarity.lexicalSimilarity ? (similarity.lexicalSimilarity * 100).toFixed(1) : 'N/A'}%) indicates they address the same fundamental research problem or use similar methodologies despite different terminology.`
                                      : similarity.similarityType === 'Lexical'
                                      ? `These researches use similar words and phrases, indicating potential overlap in terminology and key concepts. The lexical similarity (${similarity.lexicalSimilarity ? (similarity.lexicalSimilarity * 100).toFixed(1) : 'N/A'}%) shows significant word overlap.`
                                      : `These researches are similar both in wording and conceptual meaning, suggesting significant overlap in research focus and methodology. Both lexical (${similarity.lexicalSimilarity ? (similarity.lexicalSimilarity * 100).toFixed(1) : 'N/A'}%) and semantic (${similarity.semanticSimilarity ? (similarity.semanticSimilarity * 100).toFixed(1) : 'N/A'}%) similarities are high.`
                                    }
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No similar researches found in the database.
              </CardContent>
            </Card>
          )}

              

              {/* Action Buttons */}
              <div className="flex justify-center gap-4">
                <Link href="/">
                  <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Check Another Research
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column - Summary Panel */}
            <div className="lg:col-span-1 space-y-6">
              {/* Summary Statistics */}
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                  <CardDescription>Quick overview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Total Comparisons */}
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      Total Comparisons
                    </div>
                    <div className="text-2xl font-bold">
                      {result.totalComparisons}
                    </div>
                  </div>

                  {/* Risk Distribution */}
                  {result.similarities.length > 0 && (() => {
                    const highRisk = result.similarities.filter(s => s.overallSimilarity * 100 >= 70).length
                    const mediumRisk = result.similarities.filter(s => {
                      const pct = s.overallSimilarity * 100
                      return pct >= 40 && pct < 70
                    }).length
                    const lowRisk = result.similarities.filter(s => s.overallSimilarity * 100 < 40).length

                    return (
                      <div className="space-y-3">
                        <div className="text-sm font-medium mb-2">Risk Distribution</div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <span className="text-sm">High Risk</span>
                            </div>
                            <span className="font-bold text-red-600">{highRisk}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-yellow-600" />
                              <span className="text-sm">Medium Risk</span>
                            </div>
                            <span className="font-bold text-yellow-600">{mediumRisk}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm">Low Risk</span>
                            </div>
                            <span className="font-bold text-green-600">{lowRisk}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Average Similarity */}
                  {result.similarities.length > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">
                        Average Similarity
                      </div>
                      <div className="text-2xl font-bold">
                        {( 
                          result.similarities.reduce((sum, s) => sum + s.overallSimilarity, 0) / 
                          result.similarities.length * 
                          100
                        ).toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {/* Highest Similarity */}
                  {result.similarities.length > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">
                        Highest Similarity
                      </div>
                      <div className="text-2xl font-bold text-red-600">
                        {(result.similarities[0].overallSimilarity * 100).toFixed(2)}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {result.similarities[0].title}
                      </div>
                    </div>
                  )}

                  {/* Similarity Breakdown */}
                  {result.similarities.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="text-sm font-medium mb-2">Breakdown</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg Title Similarity:</span>
                          <span className="font-medium">
                            {( 
                              result.similarities.reduce((sum, s) => sum + s.titleSimilarity, 0) / 
                              result.similarities.length * 
                              100
                            ).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg Abstract Similarity:</span>
                          <span className="font-medium">
                            {( 
                              result.similarities.reduce((sum, s) => sum + s.abstractSimilarity, 0) / 
                              result.similarities.length * 
                              100
                            ).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

           
              
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

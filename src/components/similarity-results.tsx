"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { Loader2, ArrowLeft, TrendingUp, AlertTriangle, CheckCircle, Eye } from "lucide-react"
import Link from "next/link"

interface SimilarityResult {
  id?: string
  title: string
  thesis_brief: string
  year?: number
  course?: string
  titleSimilarity: number
  abstractSimilarity: number
  overallSimilarity: number
  lexicalSimilarity?: number
  semanticSimilarity?: number
  similarityType?: 'Lexical' | 'Conceptual' | 'Both'
  explanation?: string
  algorithmScores?: {
    nGram: number
    fingerprint: number
    rabinKarp: number
    lcs: number
    sentenceSimilarity: number
    featureSimilarity: number
    multiAlgoComposite: number
    confidence: number
  }
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
  const [isLoading, setIsLoading] = useState(true)
  const [result, setResult] = useState<SimilarityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewProposedConcept, setViewProposedConcept] = useState(false)
  const [viewAbstractIndex, setViewAbstractIndex] = useState<number | null>(null)

  // Helper function to clean titles by removing "BU Thematic Area:" prefix
  const cleanTitle = (title: string): string => {
    if (!title) return title
    return title.replace(/^bu thematic area:\s*/i, '').trim()
  }

  useEffect(() => {
    const loadResults = () => {
      try {
        // Read results from sessionStorage
        const storedResult = sessionStorage.getItem("similarityResult")
        
        if (!storedResult) {
          setError("No similarity results found. Please perform a similarity check first.")
          setIsLoading(false)
          return
        }

        const data = JSON.parse(storedResult) as SimilarityResponse
        
        if (data.success) {
          setResult(data)
        } else {
          setError("Invalid similarity results data")
        }
      } catch (err) {
        console.error("Error loading similarity results:", err)
        setError(err instanceof Error ? err.message : "Failed to load similarity results")
      } finally {
        setIsLoading(false)
      }
    }

    loadResults()
  }, [])

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50">
      {/* Header */}
      <header className="border-b sticky top-0 bg-white/80 backdrop-blur-md shadow-sm z-10">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost" className="gap-2 hover:bg-blue-50 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Title */}
          <div className="text-center space-y-4 mb-8">
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200 rounded-full text-sm font-medium text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
              6-Algorithm Security Analysis
            </div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Similarity Analysis Results
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Advanced plagiarism detection across <span className="font-semibold text-foreground">{result.totalComparisons}</span> existing researches using multi-algorithm validation
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">

          {/* Proposed Research Info */}
          <Card className="border-2 border-blue-200 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <CardTitle className="text-xl">Your Proposed Research</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="p-4 bg-gradient-to-br from-blue-50/50 to-transparent border border-blue-100 rounded-lg">
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                  Research Title
                </h3>
                <p className="text-base font-medium text-foreground">{result.proposedTitle}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">
                  Research Concept
                </h3>
                <div className="p-4 bg-gradient-to-br from-purple-50/50 to-transparent border border-purple-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {result.proposedConcept.length.toLocaleString()} characters
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewProposedConcept(true)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View Content
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

              {/* Similarity Graph */}
              {result.similarities.length > 0 && (
                <Card className="border-2 shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-xl">Similarity Analysis Chart</CardTitle>
                    </div>
                    <CardDescription className="text-base">
                      Visual comparison of top 3 most similar researches
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={result.similarities.slice(0, 3).map((s, i) => ({
                          name: `#${i + 1}`,
                          title: cleanTitle(s.title).substring(0, 30) + (cleanTitle(s.title).length > 30 ? '...' : ''),
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
                          labelFormatter={(label) => `Research ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="overall" fill="#0088FE" name="Overall (6 Algorithms Avg)" />
                        <Bar dataKey="titleSim" fill="#00C49F" name="Title Similarity" />
                        <Bar dataKey="abstractSim" fill="#FFBB28" name="Abstract Similarity" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Similarity Results */}
              {result.similarities.length > 0 ? (
                <Card className="border-2">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                      </svg>
                      Top {result.similarities.length} Similar Researches
                    </CardTitle>
                    <CardDescription className="text-base">
                      Ranked by multi-algorithm security analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                  {result.similarities.map((similarity, index) => {
                    const overallPercent = similarity.overallSimilarity * 100
                    const riskLevel =
                      overallPercent >= 30
                        ? "Critical"
                        : overallPercent >= 20
                        ? "High"
                        : overallPercent >= 15
                        ? "Medium"
                        : "Low"
                    const riskColor =
                      overallPercent >= 30
                        ? "text-red-700 bg-red-100 border-red-300"
                        : overallPercent >= 20
                        ? "text-red-600 bg-red-50 border-red-200"
                        : overallPercent >= 15
                        ? "text-yellow-600 bg-yellow-50 border-yellow-200"
                        : "text-green-600 bg-green-50 border-green-200"

                    return (
                      <div
                        key={index}
                        className="group relative overflow-hidden rounded-xl border-2 bg-white shadow-sm hover:shadow-lg transition-all duration-300"
                      >
                        {/* Gradient Background Accent */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                        
                         
                        <div className="p-6">
                          {/* Header with Rank Badge */}
                          <div className="flex items-start gap-4 mb-4">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                #{index + 1}
                              </div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-lg text-foreground mb-2 leading-tight">
                                {cleanTitle(similarity.title)}
                              </h4>
                              
                              {(similarity.year || similarity.course) && (
                                <div className="flex flex-wrap gap-2 text-sm">
                                  {similarity.year && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/>
                                        <line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="3" y1="10" x2="21" y2="10"/>
                                      </svg>
                                      {similarity.year}
                                    </span>
                                  )}
                                  {similarity.course && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                                        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                                      </svg>
                                      {similarity.course}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Similarity Percentage Badge */}
                            <div className="flex-shrink-0">
                              <div className={`relative px-4 py-3 rounded-xl shadow-md ${
                                overallPercent >= 30
                                  ? "bg-gradient-to-br from-red-500 to-red-600"
                                  : overallPercent >= 20
                                  ? "bg-gradient-to-br from-orange-500 to-red-500"
                                  : overallPercent >= 15
                                  ? "bg-gradient-to-br from-yellow-500 to-orange-500"
                                  : "bg-gradient-to-br from-green-500 to-emerald-600"
                              }`}>
                                <div className="text-3xl font-bold text-white text-center">
                                  {overallPercent.toFixed(1)}%
                                </div>
                                <div className="text-[10px] text-white/90 text-center uppercase tracking-wide mt-0.5">
                                  Overall
                                </div>
                              </div>
                              <div
                                className={`text-xs font-semibold px-3 py-1 rounded-full text-center mt-2 ${ 
                                  overallPercent >= 30
                                    ? "bg-red-100 text-red-700"
                                    : overallPercent >= 20
                                    ? "bg-orange-100 text-orange-700"
                                    : overallPercent >= 15
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {riskLevel}
                              </div>
                            </div>
                          </div>
                          
                          {/* Similarity Type and View Abstract */}
                          <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            {similarity.similarityType && (
                              <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                  <path d="M12 2v20M2 12h20"/>
                                </svg>
                                <span
                                  className={`text-xs font-semibold px-3 py-1 rounded-full ${ 
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
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewAbstractIndex(index)}
                              className="gap-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                              View Abstract
                            </Button>
                          </div>
                        </div>
                        
                        {/* Multi-Algorithm Security Scores */}
                        {similarity.algorithmScores && (
                          <div className="mt-3 pt-3 border-t bg-gradient-to-br from-blue-50/30 to-purple-50/30 -mx-6 px-6 py-3">
                            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                              </svg>
                              6-Algorithm Detection Breakdown
                              <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold ${
                                similarity.algorithmScores.confidence > 0.8 
                                  ? 'bg-green-100 text-green-700' 
                                  : similarity.algorithmScores.confidence > 0.6
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {(similarity.algorithmScores.confidence * 100).toFixed(0)}% Confidence
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mb-3 italic">
                              The overall percentage is the average of these 6 independent algorithms
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                              <div className="bg-white/80 p-2 rounded border border-gray-200">
                                <div className="text-muted-foreground mb-0.5">TF-IDF</div>
                                <div className="font-semibold">{(similarity.lexicalSimilarity! * 100).toFixed(1)}%</div>
                              </div>
                              <div className="bg-white/80 p-2 rounded border border-gray-200">
                                <div className="text-muted-foreground mb-0.5">N-Gram</div>
                                <div className="font-semibold">{(similarity.algorithmScores.nGram * 100).toFixed(1)}%</div>
                              </div>
                              <div className="bg-white/80 p-2 rounded border border-gray-200">
                                <div className="text-muted-foreground mb-0.5">Fingerprint</div>
                                <div className="font-semibold">{(similarity.algorithmScores.fingerprint * 100).toFixed(1)}%</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div className="bg-white/80 p-2 rounded border border-gray-200">
                                <div className="text-muted-foreground mb-0.5">Rabin-Karp</div>
                                <div className="font-semibold">{(similarity.algorithmScores.rabinKarp * 100).toFixed(1)}%</div>
                              </div>
                              <div className="bg-white/80 p-2 rounded border border-gray-200">
                                <div className="text-muted-foreground mb-0.5">LCS</div>
                                <div className="font-semibold">{(similarity.algorithmScores.lcs * 100).toFixed(1)}%</div>
                              </div>
                              <div className="bg-white/80 p-2 rounded border border-gray-200">
                                <div className="text-muted-foreground mb-0.5">Sentence</div>
                                <div className="font-semibold">{(similarity.algorithmScores.sentenceSimilarity * 100).toFixed(1)}%</div>
                              </div>
                            </div>
                            <div className="mt-3 bg-gradient-to-r from-blue-100 to-purple-100 p-3 rounded-lg border border-blue-200">
                              <div className="flex justify-between items-center">
                                <div className="text-xs">
                                  <span className="font-bold text-gray-700">Average of All 6 Algorithms:</span>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">This is your overall similarity score</div>
                                </div>
                                <span className="text-xl font-bold text-primary">{(similarity.overallSimilarity * 100).toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                        )}
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
                        {cleanTitle(result.similarities[0].title)}
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

      {/* Dialog for viewing proposed concept */}
      <Dialog open={viewProposedConcept} onOpenChange={setViewProposedConcept}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Proposed Research Concept</DialogTitle>
            <DialogDescription>
              {result.proposedTitle} ({result.proposedConcept.length.toLocaleString()} characters)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
            <div className="whitespace-pre-wrap text-sm">
              {result.proposedConcept}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog for viewing existing research abstract */}
      {viewAbstractIndex !== null && result.similarities[viewAbstractIndex] && (
        <Dialog open={viewAbstractIndex !== null} onOpenChange={() => setViewAbstractIndex(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{cleanTitle(result.similarities[viewAbstractIndex].title)}</DialogTitle>
              <DialogDescription>
                {result.similarities[viewAbstractIndex].year && `Year: ${result.similarities[viewAbstractIndex].year}`}
                {result.similarities[viewAbstractIndex].course && ` • Course: ${result.similarities[viewAbstractIndex].course}`}
                {` • ${result.similarities[viewAbstractIndex].thesis_brief.length.toLocaleString()} characters`}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
              <div className="whitespace-pre-wrap text-sm">
                {result.similarities[viewAbstractIndex].thesis_brief}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

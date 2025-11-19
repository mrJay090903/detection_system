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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { UploadedFileViewDialog } from "@/components/uploaded-file-view-dialog"

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
  verification?: string
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
  const [uploadedFile, setUploadedFile] = useState<{
    name: string
    content: string
  } | null>(null)
  const [selectedVerification, setSelectedVerification] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    // Check if there's an uploaded file in sessionStorage
    const storedFile = sessionStorage.getItem('uploadedFile')
    if (storedFile) {
      try {
        setUploadedFile(JSON.parse(storedFile))
      } catch (e) {
        console.error('Failed to parse uploaded file:', e)
      }
    }
  }, [])

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

        if (!response.ok) {
          let errorMessage = "Failed to check similarity"
          try {
            const data = await response.json()
            errorMessage = data.error || errorMessage
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError)
            errorMessage = `Server error (${response.status}): ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()

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

          {/* Exact/Near-Exact Match Warning */}
          {result.similarities.length > 0 && result.similarities[0].overallSimilarity >= 0.95 && (
            <Card className="border-red-500 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Exact or Near-Exact Match Detected
                </CardTitle>
              </CardHeader>
              <CardContent className="text-red-700">
                <p className="mb-2">
                  Your proposed research shows <strong>{(result.similarities[0].overallSimilarity * 100).toFixed(1)}% similarity</strong> with an existing research in the database.
                </p>
                <p className="text-sm">
                  This could mean:
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>You're uploading the same file multiple times</li>
                  <li>This research already exists in the database</li>
                  <li>There's significant overlap with existing work</li>
                </ul>
                <p className="text-sm mt-3 font-semibold">
                  Please ensure your research is original or verify that you haven't submitted it before.
                </p>
              </CardContent>
            </Card>
          )}

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
                {uploadedFile ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Uploaded from: {uploadedFile.name}
                    </p>
                    <UploadedFileViewDialog
                      fileName={uploadedFile.name}
                      fileContent={uploadedFile.content}
                      triggerText="View Uploaded Content"
                    />
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto border rounded-md p-3 bg-muted/30">
                    <p className="text-sm whitespace-pre-wrap">
                      {result.proposedConcept}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

              {/* Similarity Results */}
              {result.similarities.length > 0 && result.similarities[0].overallSimilarity >= 0.20 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Top 3 Similarity Results</CardTitle>
                    <CardDescription>
                      Top similar researches from database (showing matches above 20%)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                  {result.similarities.slice(0, 3).filter(s => s.overallSimilarity >= 0.20).map((similarity, index) => {
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
                              {overallPercent.toFixed(1)}%
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
                            
                            {/* AI Analysis Button */}
                            {similarity.verification && (
                              <button
                                onClick={() => {
                                  setSelectedVerification(similarity.verification || null)
                                  setIsModalOpen(true)
                                }}
                                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium text-xs transition-all shadow-md hover:shadow-lg"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 8V4H8"/>
                                  <rect width="16" height="12" x="4" y="8" rx="2"/>
                                  <path d="M2 14h2"/>
                                  <path d="M20 14h2"/>
                                  <path d="M15 13v2"/>
                                  <path d="M9 13v2"/>
                                </svg>
                                View AI Analysis
                              </button>
                            )}
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
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="rounded-full bg-green-100 p-4">
                      <CheckCircle className="h-16 w-16 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-green-800">
                    🎉 Congratulations!
                  </h3>
                  <p className="text-lg text-green-700 max-w-md mx-auto">
                    Your research appears to be <span className="font-bold">unique</span>! No significant similarities found in our database.
                  </p>
                  <p className="text-sm text-green-600">
                    All comparisons showed less than 20% similarity.
                  </p>
                  <div className="pt-4">
                    <Link href="/">
                      <Button className="bg-green-600 hover:bg-green-700">
                        Check Another Research
                      </Button>
                    </Link>
                  </div>
                </div>
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
              {/* Combined Summary and Graph */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                  <CardDescription>Quick overview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Similarity Graph */}
                  {result.similarities.length > 0 && result.similarities[0].overallSimilarity >= 0.20 && (
                    <div className="pb-4 border-b">
                      <h3 className="text-sm font-medium mb-3">Top 3 Similarity Graph</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                          data={result.similarities.slice(0, 3).filter(s => s.overallSimilarity >= 0.20).map((s, i) => ({
                            name: `#${i + 1}`,
                            title: s.title.substring(0, 20) + (s.title.length > 20 ? '...' : ''),
                            overall: (s.overallSimilarity * 100).toFixed(1),
                            titleSim: (s.titleSimilarity * 100).toFixed(1),
                            abstractSim: (s.abstractSimilarity * 100).toFixed(1),
                          }))}
                          margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            domain={[0, 100]}
                          />
                          <Tooltip
                            formatter={(value: number) => `${value}%`}
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="overall" fill="#0088FE" name="Overall" />
                          <Bar dataKey="titleSim" fill="#00C49F" name="Title" />
                          <Bar dataKey="abstractSim" fill="#FFBB28" name="Concept" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  
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
                </CardContent>
              </Card>

           
              
            </div>
          </div>
        </div>
      </main>

      {/* AI Analysis Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8V4H8"/>
                  <rect width="16" height="12" x="4" y="8" rx="2"/>
                  <path d="M2 14h2"/>
                  <path d="M20 14h2"/>
                  <path d="M15 13v2"/>
                  <path d="M9 13v2"/>
                </svg>
              </div>
              AI Similarity Analysis
            </DialogTitle>
            <DialogDescription>
              Computer verified and analyzed the similarity scores
            </DialogDescription>
          </DialogHeader>

          {selectedVerification && (
            <div className="space-y-4 mt-4">
              {(() => {
                const sections = selectedVerification.split('\n\n')
                const parsedSections: {color: string, title: string, content: string, isWhy?: boolean}[] = []
                
                sections.forEach(section => {
                  const trimmed = section.trim()
                  if (!trimmed || trimmed.includes('===')) return
                  
                  if (trimmed.toLowerCase().includes('system score')) {
                    parsedSections.push({
                      color: 'blue',
                      title: '📊 What the Computer Calculated',
                      content: trimmed.replace(/^[^:]+:\s*/i, '')
                    })
                  } else if (trimmed.toLowerCase().includes('ai evaluation') || trimmed.toLowerCase().includes('ai accuracy')) {
                    parsedSections.push({
                      color: 'purple',
                      title: '🤖 AI Says',
                      content: trimmed.replace(/^[^:]+:\s*/i, '')
                    })
                  } else if (trimmed.toLowerCase().includes('corrected')) {
                    parsedSections.push({
                      color: 'green',
                      title: '✅ Corrected Score',
                      content: trimmed.replace(/^[^:]+:\s*/i, '')
                    })
                  } else if (trimmed.toLowerCase().includes('reasoning')) {
                    parsedSections.push({
                      color: 'orange',
                      title: '💡 Why?',
                      content: trimmed.replace(/^[^:]+:\s*/i, ''),
                      isWhy: true
                    })
                  } else if (trimmed.toLowerCase().includes('final')) {
                    parsedSections.push({
                      color: 'pink',
                      title: '🎯 Final Answer',
                      content: trimmed.replace(/^[^:]+:\s*/i, '')
                    })
                  }
                })
                
                return parsedSections.map((section, idx) => (
                  <div key={idx} className="bg-white dark:bg-gray-900 rounded-2xl border-2 shadow-lg overflow-hidden">
                    <div className={`px-6 py-4 bg-gradient-to-r ${
                      section.color === 'blue' ? 'from-blue-500/10 to-blue-600/5' :
                      section.color === 'purple' ? 'from-purple-500/10 to-purple-600/5' :
                      section.color === 'green' ? 'from-green-500/10 to-green-600/5' :
                      section.color === 'orange' ? 'from-orange-500/10 to-orange-600/5' :
                      'from-pink-500/10 to-pink-600/5'
                    } border-b-2`}>
                      <h4 className="text-lg font-bold text-foreground">{section.title}</h4>
                    </div>
                    
                    <div className="p-6">
                      <div className="space-y-3">
                        {section.content.split('\n').map((line, lineIdx) => {
                          const trimmedLine = line.trim()
                          if (!trimmedLine) return null
                          
                          if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
                            const text = trimmedLine.substring(1).trim()
                            const boldMatch = text.match(/^\*\*(.+?)\*\*(.*)$/)
                            
                            if (boldMatch) {
                              const label = boldMatch[1].replace(':', '')
                              const content = boldMatch[2].trim()
                              
                              return (
                                <div key={lineIdx} className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 rounded-xl p-4 border-l-4 border-orange-400">
                                  <div className="flex items-start gap-3">
                                    <span className="text-2xl flex-shrink-0">
                                      {label.toLowerCase().includes('title') ? '📝' : '📄'}
                                    </span>
                                    <div className="flex-1">
                                      <div className="font-bold text-foreground mb-2 text-base">{label}</div>
                                      <div className="text-sm text-foreground/80 leading-relaxed">{content}</div>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            
                            const parts = text.split(':')
                            return (
                              <div key={lineIdx} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                                <span className="text-2xl flex-shrink-0 mt-0.5">
                                  {text.toLowerCase().includes('title') ? '📝' :
                                   text.toLowerCase().includes('abstract') || text.toLowerCase().includes('concept') ? '📄' :
                                   text.toLowerCase().includes('overall') ? '🎯' : '📊'}
                                </span>
                                <div className="flex-1">
                                  {parts.length > 1 ? (
                                    <>
                                      <div className="font-semibold text-foreground mb-1">{parts[0]}</div>
                                      <div className="text-2xl font-bold text-primary">{parts[1].trim()}</div>
                                    </>
                                  ) : (
                                    <div className="text-foreground leading-relaxed">{text}</div>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          
                          return (
                            <p key={lineIdx} className="text-base text-foreground/90 leading-relaxed">
                              {trimmedLine}
                            </p>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))
              })()}
              
              <div className="text-center pt-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm font-medium text-muted-foreground">Powered by Gemini AI</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

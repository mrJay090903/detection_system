"use client"

import { useState, useEffect, Suspense } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  Sparkles, 
  FileText, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle, 
  Layers, 
  Lightbulb,
  BookOpen
} from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"

function AIAnalysisContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [analysis, setAnalysis] = useState<string>("")
  const [activeTab, setActiveTab] = useState('core-idea')

  const lexicalSimilarity = parseFloat(searchParams.get('lexicalSimilarity') || '0')
  const semanticSimilarity = parseFloat(searchParams.get('semanticSimilarity') || '0')
  const overallSimilarity = parseFloat(searchParams.get('overallSimilarity') || '0')

  const metrics = {
    lexical: { 
      score: lexicalSimilarity * 100, 
      label: 'Lexical Similarity', 
      status: (lexicalSimilarity * 100) < 15 ? 'low' : (lexicalSimilarity * 100) < 30 ? 'medium' : 'high',
      color: (lexicalSimilarity * 100) < 15 ? 'bg-green-500' : (lexicalSimilarity * 100) < 30 ? 'bg-amber-500' : 'bg-red-500'
    },
    semantic: { 
      score: semanticSimilarity * 100, 
      label: 'Semantic Similarity', 
      status: (semanticSimilarity * 100) < 15 ? 'low' : (semanticSimilarity * 100) < 30 ? 'medium' : 'high',
      color: (semanticSimilarity * 100) < 15 ? 'bg-green-500' : (semanticSimilarity * 100) < 30 ? 'bg-amber-500' : 'bg-red-500'
    },
    overall: { 
      score: overallSimilarity * 100, 
      label: 'Overall Similarity', 
      status: (overallSimilarity * 100) < 15 ? 'low' : (overallSimilarity * 100) < 30 ? 'medium' : 'high',
      color: (overallSimilarity * 100) < 15 ? 'bg-blue-600' : (overallSimilarity * 100) < 30 ? 'bg-amber-500' : 'bg-red-600'
    }
  }

  // Parse AI analysis into sections
  const parseAnalysis = (text: string) => {
    const sections = {
      coreIdea: '',
      keyOverlaps: '',
      similarityReason: '',
      improvements: ''
    }

    // Try to match sections with flexible patterns
    const section1Match = text.match(/SECTION 1[:\s]*Core Idea Match\s*([\s\S]*?)(?=SECTION 2|$)/i)
    const section2Match = text.match(/SECTION 2[:\s]*Key Overlaps\s*([\s\S]*?)(?=SECTION 3|$)/i)
    const section3Match = text.match(/SECTION 3[:\s]*Similarity Reason\s*([\s\S]*?)(?=SECTION 4|$)/i)
    const section4Match = text.match(/SECTION 4[:\s]*Improvement Suggestions\s*([\s\S]*?)$/i)

    if (section1Match) sections.coreIdea = section1Match[1].trim()
    if (section2Match) sections.keyOverlaps = section2Match[1].trim()
    if (section3Match) sections.similarityReason = section3Match[1].trim()
    if (section4Match) sections.improvements = section4Match[1].trim()

    // If no sections found, try the entire text as core idea
    if (!sections.coreIdea && !sections.keyOverlaps && !sections.similarityReason && !sections.improvements) {
      sections.coreIdea = text
    }

    return sections
  }

  // Clean up any remaining markdown formatting
  const cleanText = (text: string) => {
    return text
      .replace(/\*\*/g, '')  // Remove bold markers
      .replace(/##\s*/g, '')  // Remove heading markers
      .replace(/\*/g, '')     // Remove italic markers
      .replace(/^\s*-\s*/gm, '• ') // Convert dashes to bullets
  }

  const sections = analysis ? parseAnalysis(analysis) : null

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        // Get data from URL params
        const userTitle = searchParams.get('userTitle')
        const userConcept = searchParams.get('userConcept')
        const existingTitle = searchParams.get('existingTitle')
        const existingAbstract = searchParams.get('existingAbstract')
        const lexicalSimilarity = searchParams.get('lexicalSimilarity')
        const semanticSimilarity = searchParams.get('semanticSimilarity')
        const overallSimilarity = searchParams.get('overallSimilarity')

        if (!userTitle || !userConcept || !existingTitle || !existingAbstract) {
          toast.error('Missing required data')
          router.push('/research-check')
          return
        }

        const response = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userTitle,
            userConcept,
            existingTitle,
            existingAbstract,
            lexicalSimilarity: parseFloat(lexicalSimilarity || '0'),
            semanticSimilarity: parseFloat(semanticSimilarity || '0'),
            overallSimilarity: parseFloat(overallSimilarity || '0'),
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('AI Analysis API Error:', errorData)
          throw new Error(errorData.error || 'Failed to generate AI analysis')
        }

        const data = await response.json()
        setAnalysis(data.analysis)
        setIsLoading(false)
      } catch (error) {
        console.error('Error generating AI analysis:', error)
        toast.error('Failed to generate AI analysis')
        router.push('/research-check')
      }
    }

    loadAnalysis()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white border border-gray-200 shadow">
                <Image src="/assets/bu-logo.png" width={40} height={40} alt="BU Logo" className="object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Research Comparative Analysis</h1>
                <p className="text-sm text-slate-500">Powered by Gemini AI</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <FileText className="w-4 h-4" />
                Export PDF
              </Button>
              <Button variant="outline" onClick={() => router.back()} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Results
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Sparkles className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Generating AI Analysis</h2>
            <p className="text-gray-600">Our AI is analyzing the similarities between your research and the existing work...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Summary Card */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white">Analysis Summary</h2>
                <p className="text-indigo-100 text-sm mt-1">AI-powered comparison of your research with existing work</p>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Your Research */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
                      <FileText className="w-4 h-4" />
                      YOUR RESEARCH
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      {searchParams.get('userTitle')}
                    </p>
                  </div>
                  {/* Compared Research */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
                      <FileText className="w-4 h-4" />
                      COMPARED WITH
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      {searchParams.get('existingTitle')}
                    </p>
                  </div>
                </div>
                
                {/* Overall Assessment */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Overall Assessment</h3>
                      <p className="text-sm text-slate-600">
                        {(overallSimilarity * 100) < 15 
                          ? "Your research shows good originality with minimal overlap."
                          : (overallSimilarity * 100) < 30
                          ? "Some similarities detected. Review the recommendations below."
                          : "Significant similarities found. Revision strongly recommended."}
                      </p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                      (overallSimilarity * 100) < 15 ? 'bg-green-100 text-green-700' :
                      (overallSimilarity * 100) < 30 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {(overallSimilarity * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(metrics).map(([key, data]) => (
                <div key={key} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium text-slate-500">{data.label}</span>
                    {data.status === 'low' ? 
                      <CheckCircle className="w-5 h-5 text-green-500" /> : 
                      data.status === 'medium' ?
                      <AlertTriangle className="w-5 h-5 text-amber-500" /> :
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    }
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold text-slate-900">{data.score.toFixed(1)}%</span>
                    <span className="text-sm text-slate-400 mb-1">match found</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${data.color}`} 
                      style={{ width: `${Math.min(data.score, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Content Area with Tabs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Navigation */}
              <div className="lg:col-span-1 space-y-6">
                <nav className="flex flex-col gap-2">
                  <button 
                    onClick={() => setActiveTab('core-idea')}
                    className={`text-left px-4 py-3 rounded-lg font-medium transition flex items-center gap-3 ${activeTab === 'core-idea' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <BookOpen className="w-4 h-4" /> Core Idea Match
                  </button>
                  <button 
                    onClick={() => setActiveTab('overlaps')}
                    className={`text-left px-4 py-3 rounded-lg font-medium transition flex items-center gap-3 ${activeTab === 'overlaps' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <Layers className="w-4 h-4" /> Key Overlaps
                  </button>
                  <button 
                    onClick={() => setActiveTab('reason')}
                    className={`text-left px-4 py-3 rounded-lg font-medium transition flex items-center gap-3 ${activeTab === 'reason' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <BarChart3 className="w-4 h-4" /> Similarity Reason
                  </button>
                  <button 
                    onClick={() => setActiveTab('suggestions')}
                    className={`text-left px-4 py-3 rounded-lg font-medium transition flex items-center gap-3 ${activeTab === 'suggestions' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <Lightbulb className="w-4 h-4" /> Improvements
                  </button>
                </nav>
              </div>

              {/* Right Column: Dynamic Content */}
              <div className="lg:col-span-2">
                {/* TAB: CORE IDEA */}
                {activeTab === 'core-idea' && sections?.coreIdea && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl shadow-sm border border-indigo-100 p-8">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-600 rounded-lg">
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Core Idea Analysis</h3>
                      </div>
                      <div className="bg-white rounded-lg p-6 text-slate-700 leading-7 text-base shadow-sm">
                        {cleanText(sections.coreIdea).split('\n').map((paragraph, idx) => (
                          paragraph.trim() && (
                            <p key={idx} className="mb-4 last:mb-0">
                              {paragraph}
                            </p>
                          )
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB: OVERLAPS */}
                {activeTab === 'overlaps' && sections?.keyOverlaps && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm border border-purple-100 p-8">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-600 rounded-lg">
                          <Layers className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Key Overlap Areas</h3>
                      </div>
                      <div className="bg-white rounded-lg p-6 shadow-sm">
                        <div className="space-y-4">
                          {cleanText(sections.keyOverlaps).split('\n').map((paragraph, idx) => (
                            paragraph.trim() && (
                              <div key={idx} className="flex gap-3">
                                <div className="flex-shrink-0 mt-1.5">
                                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                </div>
                                <p className="text-slate-700 leading-7 text-base flex-1">
                                  {paragraph}
                                </p>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB: REASON */}
                {activeTab === 'reason' && sections?.similarityReason && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-sm border border-amber-100 p-8">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-600 rounded-lg">
                          <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Why These Similarities Exist</h3>
                      </div>
                      <div className="bg-white rounded-lg p-6 text-slate-700 leading-7 text-base shadow-sm">
                        {cleanText(sections.similarityReason).split('\n').map((paragraph, idx) => (
                          paragraph.trim() && (
                            <p key={idx} className="mb-4 last:mb-0">
                              {paragraph}
                            </p>
                          )
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB: SUGGESTIONS */}
                {activeTab === 'suggestions' && sections?.improvements && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                      <div className="flex items-center gap-3 mb-2">
                        <Lightbulb className="w-6 h-6" />
                        <h3 className="font-bold text-xl">Differentiation Strategy</h3>
                      </div>
                      <p className="text-indigo-100 text-sm">
                        Follow these recommendations to improve the originality and distinctiveness of your research.
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-100 p-8">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-600 rounded-lg">
                          <Lightbulb className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Recommended Actions</h3>
                      </div>
                      <div className="space-y-4">
                        {cleanText(sections.improvements).split('\n').map((paragraph, idx) => (
                          paragraph.trim() && (
                            <div key={idx} className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
                              <p className="text-slate-700 leading-7 text-base">
                                {paragraph}
                              </p>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function AIAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Analysis</h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    }>
      <AIAnalysisContent />
    </Suspense>
  )
}

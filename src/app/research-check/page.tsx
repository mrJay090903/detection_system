"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { COURSES } from "@/lib/constants"
import { Check, ChevronRight, ChevronLeft, Upload, FileText, BarChart3, Home, Eye, Sparkles } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileDragAndDrop } from "@/components/ui/file-drag-and-drop"

interface StepData {
  course: string
  title: string
  concept: string
  file: File | null
  fileContent: string
  analysisResult?: any
}

const steps = [
  { id: 1, name: "Select Course", icon: FileText },
  { id: 2, name: "Research Details", icon: Upload },
  { id: 3, name: "Analysis Report", icon: BarChart3 },
]

export default function ResearchCheckPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedResearch, setSelectedResearch] = useState<any>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [stepData, setStepData] = useState<StepData>({
    course: "",
    title: "",
    concept: "",
    file: null,
    fileContent: "",
  })

  // Restore state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('researchCheckState')
    if (savedState) {
      try {
        const { currentStep: savedStep, stepData: savedData } = JSON.parse(savedState)
        setCurrentStep(savedStep)
        setStepData(savedData)
        // Clear the saved state after restoring
        sessionStorage.removeItem('researchCheckState')
      } catch (error) {
        console.error('Error restoring state:', error)
      }
    }
  }, [])

  const handleNext = async () => {
    // Validation for each step
    if (currentStep === 1 && !stepData.course) {
      toast.error("Please select a course")
      return
    }
    
    if (currentStep === 2) {
      // If file is uploaded, only file is required
      // If no file, then title and concept are required
      if (!stepData.fileContent) {
        if (!stepData.title) {
          toast.error("Please enter a research title")
          return
        }
        if (!stepData.concept) {
          toast.error("Please enter a research concept")
          return
        }
      }
      
      // Perform similarity check
      await handleSimilarityCheck()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleSimilarityCheck = async () => {
    setIsLoading(true)
    try {
      // Use file content if available, otherwise use textarea content
      const textToCheck = stepData.fileContent.trim() || stepData.concept.trim()
      const titleToUse = stepData.title.trim() || 'Untitled Research'

      console.log('Submitting to API:', {
        title: titleToUse,
        conceptLength: textToCheck.length,
        conceptPreview: textToCheck.substring(0, 100)
      })

      // Perform similarity check
      const response = await fetch('/api/similarity/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedTitle: titleToUse,
          proposedConcept: textToCheck,
        }),
      })

      console.log('API Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Similarity check failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        })
        throw new Error(errorData.error || `Failed to check similarity (${response.status})`)
      }

      const result = await response.json()
      
      console.log('Similarity check successful:', {
        hasResult: !!result,
        hasSimilarities: !!(result.similarities),
        similaritiesCount: result.similarities?.length
      })
      
      setStepData(prev => ({
        ...prev,
        analysisResult: result,
      }))

      setCurrentStep(3)
    } catch (error) {
      console.error('Error checking similarity:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to analyze research. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileContentRead = (content: string) => {
    setStepData({ ...stepData, fileContent: content })
  }

  const handleReset = () => {
    setCurrentStep(1)
    setStepData({
      course: "",
      title: "",
      concept: "",
      file: null,
      fileContent: "",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white border border-gray-200 shadow">
                <Image src="/assets/bu-logo.png" width={40} height={40} alt="BU Logo" className="object-cover" />
              </div>
              <div className="font-bold tracking-wide text-lg">
                <span className="text-[#3896DA]">BICOL</span> <span className="text-[#F86D1B]">UNIVERSITY</span>
              </div>
            </div>
            <Link href="/">
              <Button variant="ghost" className="gap-2">
                <Home className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl font-bold text-gray-800 mb-3">Research Similarity Check</h1>
            <p className="text-gray-600 text-lg">Complete the steps below to analyze your research for similarity</p>
          </motion.div>

          {/* Stepper Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-8 md:p-12"
          >
            {/* Stepper Navigation */}
            <div className="mb-12">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  const isCompleted = currentStep > step.id
                  const isCurrent = currentStep === step.id
                  
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <motion.div
                          initial={false}
                          animate={{
                            scale: isCurrent ? 1.1 : 1,
                            backgroundColor: isCompleted ? '#10b981' : isCurrent ? '#3b82f6' : '#e5e7eb'
                          }}
                          transition={{ duration: 0.3 }}
                          className={`
                            w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300
                            ${isCompleted ? 'border-green-500 text-white' : ''}
                            ${isCurrent ? 'border-blue-500 text-white' : ''}
                            ${!isCompleted && !isCurrent ? 'border-gray-300 text-gray-500' : ''}
                          `}
                        >
                          {isCompleted ? <Check className="w-8 h-8" /> : <Icon className="w-8 h-8" />}
                        </motion.div>
                        <span className={`mt-3 text-sm font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-600'}`}>
                          {step.name}
                        </span>
                      </div>
                      
                      {index < steps.length - 1 && (
                        <motion.div
                          initial={false}
                          animate={{
                            backgroundColor: isCompleted ? '#10b981' : '#e5e7eb'
                          }}
                          transition={{ duration: 0.3 }}
                          className="h-1 flex-1 mx-4 rounded"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="min-h-[400px]"
              >
                {/* Step 1: Course Selection */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-semibold mb-6 text-gray-800">Select Your Course</h3>
                      <p className="text-gray-600 mb-6">Choose your program to help us find relevant research comparisons</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                        {COURSES.map((course, index) => (
                          <motion.button
                            key={course}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setStepData({ ...stepData, course })}
                            className={`
                              p-4 rounded-lg border-2 text-left transition-all duration-200
                              ${stepData.course === course
                                ? 'border-blue-500 bg-blue-50 shadow-md'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                              }
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${
                                stepData.course === course ? 'text-blue-700' : 'text-gray-700'
                              }`}>
                                {course}
                              </span>
                              {stepData.course === course && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                >
                                  <Check className="w-5 h-5 text-blue-600" />
                                </motion.div>
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      
                      {stepData.course && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"
                        >
                          <p className="text-sm text-green-800">
                            <strong>Selected:</strong> {stepData.course}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Title and Concept/File Upload */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-semibold mb-6 text-gray-800">Enter Research Details</h3>
                      
                      <div className="space-y-6">
                        <div>
                          <Label htmlFor="title" className="text-base mb-2 block">
                            Research Title {stepData.fileContent && <span className="text-xs text-muted-foreground font-normal">(Optional when file uploaded)</span>}
                          </Label>
                          <Input
                            id="title"
                            placeholder="Enter your research title"
                            value={stepData.title}
                            onChange={(e) => setStepData({ ...stepData, title: e.target.value })}
                            className="h-12 text-base"
                          />
                        </div>

                        <div>
                          <Label htmlFor="concept" className="text-base mb-2 block">
                            Research Concept/Abstract {stepData.fileContent && <span className="text-xs text-muted-foreground font-normal">(Optional when file uploaded)</span>}
                          </Label>
                          <Textarea
                            id="concept"
                            placeholder={stepData.fileContent ? "File content loaded. You can edit or add more text here..." : "Enter your research concept or abstract"}
                            value={stepData.concept}
                            onChange={(e) => setStepData({ ...stepData, concept: e.target.value })}
                            className="min-h-[200px] text-base"
                          />
                          {stepData.fileContent && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {stepData.fileContent.length.toLocaleString()} characters from file
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex-1 border-t border-gray-300"></div>
                          <span className="text-sm text-gray-500 font-medium">OR</span>
                          <div className="flex-1 border-t border-gray-300"></div>
                        </div>

                        <div>
                          <Label className="text-base mb-2 block">Upload Research File</Label>
                          <FileDragAndDrop onFileContentRead={handleFileContentRead} />
                          <p className="text-xs text-muted-foreground mt-2">
                            💡 Upload a file to skip manual title and concept entry
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Analysis Report */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-semibold mb-6 text-gray-800">Similarity Analysis Report</h3>
                      
                      {stepData.analysisResult ? (
                        <div className="space-y-6">
                          {/* Display the top match score as overall similarity */}
                          {stepData.analysisResult.similarities && stepData.analysisResult.similarities.length > 0 && (
                            <>
                              <div className="p-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                                <div className="flex items-center justify-between mb-6">
                                  <h4 className="text-2xl font-bold text-gray-800">Highest Similarity Detected</h4>
                                  <div className={`text-5xl font-bold ${
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 30 ? 'text-red-600' :
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 20 ? 'text-orange-600' :
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 15 ? 'text-yellow-600' :
                                    'text-green-600'
                                  }`}>
                                    {(stepData.analysisResult.similarities[0].overallSimilarity * 100).toFixed(1)}%
                                  </div>
                                </div>
                                
                                <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stepData.analysisResult.similarities[0].overallSimilarity * 100}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className={`h-full transition-all duration-500 ${
                                      (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 30 ? 'bg-red-500' :
                                      (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 20 ? 'bg-orange-500' :
                                      (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 15 ? 'bg-yellow-500' :
                                      'bg-green-500'
                                    }`}
                                  />
                                </div>

                                {/* Interpretation Message */}
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.5 }}
                                  className={`mt-6 p-4 rounded-lg ${
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 30 ? 'bg-red-100 border border-red-300' :
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 20 ? 'bg-orange-100 border border-orange-300' :
                                    (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 15 ? 'bg-yellow-100 border border-yellow-300' :
                                    'bg-green-100 border border-green-300'
                                  }`}
                                >
                                  {(stepData.analysisResult.similarities[0].overallSimilarity * 100) > 30 ? (
                                    <div>
                                      <p className="font-bold text-red-800 mb-2">⚠️ High Similarity - Often Rejected</p>
                                      <p className="text-sm text-red-700">
                                        Similarity scores above 30% are often rejected. Significant revision is required. 
                                        Please rewrite substantial portions of your research to improve originality.
                                      </p>
                                    </div>
                                  ) : (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 20 ? (
                                    <div>
                                      <p className="font-bold text-orange-800 mb-2">⚠️ Moderate Similarity - Requires Revision</p>
                                      <p className="text-sm text-orange-700">
                                        Similarity scores above 20% typically require revision. Please review and revise 
                                        sections with high similarity to improve originality before submission.
                                      </p>
                                    </div>
                                  ) : (stepData.analysisResult.similarities[0].overallSimilarity * 100) > 15 ? (
                                    <div>
                                      <p className="font-bold text-yellow-800 mb-2">⚠️ Acceptable with Caution</p>
                                      <p className="text-sm text-yellow-700">
                                        Similarity between 15-20% is borderline. Review similar sections and consider minor 
                                        revisions to ensure all sources are properly cited.
                                      </p>
                                    </div>
                                  ) : (
                                    <div>
                                      <p className="font-bold text-green-800 mb-2">✓ Acceptable Similarity Level</p>
                                      <p className="text-sm text-green-700">
                                        Below 10-15% is generally considered safe and acceptable for research publications 
                                        and postgraduate theses. Ensure all references are properly cited.
                                      </p>
                                    </div>
                                  )}
                                </motion.div>
                              </div>

                              {/* Similarity Guidelines */}
                              <div className="p-6 bg-white border border-gray-200 rounded-lg">
                                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                  <BarChart3 className="w-5 h-5" />
                                  Similarity Score Guidelines
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex items-start gap-3">
                                    <div className="w-3 h-3 rounded-full bg-green-500 mt-1"></div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">Below 10-15%: Safe & Acceptable</p>
                                      <p className="text-xs text-gray-600">Generally considered acceptable for research publications and postgraduate theses.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500 mt-1"></div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">15-20%: Borderline</p>
                                      <p className="text-xs text-gray-600">May be acceptable but requires careful review and proper citations.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-3 h-3 rounded-full bg-orange-500 mt-1"></div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">Above 20%: Requires Revision</p>
                                      <p className="text-xs text-gray-600">Typically requires revision before submission.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-3 h-3 rounded-full bg-red-500 mt-1"></div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">Above 30%: Often Rejected</p>
                                      <p className="text-xs text-gray-600">Significant revision required; may be rejected without substantial changes.</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <h4 className="text-lg font-semibold text-gray-800">Similar Research Found ({stepData.analysisResult.totalComparisons || 0} total comparisons):</h4>
                                {stepData.analysisResult.similarities.map((match: any, index: number) => (
                                  <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1">
                                        <h5 className="font-medium text-gray-800 mb-2">{match.title}</h5>
                                        <p className="text-sm text-gray-600">Course: {match.course} | Year: {match.year}</p>
                                      </div>
                                      <div className="ml-4">
                                        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                                          (match.overallSimilarity * 100) > 30 ? 'bg-red-100 text-red-700' :
                                          (match.overallSimilarity * 100) > 20 ? 'bg-orange-100 text-orange-700' :
                                          (match.overallSimilarity * 100) > 15 ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-green-100 text-green-700'
                                        }`}>
                                          {(match.overallSimilarity * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-200">
                                      <div className="text-sm">
                                        <span className="text-gray-500">Lexical:</span>
                                        <span className="ml-2 font-semibold text-gray-700">{(match.lexicalSimilarity * 100).toFixed(1)}%</span>
                                      </div>
                                      <div className="text-sm">
                                        <span className="text-gray-500">Semantic:</span>
                                        <span className="ml-2 font-semibold text-gray-700">{(match.semanticSimilarity * 100).toFixed(1)}%</span>
                                      </div>
                                    </div>
                                    <div className="mt-4 flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          // Store the current state in sessionStorage
                                          sessionStorage.setItem('researchCheckState', JSON.stringify({
                                            currentStep: 3,
                                            stepData: stepData
                                          }))
                                          
                                          const params = new URLSearchParams({
                                            userTitle: stepData.title,
                                            userConcept: stepData.concept,
                                            existingTitle: match.title,
                                            existingAbstract: match.abstract,
                                            lexicalSimilarity: match.lexicalSimilarity.toString(),
                                            semanticSimilarity: match.semanticSimilarity.toString(),
                                            overallSimilarity: match.overallSimilarity.toString(),
                                          })
                                          window.location.href = `/analysis-reports?${params.toString()}`
                                        }}
                                        className="gap-2 border-purple-600 text-purple-600 hover:bg-purple-50"
                                      >
                                        <Sparkles className="w-4 h-4" />
                                        Analyze with AI
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedResearch(match)
                                          setShowDetailsDialog(true)
                                        }}
                                        className="gap-2"
                                      >
                                        <Eye className="w-4 h-4" />
                                        View Details
                                      </Button>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </>
                          )}

                          <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                              <strong>Note:</strong> This analysis is for reference only. Please consult with your advisor 
                              for guidance on improving the originality of your research.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-16">
                          <BarChart3 className="w-20 h-20 text-gray-400 mx-auto mb-4 animate-pulse" />
                          <p className="text-gray-600 text-lg">Processing your analysis...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-8 border-t mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isLoading}
                className="gap-2 h-12 px-6"
                size="lg"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </Button>

              {currentStep < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={isLoading}
                  className="gap-2 h-12 px-8 bg-[#fca311] hover:bg-[#e59200]"
                  size="lg"
                >
                  {isLoading ? (
                    <>Processing...</>
                  ) : (
                    <>
                      {currentStep === 2 ? 'Analyze' : 'Next'}
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button 
                    onClick={handleReset} 
                    variant="outline"
                    className="gap-2 h-12 px-6"
                    size="lg"
                  >
                    Check Another
                  </Button>
                  <Link href="/">
                    <Button className="gap-2 h-12 px-8 bg-[#fca311] hover:bg-[#e59200]" size="lg">
                      Done
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Research Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Research Details</DialogTitle>
            <DialogDescription>
              Full information about the similar research
            </DialogDescription>
          </DialogHeader>
          
          {selectedResearch && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Similarity Score */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">Overall Similarity</h3>
                    <span className={`px-4 py-2 rounded-full text-lg font-bold ${
                      (selectedResearch.overallSimilarity * 100) > 30 ? 'bg-red-100 text-red-700' :
                      (selectedResearch.overallSimilarity * 100) > 20 ? 'bg-orange-100 text-orange-700' :
                      (selectedResearch.overallSimilarity * 100) > 15 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {(selectedResearch.overallSimilarity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-gray-600">Lexical Similarity</p>
                      <p className="text-lg font-semibold text-gray-800">{(selectedResearch.lexicalSimilarity * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Semantic Similarity</p>
                      <p className="text-lg font-semibold text-gray-800">{(selectedResearch.semanticSimilarity * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                {/* Research Information */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-gray-600">Title</Label>
                    <p className="text-base font-medium text-gray-800 mt-1">{selectedResearch.title}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">Course</Label>
                      <p className="text-base font-medium text-gray-800 mt-1">{selectedResearch.course}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Year</Label>
                      <p className="text-base font-medium text-gray-800 mt-1">{selectedResearch.year}</p>
                    </div>
                  </div>

                  {selectedResearch.researchers && selectedResearch.researchers.length > 0 && (
                    <div>
                      <Label className="text-sm text-gray-600 mb-2 block">Researcher(s)</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedResearch.researchers.map((researcher: string, index: number) => (
                          <span 
                            key={index}
                            className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700"
                          >
                            {researcher}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm text-gray-600 mb-2 block">Abstract</Label>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {selectedResearch.abstract}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

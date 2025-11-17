"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import LiquidEther from "@/components/ui/LiquidEther"
import { LoginForm } from "@/components/ui/login-form"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { FileUpload } from "@/components/file-upload"
import { UploadedFileViewDialog } from "@/components/uploaded-file-view-dialog"
import { Separator } from "@/components/ui/separator"

export default function Home() {
  const router = useRouter()
  const [proposedTitle, setProposedTitle] = useState("")
  const [proposedConcept, setProposedConcept] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{
    name: string
    content: string
  } | null>(null)

  const handleFileUpload = (file: File, extractedText: string) => {
    setUploadedFile({
      name: file.name,
      content: extractedText,
    })
    // Auto-fill the concept field with extracted text
    // For long documents, try to extract the core concept/abstract
    const processedText = extractCoreContent(extractedText)
    setProposedConcept(processedText)
    
    // Auto-fill title from filename (remove extension and clean up)
    if (!proposedTitle.trim()) {
      const titleFromFile = file.name
        .replace(/\.(pdf|docx?|txt)$/i, '') // Remove extension
        .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .trim()
      setProposedTitle(titleFromFile)
    }
    
    toast.success(`File "${file.name}" uploaded and text extracted successfully`)
  }

  // Helper function to extract core concept from long documents
  const extractCoreContent = (text: string): string => {
    // If text is short enough (< 800 chars), use as is
    if (text.length < 800) {
      return text
    }

    // Try to find Introduction section (handles both single and double newlines)
    // Match from "Introduction" to next section header (2., Objectives, etc.)
    const introMatch = text.match(/(?:1\.\s*)?Introduction\s*\n+([\s\S]+?)(?=\n+(?:2\.|Objectives|Methodology|Significance))/i)
    if (introMatch && introMatch[1]) {
      const intro = introMatch[1].trim()
      // Remove any numbering or extra formatting
      const cleaned = intro.replace(/^\d+\.\s*/gm, '').trim()
      // Limit to 800 characters for optimal AI processing
      return cleaned.length > 800 ? cleaned.substring(0, 800) + '...' : cleaned
    }

    // Try to find Abstract section
    const abstractMatch = text.match(/Abstract\s*\n+([\s\S]+?)(?=\n+(?:Introduction|1\.|Keywords|$))/i)
    if (abstractMatch && abstractMatch[1]) {
      const abstract = abstractMatch[1].trim()
      return abstract.length > 800 ? abstract.substring(0, 800) + '...' : abstract
    }

    // Fallback: Skip title lines and take content
    const lines = text.split('\n').filter(l => l.trim().length > 0)
    // Find first paragraph with substantial content (not just headers)
    let startIdx = 0
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].length > 50 && !lines[i].match(/^(Title:|Abstract|Introduction)/i)) {
        startIdx = i
        break
      }
    }
    
    const content = lines.slice(startIdx).join(' ').trim()
    // Return first 800 characters
    return content.length > 800 ? content.substring(0, 800) + '...' : content
  }

  const handleCheckSimilarity = () => {
    // Use uploaded file content if available, otherwise use manual input
    const conceptToAnalyze = uploadedFile?.content || proposedConcept
    
    if (!proposedTitle.trim() || !conceptToAnalyze.trim()) {
      toast.error("Please fill in both research title and concept")
      return
    }

    // Store uploaded file info in sessionStorage if available
    if (uploadedFile) {
      sessionStorage.setItem('uploadedFile', JSON.stringify(uploadedFile))
    } else {
      sessionStorage.removeItem('uploadedFile')
    }

    // Navigate to results page with query parameters using Next.js router
    const params = new URLSearchParams({
      title: proposedTitle.trim(),
      concept: conceptToAnalyze.trim(),
    })
    router.push(`/similarity-results?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background Effect */}
      <div className="absolute inset-0 -z-10">
        <LiquidEther
          mouseForce={15}
          cursorSize={80}
          colors={['#1e40af', '#3b82f6', '#93c5fd']}
          autoDemo={true}
          className="w-full h-full"
        />
      </div>

      {/* Header */}
      <header className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image 
              src="/file.svg" 
              alt="Logo" 
              width={32} 
              height={32} 
            />
            <h1 className="text-xl font-bold">Research Concept Detection</h1>
          </div>
          <LoginForm />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-32 pb-16">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Research Concept Similarity Detection
            </h1>
            <p className="text-lg text-muted-foreground">
              Detect similarities between research concepts to ensure originality and avoid duplication
            </p>
          </div>

          {/* Input Form */}
          <div className="space-y-6 p-6 bg-card rounded-lg shadow-lg border">
            <div className="space-y-4">
              {!uploadedFile && (
                <>
                  <div>
                    <Label htmlFor="title" className="mb-2">
                      Proposed Research Title
                    </Label>
                    <Input
                      id="title"
                      type="text"
                      placeholder="Enter your research title"
                      value={proposedTitle}
                      onChange={(e) => setProposedTitle(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="concept" className="mb-2">
                      Research Concept
                    </Label>
                    <Textarea
                      id="concept"
                      rows={6}
                      placeholder="Describe your research concept..."
                      value={proposedConcept}
                      onChange={(e) => setProposedConcept(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex items-center gap-4 my-4">
                    <Separator className="flex-1" />
                    <span className="text-sm text-muted-foreground">OR</span>
                    <Separator className="flex-1" />
                  </div>
                </>
              )}

              {uploadedFile && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-green-900 mb-1">File Uploaded Successfully</h3>
                      <p className="text-sm text-green-700 mb-2">
                        {uploadedFile.name}
                      </p>
                      <p className="text-xs text-green-600">
                        Title and concept have been extracted from your file. Click "Check Similarity" to proceed.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUploadedFile(null)
                        setProposedTitle("")
                        setProposedConcept("")
                      }}
                      className="text-green-700 hover:text-green-900 hover:bg-green-100"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <Label className="mb-2">
                  {uploadedFile ? "Upload Different File" : "Upload Research Document"}
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Upload a PDF, DOCX, or TXT file to automatically extract title and content
                </p>
                <FileUpload
                  onFileUpload={handleFileUpload}
                  disabled={isLoading}
                />
                {uploadedFile && (
                  <div className="mt-3">
                    <UploadedFileViewDialog
                      fileName={uploadedFile.name}
                      fileContent={uploadedFile.content}
                      triggerText="View Uploaded File"
                    />
                  </div>
                )}
              </div>

              <Button 
                className="w-full" 
                onClick={handleCheckSimilarity}
                disabled={isLoading || !proposedTitle.trim() || (!proposedConcept.trim() && !uploadedFile)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking Similarity...
                  </>
                ) : (
                  "Check Similarity"
                )}
              </Button>
            </div>
          </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">Instant Analysis</h3>
              <p className="text-sm text-muted-foreground">Get immediate results on concept similarity</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">Advanced Detection</h3>
              <p className="text-sm text-muted-foreground">Using sophisticated algorithms for accuracy</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">Detailed Reports</h3>
              <p className="text-sm text-muted-foreground">Comprehensive similarity analysis reports</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

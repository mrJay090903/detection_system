"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import LiquidEther from "@/components/ui/LiquidEther"
import { LoginForm } from "@/components/ui/login-form"
import { Loader2, Upload, FileText, X } from "lucide-react"
import { toast } from "sonner"

export default function Home() {
  const [proposedTitle, setProposedTitle] = useState("")
  const [proposedConcept, setProposedConcept] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const validExtensions = ['.pdf', '.docx']
    const fileName = file.name.toLowerCase()
    
    if (!validTypes.includes(file.type) && !validExtensions.some(ext => fileName.endsWith(ext))) {
      toast.error("Please upload a PDF or DOCX file")
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB")
      return
    }

    setUploadedFile(file)
    setIsExtracting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract text')
      }

      // Set the extracted text as the concept
      setProposedConcept(data.text)
      toast.success(`Text extracted successfully from ${data.fileName}`)
    } catch (error) {
      console.error('File upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to extract text from file')
      setUploadedFile(null)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setProposedConcept("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleCheckSimilarity = () => {
    if (!proposedTitle.trim() || !proposedConcept.trim()) {
      toast.error("Please fill in both research title and concept")
      return
    }

    // Navigate to results page with query parameters
    const params = new URLSearchParams({
      title: proposedTitle.trim(),
      concept: proposedConcept.trim(),
    })
    window.location.href = `/similarity-results?${params.toString()}`
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
                  disabled={isExtracting}
                />
              </div>

              <div>
                <Label htmlFor="concept" className="mb-2">
                  Research Concept
                </Label>
                
                {/* File Upload Section */}
                <div className="mb-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isExtracting}
                      className="flex-1"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Extracting text...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload PDF or DOCX
                        </>
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  
                  {uploadedFile && (
                    <div className="mt-2 flex items-center gap-2 p-2 bg-muted rounded-md">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{uploadedFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveFile}
                        disabled={isExtracting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a PDF or DOCX file to auto-fill the concept, or type manually below
                  </p>
                </div>
                
                <Textarea
                  id="concept"
                  rows={6}
                  placeholder="Describe your research concept... (or upload a PDF/DOCX file above)"
                  value={proposedConcept}
                  onChange={(e) => setProposedConcept(e.target.value)}
                  disabled={isExtracting}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleCheckSimilarity}
                disabled={isExtracting || !proposedTitle.trim() || !proposedConcept.trim()}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
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
              <h3 className="font-semibold mb-2">PDF & Document Upload</h3>
              <p className="text-sm text-muted-foreground">Upload PDF or DOCX files for automatic text extraction</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">TF-IDF Vectorization</h3>
              <p className="text-sm text-muted-foreground">Advanced text similarity using TF-IDF algorithms</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">AI-Powered Analysis</h3>
              <p className="text-sm text-muted-foreground">Comprehensive similarity reports with AI insights</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

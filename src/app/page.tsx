"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import LiquidEther from "@/components/ui/LiquidEther"
import { LoginForm } from "@/components/ui/login-form"
import { Loader2, Upload, FileText, X, Eye } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function Home() {
  const [proposedTitle, setProposedTitle] = useState("")
  const [proposedConcept, setProposedConcept] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showContentDialog, setShowContentDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const processFile = async (file: File) => {
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

      // File is sent to API for text extraction only - not saved to server
      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract text')
      }

      // Set the extracted text as the concept (file is scanned, not saved)
      setProposedConcept(data.text)
      toast.success(`Text scanned successfully from ${data.fileName}`)
    } catch (error) {
      console.error('File scan error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to scan text from file')
      setUploadedFile(null)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only set dragging to false if we're leaving the drop zone itself
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      await processFile(file)
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
                
                {/* Drag and Drop File Upload Section */}
                <div className="mb-3">
                  <div
                    ref={dropZoneRef}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      relative border-2 border-dashed rounded-lg p-6 transition-all duration-200
                      ${isDragging 
                        ? 'border-primary bg-primary/5 scale-[1.02]' 
                        : 'border-muted-foreground/25 bg-muted/30'
                      }
                      ${isExtracting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50 hover:bg-muted/50'}
                    `}
                    onClick={() => !isExtracting && fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isExtracting}
                    />
                    
                    <div className="flex flex-col items-center justify-center space-y-3">
                      {isExtracting ? (
                        <>
                          <Loader2 className="h-10 w-10 animate-spin text-primary" />
                          <p className="text-sm font-medium text-primary">Scanning document...</p>
                          <p className="text-xs text-muted-foreground">Reading content from your file</p>
                        </>
                      ) : isDragging ? (
                        <>
                          <Upload className="h-10 w-10 text-primary" />
                          <p className="text-sm font-medium text-primary">Drop your file here</p>
                          <p className="text-xs text-muted-foreground">PDF or DOCX only</p>
                        </>
                      ) : (
                        <>
                          <div className="p-3 rounded-full bg-primary/10">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">
                              Drag & drop your file here
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              or click to browse • PDF or DOCX • Max 10MB
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {uploadedFile && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="p-2 rounded-md bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadedFile.size / 1024).toFixed(1)} KB • File scanned (not saved)
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveFile}
                        disabled={isExtracting}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                    <span className="text-primary mt-0.5">ℹ️</span>
                    <span>Files are only scanned to read the concept paper - they are not saved to the server</span>
                  </p>
                </div>
                
                {/* Show View Content button if file is uploaded, otherwise show textarea */}
                {uploadedFile && proposedConcept ? (
                  <div className="space-y-2">
                    <div className="p-4 bg-muted/50 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Extracted text ready ({proposedConcept.length.toLocaleString()} characters)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowContentDialog(true)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Content
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click "View Content" to see the extracted text
                    </p>
                  </div>
                ) : (
                  <Textarea
                    id="concept"
                    rows={6}
                    placeholder="Describe your research concept... (or upload a PDF/DOCX file above)"
                    value={proposedConcept}
                    onChange={(e) => setProposedConcept(e.target.value)}
                    disabled={isExtracting}
                  />
                )}
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
              <h3 className="font-semibold mb-2">Drag & Drop Upload</h3>
              <p className="text-sm text-muted-foreground">Simply drag and drop PDF or DOCX files - files are scanned, not saved</p>
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

      {/* Content View Dialog */}
      <Dialog open={showContentDialog} onOpenChange={setShowContentDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Extracted Content</DialogTitle>
            <DialogDescription>
              {uploadedFile?.name} ({proposedConcept.length.toLocaleString()} characters)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
            <div className="whitespace-pre-wrap text-sm">
              {proposedConcept}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

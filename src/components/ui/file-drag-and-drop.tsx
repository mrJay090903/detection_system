"use client"

import { useRef, useState } from "react"
import { Upload, FileText, X, Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface FileDragAndDropProps {
  onFileContentRead: (content: string, title?: string) => void
}

export function FileDragAndDrop({ onFileContentRead }: FileDragAndDropProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedContent, setExtractedContent] = useState("")
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

      // Set the extracted text
      setExtractedContent(data.text)
      onFileContentRead(data.text, data.title)
      
      if (data.title && data.title !== 'Untitled Research') {
        toast.success(`Extracted: "${data.title}" (${data.extractedLength} chars)`)
      } else {
        toast.success(`Text extracted successfully from ${data.fileName}`)
      }
    } catch (error) {
      console.error('File extraction error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to extract text from file')
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
    const items = e.dataTransfer.items
    if (items && items.length > 0 && items[0].kind === 'file') {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only set dragging to false when leaving the entire drop zone
    const rect = dropZoneRef.current?.getBoundingClientRect()
    if (rect) {
      const isOutside = 
        e.clientX <= rect.left ||
        e.clientX >= rect.right ||
        e.clientY <= rect.top ||
        e.clientY >= rect.bottom
      
      if (isOutside) {
        setIsDragging(false)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Set the dropEffect to show the correct cursor
    e.dataTransfer.dropEffect = 'copy'
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
    setExtractedContent("")
    onFileContentRead("", "")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      {/* Drag and Drop Zone */}
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
        onClick={(e) => {
          if (!isExtracting && !isDragging) {
            fileInputRef.current?.click()
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isExtracting}
        />
        
        <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
          {isExtracting ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-primary">Extracting text from document...</p>
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
      
      {/* Uploaded File Info */}
      {uploadedFile && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="p-2 rounded-md bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(uploadedFile.size / 1024).toFixed(1)} KB • {extractedContent.length.toLocaleString()} characters extracted
            </p>
          </div>
          {extractedContent && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setShowContentDialog(true)
              }}
              className="shrink-0"
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleRemoveFile()
            }}
            disabled={isExtracting}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground flex items-start gap-1">
        <span className="text-primary mt-0.5">ℹ️</span>
        <span>Files are only scanned to extract text - they are not saved to the server</span>
      </p>

      {/* Content View Dialog */}
      <Dialog open={showContentDialog} onOpenChange={setShowContentDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Extracted Content</DialogTitle>
            <DialogDescription>
              {uploadedFile?.name} ({extractedContent.length.toLocaleString()} characters)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
            <div className="whitespace-pre-wrap text-sm">
              {extractedContent}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

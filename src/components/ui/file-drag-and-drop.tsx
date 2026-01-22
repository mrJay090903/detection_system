"use client"

import { useRef, useState } from "react"
import { Upload, FileText, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface FileDragAndDropProps {
  onFileContentRead: (content: string, title?: string) => void
}

export function FileDragAndDrop({ onFileContentRead }: FileDragAndDropProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedContent, setExtractedContent] = useState("")
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
        // Show detailed error message
        const errorMessage = data.error || 'Failed to extract text from file'
        const detailedMessage = data.details ? `${errorMessage} (${data.details})` : errorMessage
        throw new Error(errorMessage)
      }

      // Validate that we got text
      if (!data.text || data.text.length < 10) {
        throw new Error('No meaningful text could be extracted from the file. The file may be empty or contain only images.')
      }

      // Set the extracted text
      setExtractedContent(data.text)
      onFileContentRead(data.text, data.title)
      
      if (data.title && data.title !== 'Untitled Research') {
        toast.success(`Extracted: "${data.title}" (${data.extractedLength} chars)`)
      } else {
        toast.success(`Text extracted successfully (${data.extractedLength || data.text.length} chars)`)
      }
    } catch (error) {
      console.error('File extraction error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract text from file'
      toast.error(errorMessage, { duration: 5000 })
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
    <div className="space-y-2">
      {/* Compact Drag and Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border border-dashed rounded-lg py-3 px-4 transition-all duration-200
          ${isDragging 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 bg-gray-50'
          }
          ${isExtracting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50'}
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
        
        <div className="flex items-center gap-3 pointer-events-none">
          {isExtracting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-600">Extracting text...</p>
              </div>
            </>
          ) : uploadedFile ? (
            <>
              <div className="p-1.5 rounded bg-green-100 flex-shrink-0">
                <FileText className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-gray-700">{uploadedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(uploadedFile.size / 1024).toFixed(0)} KB • {extractedContent.length.toLocaleString()} chars
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleRemoveFile()
                }}
                disabled={isExtracting}
                className="shrink-0 h-7 w-7 p-0 pointer-events-auto hover:bg-red-100"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <div className="p-1.5 rounded-md bg-blue-100 flex-shrink-0">
                <Upload className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-700">
                  Drop file or click to upload
                </p>
                <p className="text-xs text-gray-500">PDF or DOCX • Max 10MB</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

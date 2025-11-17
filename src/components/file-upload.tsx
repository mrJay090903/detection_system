"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { FileText, Upload, X } from "lucide-react"
import { toast } from "sonner"

interface FileUploadProps {
  onFileUpload: (file: File, extractedText: string) => void
  disabled?: boolean
}

export function FileUpload({ onFileUpload, disabled }: FileUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB")
      return
    }

    setUploadedFile(file)
    setIsProcessing(true)
    
    toast.loading(`Processing ${file.name}...`, { id: 'file-upload' })

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = "Failed to extract text from file"
        try {
          const responseText = await response.text()
          console.log("API Response Text:", responseText)
          
          if (responseText) {
            try {
              const errorData = JSON.parse(responseText)
              console.log("Parsed error data:", errorData)
              errorMessage = errorData.error || errorMessage
            } catch (jsonError) {
              console.error("Response is not JSON:", responseText)
              errorMessage = responseText.substring(0, 200) // Show first 200 chars
            }
          } else {
            errorMessage = `Server returned empty response (${response.status})`
          }
        } catch (parseError) {
          console.error("Failed to read error response:", parseError)
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (data.success) {
        toast.success(`Successfully extracted text from ${file.name}`, { id: 'file-upload' })
        onFileUpload(file, data.text)
      } else {
        throw new Error(data.error || "Failed to process file")
      }
    } catch (error) {
      console.error("Error processing file:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to process file"
      toast.error(errorMessage, { id: 'file-upload' })
      setUploadedFile(null)
    } finally {
      setIsProcessing(false)
    }
  }, [onFileUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    disabled: disabled || isProcessing,
  })

  const removeFile = () => {
    setUploadedFile(null)
  }

  return (
    <div className="space-y-4">
      {!uploadedFile ? (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          {isDragActive ? (
            <p className="text-lg font-medium">Drop the file here...</p>
          ) : isProcessing ? (
            <p className="text-lg font-medium">Processing file...</p>
          ) : (
            <>
              <p className="text-lg font-medium mb-2">
                Drag & drop a file here, or click to select
              </p>
              <p className="text-sm text-muted-foreground">
                Supports PDF, DOCX, DOC, and TXT files (max 10MB)
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">{uploadedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(uploadedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={removeFile}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

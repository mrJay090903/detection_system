"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ResearchFormData } from "@/types/research"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { COURSES } from "@/lib/constants"
import { Upload, FileText, X } from "lucide-react"

interface ResearchFormProps {
  mode: 'create' | 'edit'
  initialData?: ResearchFormData & { id?: string }
  onSuccess?: () => void
  facultyId: string
  trigger?: React.ReactNode
}

export function ResearchForm({ mode, initialData, onSuccess, facultyId, trigger }: ResearchFormProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [formData, setFormData] = useState<ResearchFormData>(
    initialData || {
      title: "",
      thesis_brief: "",
      year: new Date().getFullYear(),
      course: COURSES[0],
      researchers: [],
    }
  )

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or DOCX file')
      return
    }

    setUploadedFile(file)
    setIsExtracting(true)

    try {
      // Extract text from file
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to extract text')
      }

      const result = await response.json()
      
      // Populate the form with extracted data (user can edit)
      setFormData(prev => ({
        ...prev,
        title: result.title || prev.title,
        thesis_brief: result.text || prev.thesis_brief,
      }))

      toast.success('File content extracted successfully. You can now edit the fields.')
    } catch (error) {
      console.error('File extraction error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to extract text from file')
      setUploadedFile(null)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    // Don't clear the form data - user might want to keep the extracted text
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (mode === 'create') {
        const { error } = await supabase
          .from('researches')
          .insert([
            {
              title: formData.title,
              thesis_brief: formData.thesis_brief,
              year: formData.year,
              course: formData.course,
              researchers: formData.researchers,
              faculty_id: facultyId
            }
          ])

        if (error) throw error

        toast.success('Research added successfully')
        
        // Reset form data for create mode only
        setFormData({
          title: "",
          thesis_brief: "",
          year: new Date().getFullYear(),
          course: COURSES[0],
          researchers: [],
        })
        setResearchersInput("")
        
      } else if (initialData?.id) {
        const { error } = await supabase
          .from('researches')
          .update({
            title: formData.title,
            thesis_brief: formData.thesis_brief,
            year: formData.year,
            course: formData.course,
            researchers: formData.researchers
          })
          .eq('id', initialData.id)

        if (error) throw error

        toast.success('Research updated successfully')
      }

      // Close dialog on success
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error saving research:', error)
      toast.error('Failed to save research. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const [researchersInput, setResearchersInput] = useState(
    initialData ? initialData.researchers.join(', ') : ''
  )

  const handleResearchersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update the raw input value
    const value = e.target.value
    setResearchersInput(value)
    
    // Convert to array for the form data
    const researchers = value
      ? value.split(',').map(r => r.trim()).filter(Boolean)
      : []

    setFormData(prev => ({ ...prev, researchers }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={mode === 'create' ? 'default' : 'outline'}>
            {mode === 'create' ? 'Add New Research' : 'Edit Research'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add New Research' : 'Edit Research'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Add a new research entry to your dashboard' 
              : 'Make changes to your research entry'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* File Upload Section */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Upload Research Document (Optional)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileUpload}
                  disabled={isLoading || isExtracting}
                  className="cursor-pointer"
                />
              </div>
              {uploadedFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFile}
                  disabled={isLoading || isExtracting}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {uploadedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{uploadedFile.name}</span>
              </div>
            )}
            {isExtracting && (
              <p className="text-sm text-muted-foreground">Extracting text from file...</p>
            )}
            <p className="text-xs text-muted-foreground">
              Upload a PDF or DOCX file to auto-fill title and thesis brief, or enter manually below
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                min={1900}
                max={new Date().getFullYear()}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <Select
                value={formData.course}
                onValueChange={(value: typeof formData.course) => setFormData(prev => ({ ...prev, course: value }))}
                disabled={isLoading}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {COURSES.map((course) => (
                    <SelectItem key={course} value={course}>
                      {course}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Research Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              disabled={isLoading || isExtracting}
              placeholder="Enter research title or upload a file"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="researchers">Researchers (comma-separated)</Label>
            <Input
              id="researchers"
              value={researchersInput}
              onChange={handleResearchersChange}
              placeholder="John Doe, Jane Smith"
              required
              disabled={isLoading || isExtracting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="thesis_brief">Thesis Brief / Concept Paper</Label>
            <Textarea
              id="thesis_brief"
              value={formData.thesis_brief}
              onChange={(e) => setFormData(prev => ({ ...prev, thesis_brief: e.target.value }))}
              required
              disabled={isLoading || isExtracting}
              className="h-[150px] resize-none overflow-auto whitespace-pre-wrap wrap-break-word leading-relaxed"
              placeholder="Enter thesis brief or upload a file to auto-fill..."
              wrap="soft"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading || isExtracting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isExtracting}>
              {isLoading ? 'Saving...' : isExtracting ? 'Extracting...' : mode === 'create' ? 'Add Research' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
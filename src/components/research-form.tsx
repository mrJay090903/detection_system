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
  const [formData, setFormData] = useState<ResearchFormData>(
    initialData || {
      title: "",
      abstract: "",
      year: new Date().getFullYear(),
      course: COURSES[0],
      researchers: [],
    }
  )

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
              abstract: formData.abstract,
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
          abstract: "",
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
            abstract: formData.abstract,
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
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="abstract">Abstract</Label>
            <Textarea
              id="abstract"
              value={formData.abstract}
              onChange={(e) => setFormData(prev => ({ ...prev, abstract: e.target.value }))}
              required
              disabled={isLoading}
              className="h-[150px] resize-none overflow-auto whitespace-pre-wrap wrap-break-word leading-relaxed"
              placeholder="Enter your research abstract..."
              wrap="soft"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : mode === 'create' ? 'Add Research' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
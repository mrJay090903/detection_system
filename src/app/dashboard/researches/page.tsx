"use client"

import { useState, useEffect } from "react"
import { ResearchForm } from "@/components/research-form"
import { getCurrentFaculty } from "@/lib/auth"
import { Research } from "@/types/research"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ResearchViewDialog } from "@/components/research-view-dialog"
import { Eye } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { COURSES } from "@/lib/constants"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function ResearchDashboard() {
  const [researches, setResearches] = useState<Research[]>([])
  const [filteredResearches, setFilteredResearches] = useState<Research[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [facultyId, setFacultyId] = useState<string | null>(null)
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCourse, setSelectedCourse] = useState<string>("")
  const [selectedYear, setSelectedYear] = useState<string>("")

  // Get unique years from researches
  const years = [...new Set(researches.map(r => r.year))].sort((a, b) => b - a)

  // Filter function
  const filterResearches = () => {
    let filtered = [...researches]

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(research => 
        research.title.toLowerCase().includes(query) ||
        research.researchers.some(r => r.toLowerCase().includes(query))
      )
    }

    // Filter by course
    if (selectedCourse) {
      filtered = filtered.filter(research => research.course === selectedCourse)
    }

    // Filter by year
    if (selectedYear) {
      filtered = filtered.filter(research => research.year === parseInt(selectedYear))
    }

    setFilteredResearches(filtered)
  }

  // Apply filters whenever filter states change
  useEffect(() => {
    filterResearches()
  }, [searchQuery, selectedCourse, selectedYear, researches])

  useEffect(() => {
    const loadFacultyAndResearches = async () => {
      try {
        const faculty = await getCurrentFaculty()
        if (!faculty) {
          throw new Error('Not authenticated')
        }
        setFacultyId(faculty.id)
        await fetchResearches(faculty.id)
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load researches')
      } finally {
        setIsLoading(false)
      }
    }

    loadFacultyAndResearches()
  }, [])

  const fetchResearches = async (id: string) => {
    const { data, error } = await supabase
      .from('researches')
      .select('*')
      .eq('faculty_id', id)
      .order('year', { ascending: false })

    if (error) throw error
    setResearches(data || [])
  }

  const handleDelete = async (researchId: string) => {
    try {
      const { error } = await supabase
        .from('researches')
        .delete()
        .eq('id', researchId)

      if (error) throw error

      setResearches(prev => prev.filter(r => r.id !== researchId))
      toast.success('Research deleted successfully')
    } catch (error) {
      console.error('Error deleting research:', error)
      toast.error('Failed to delete research')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Research Management</h2>
        {facultyId && (
          <ResearchForm
            mode="create"
            facultyId={facultyId}
            onSuccess={() => facultyId && fetchResearches(facultyId)}
          />
        )}
      </div>

      {/* Filters Section */}
      <div className="bg-muted/50 p-6 rounded-lg mb-6 border shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-1">Filter Researches</h3>
          <p className="text-sm text-muted-foreground">
            Use the filters below to find specific research entries
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Search Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              Search
            </label>
            <Input
              placeholder="Search by title or researcher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Course Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Course
            </label>
            <Select 
              value={selectedCourse || "all"} 
              onValueChange={(value) => setSelectedCourse(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {COURSES.map((course) => (
                  <SelectItem key={course} value={course}>
                    {course}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              Year
            </label>
            <Select 
              value={selectedYear || "all"} 
              onValueChange={(value) => setSelectedYear(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || selectedCourse || selectedYear) && (
          <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm">
            <span className="font-medium">Active filters:</span>
            <div className="flex flex-wrap gap-2">
              {searchQuery && (
                <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">
                  Search: {searchQuery}
                </span>
              )}
              {selectedCourse && (
                <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">
                  Course: {selectedCourse}
                </span>
              )}
              {selectedYear && (
                <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">
                  Year: {selectedYear}
                </span>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCourse("");
                  setSelectedYear("");
                }}
              >
                Clear all
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResearches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No research entries found
                </TableCell>
              </TableRow>
            ) : (
              filteredResearches.map((research) => (
                <TableRow key={research.id}>
                  <TableCell className="font-medium">{research.year}</TableCell>
                  <TableCell>{research.title}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <ResearchViewDialog 
                      research={research}
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      }
                      onEdit={() => {
                        const editButton = document.querySelector(`[data-research-id="${research.id}"]`);
                        if (editButton instanceof HTMLElement) {
                          editButton.click();
                        }
                      }}
                    />
                    <ResearchForm
                      mode="edit"
                      facultyId={research.faculty_id}
                      initialData={research}
                      onSuccess={() => facultyId && fetchResearches(facultyId)}
                      trigger={
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-research-id={research.id}
                        >
                          Edit
                        </Button>
                      }
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Research</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this research? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(research.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
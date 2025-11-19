"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Trash2, UserPlus, Shield } from "lucide-react"

const DEPARTMENTS = [
  "TEACHER EDUCATION DEPARTMENT",
  "NURSING DEPARTMENT",
  "COMPUTER STUDIES DEPARTMENT",
  "TECHNOLOGY DEPARTMENT",
  "ENTREP DEPARTMENT",
  "ENGINEERING DEPARTMENT",
]

interface Faculty {
  id: string
  email: string
  first_name: string
  last_name: string
  department: string
  created_at: string
}

export default function AdminPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Form states
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [department, setDepartment] = useState("")
  
  // Filter state
  const [filterDepartment, setFilterDepartment] = useState<string>("all")

  useEffect(() => {
    loadFaculties()
  }, [])

  const loadFaculties = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("faculty")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setFaculties(data || [])
    } catch (error) {
      console.error("Error loading faculties:", error)
      toast.error("Failed to load faculty list")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password || !firstName || !lastName || !department) {
      toast.error("Please fill in all fields")
      return
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setIsSubmitting(true)

    try {
      // Call API route to create faculty
      const response = await fetch("/api/admin/create-faculty", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          department,
        }),
      })

      console.log("Response status:", response.status)
      console.log("Response ok:", response.ok)

      let data
      const contentType = response.headers.get("content-type")
      console.log("Content-Type:", contentType)
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json()
      } else {
        const text = await response.text()
        console.error("Non-JSON response:", text)
        throw new Error("Server returned non-JSON response: " + text.substring(0, 100))
      }

      if (!response.ok) {
        console.error("API Error:", data)
        throw new Error(data.error || data.details || "Failed to create faculty member")
      }

      toast.success("Faculty member added successfully!")
      
      // Reset form
      setEmail("")
      setPassword("")
      setFirstName("")
      setLastName("")
      setDepartment("")
      
      // Close dialog
      setIsDialogOpen(false)
      
      // Reload faculty list
      loadFaculties()
    } catch (error: any) {
      console.error("Error adding faculty:", error)
      toast.error(error.message || "Failed to add faculty member")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteFaculty = async (facultyId: string, email: string) => {
    try {
      // Delete faculty record
      const { error } = await supabase
        .from("faculty")
        .delete()
        .eq("id", facultyId)

      if (error) throw error

      toast.success(`Faculty member ${email} deleted`)
      loadFaculties()
    } catch (error) {
      console.error("Error deleting faculty:", error)
      toast.error("Failed to delete faculty member")
    }
  }

  const filteredFaculties = filterDepartment && filterDepartment !== "all"
    ? faculties.filter(f => f.department === filterDepartment)
    : faculties

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Faculty Management
              </h2>
              <p className="text-muted-foreground">
                Add and manage faculty members across departments
              </p>
            </div>
          </div>
          
          {/* Add Faculty Button */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <UserPlus className="h-5 w-5" />
                Add Faculty
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Add New Faculty Member
                </DialogTitle>
                <DialogDescription>
                  Create a new faculty account with department assignment
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleAddFaculty} className="space-y-4 mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="Juan"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Dela Cruz"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="faculty@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select value={department} onValueChange={setDepartment} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Adding..." : "Add Faculty"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* Faculty List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Faculty Members</CardTitle>
              <CardDescription>
                {filteredFaculties.length} {filterDepartment && filterDepartment !== "all" ? `in ${filterDepartment}` : "total faculty members"}
              </CardDescription>
            </div>
            <div className="w-[300px]">
              <Select 
                value={filterDepartment} 
                onValueChange={setFilterDepartment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredFaculties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No faculty members found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFaculties.map((faculty) => (
                    <TableRow key={faculty.id}>
                      <TableCell className="font-medium">
                        {faculty.first_name} {faculty.last_name}
                      </TableCell>
                      <TableCell>{faculty.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {faculty.department}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(faculty.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Faculty Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {faculty.email}? This will also delete all their research entries. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteFaculty(faculty.id, faculty.email)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        {DEPARTMENTS.map((dept) => {
          const count = faculties.filter(f => f.department === dept).length
          return (
            <Card key={dept}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{dept}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Faculty members
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

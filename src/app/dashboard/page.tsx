"use client"

import { useEffect, useState } from "react"
import { getCurrentFaculty, type Faculty } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { Research } from "@/types/research"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { toast } from "sonner"

// Color palette for charts
const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#FF7C7C",
  "#8DD1E1",
  "#D084D0",
  "#FFB347",
  "#87CEEB",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B88B",
]

export default function DashboardPage() {
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [researches, setResearches] = useState<Research[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalResearches: 0,
    researchesByYear: [] as { year: number; count: number }[],
    researchesByCourse: [] as { course: string; count: number }[],
  })

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Load faculty data
        const facultyData = await getCurrentFaculty()
        if (!facultyData) {
          toast.error("Not authenticated")
          return
        }
        setFaculty(facultyData)

        // Fetch researches
        const { data, error } = await supabase
          .from("researches")
          .select("*")
          .eq("faculty_id", facultyData.id)
          .order("year", { ascending: false })
          .order("created_at", { ascending: false })

        if (error) throw error

        const researchesData = (data || []) as Research[]
        setResearches(researchesData)

        // Calculate statistics
        const totalResearches = researchesData.length

        // Group by year
        const yearMap = new Map<number, number>()
        researchesData.forEach((research) => {
          const count = yearMap.get(research.year) || 0
          yearMap.set(research.year, count + 1)
        })
        const researchesByYear = Array.from(yearMap.entries())
          .map(([year, count]) => ({ year, count }))
          .sort((a, b) => a.year - b.year)

        // Group by course
        const courseMap = new Map<string, number>()
        researchesData.forEach((research) => {
          const count = courseMap.get(research.course) || 0
          courseMap.set(research.course, count + 1)
        })
        const researchesByCourse = Array.from(courseMap.entries())
          .map(([course, count]) => ({ course, count }))
          .sort((a, b) => b.count - a.count)

        setStats({
          totalResearches,
          researchesByYear,
          researchesByCourse,
        })
      } catch (error) {
        console.error("Error loading dashboard data:", error)
        toast.error("Failed to load dashboard data")
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Get recent submissions (last 5)
  const recentSubmissions = researches.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <section className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {faculty?.first_name}
        </h2>
        <p className="text-muted-foreground">
          Here&apos;s a detailed overview of your research submissions and
          statistics
        </p>
      </section>

      {/* Stats Cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Researches
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalResearches}</div>
            <p className="text-xs text-muted-foreground">
              All time research submissions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Years Covered
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.researchesByYear.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Different years with research
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Courses Covered
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.researchesByCourse.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Different courses covered
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Charts Section */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Research per Year Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Research per Year</CardTitle>
            <CardDescription>
              Total number of researches submitted per year
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.researchesByYear.length > 0 ? (
              <>
                <div className="mb-4 space-y-2">
                  {stats.researchesByYear.map((item) => (
                    <div
                      key={item.year}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                    >
                      <span className="font-medium">{item.year}</span>
                      <span className="text-lg font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.researchesByYear}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Year",
                        position: "insideBottom",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Count",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#0088FE" name="Researches" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No research data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Research per Course Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Research per Course</CardTitle>
            <CardDescription>
              Distribution of researches across different courses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.researchesByCourse.length > 0 ? (
              <>
                <div className="mb-4 space-y-2 max-h-[200px] overflow-y-auto">
                  {stats.researchesByCourse.map((item, index) => (
                    <div
                      key={item.course}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                    >
                      <span className="text-sm font-medium truncate flex-1 mr-2">
                        {item.course}
                      </span>
                      <span className="text-lg font-bold shrink-0">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.researchesByCourse}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ count }) => `${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="course"
                    >
                      {stats.researchesByCourse.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${value} researches`,
                        name,
                      ]}
                    />
                    <Legend
                      formatter={(value: string) =>
                        value.length > 30 ? `${value.substring(0, 30)}...` : value
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No research data available
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent Submissions */}
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Submissions</CardTitle>
            <CardDescription>
              Your latest research concept submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentSubmissions.length > 0 ? (
              <div className="space-y-4">
                {recentSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">{submission.title}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-sm text-muted-foreground">
                          Course: {submission.course}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Year: {submission.year}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Submitted:{" "}
                          {new Date(submission.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent submissions
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
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
    recentResearches: 0,
    thisYearResearches: 0,
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

        // Fetch ALL researches (not just this faculty's)
        const { data, error } = await supabase
          .from("researches")
          .select("*")
          .order("year", { ascending: false })
          .order("created_at", { ascending: false })

        if (error) throw error

        const researchesData = (data || []) as Research[]
        setResearches(researchesData)

        // Calculate statistics
        const totalResearches = researchesData.length
        const currentYear = new Date().getFullYear()
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // Recent researches (last 30 days)
        const recentResearches = researchesData.filter((r) => 
          new Date(r.created_at) >= thirtyDaysAgo
        ).length

        // This year's researches
        const thisYearResearches = researchesData.filter(
          (r) => r.year === currentYear
        ).length

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
          recentResearches,
          thisYearResearches,
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
      <section className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">
          Dashboard Overview
        </h2>
        <p className="text-muted-foreground">
          Welcome back, <span className="font-medium text-foreground">{faculty?.first_name} {faculty?.last_name}</span> • {faculty?.department}
        </p>
      </section>

      {/* Key Metrics - Stats Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Researches
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-blue-600 dark:text-blue-400"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalResearches}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time submissions
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This Year
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-600 dark:text-green-400"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.thisYearResearches}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date().getFullYear()} submissions
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Activity
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-purple-600 dark:text-purple-400"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {stats.recentResearches}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Courses
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-orange-600 dark:text-orange-400"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {stats.researchesByCourse.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Courses covered
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Analytics Section */}
      <section className="grid gap-4 lg:grid-cols-7">
        {/* Research Trends - Takes more space */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-xl">Research Trends</CardTitle>
            <CardDescription>
              Year-over-year research submission trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.researchesByYear.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={stats.researchesByYear}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
                      value: "Researches",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#0088FE" 
                    name="Researches"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mb-4 opacity-20"
                >
                  <line x1="12" x2="12" y1="20" y2="10" />
                  <line x1="18" x2="18" y1="20" y2="4" />
                  <line x1="6" x2="6" y1="20" y2="16" />
                </svg>
                <p className="text-sm">No research data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Course Distribution - Sidebar */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-xl">Course Distribution</CardTitle>
            <CardDescription>
              Top courses by research count
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.researchesByCourse.length > 0 ? (
              <div className="space-y-3">
                {stats.researchesByCourse.slice(0, 8).map((item, index) => {
                  const maxCount = Math.max(...stats.researchesByCourse.map(c => c.count))
                  const percentage = (item.count / maxCount) * 100
                  return (
                    <div key={item.course} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate flex-1 mr-2">
                          {item.course}
                        </span>
                        <span className="font-bold text-lg" style={{ color: COLORS[index % COLORS.length] }}>
                          {item.count}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
                {stats.researchesByCourse.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{stats.researchesByCourse.length - 8} more courses
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mb-4 opacity-20"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
                <p className="text-sm">No course data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick Stats Summary */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Most Active Year</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.researchesByYear.length > 0 ? (
              <>
                <div className="text-2xl font-bold">
                  {stats.researchesByYear.reduce((max, item) => 
                    item.count > max.count ? item : max
                  ).year}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.researchesByYear.reduce((max, item) => 
                    item.count > max.count ? item : max
                  ).count} researches submitted
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Top Course</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.researchesByCourse.length > 0 ? (
              <>
                <div className="text-lg font-bold truncate">
                  {stats.researchesByCourse[0].course}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.researchesByCourse[0].count} researches
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Average per Year</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.researchesByYear.length > 0 ? (
              <>
                <div className="text-2xl font-bold">
                  {(stats.totalResearches / stats.researchesByYear.length).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Researches per year
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
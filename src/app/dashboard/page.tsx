"use client"

import { useEffect, useState } from "react"
import { getCurrentFaculty, type Faculty } from "@/lib/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function DashboardPage() {
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    pendingReview: 0,
    approved: 0,
  })

  useEffect(() => {
    const loadDashboardData = async () => {
      // Load faculty data
      const facultyData = await getCurrentFaculty()
      setFaculty(facultyData)

      // TODO: Load actual submission data from Supabase
      // This is placeholder data
      setStats({
        totalSubmissions: 5,
        pendingReview: 2,
        approved: 3,
      })

      setRecentSubmissions([
        {
          id: 1,
          title: "AI-Based Learning Systems",
          status: "Approved",
          submittedAt: "2025-10-24",
        },
        {
          id: 2,
          title: "Machine Learning in Education",
          status: "Pending",
          submittedAt: "2025-10-23",
        },
      ])
    }

    loadDashboardData()
  }, [])

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <section className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {faculty?.first_name}
        </h2>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your research submissions and recent activity
        </p>
      </section>

      {/* Stats Cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubmissions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingReview}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
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
            <div className="space-y-4">
              {recentSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium">{submission.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Submitted on {submission.submittedAt}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        submission.status === "Approved"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {submission.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
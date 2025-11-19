"use client"

import { useEffect, useState } from "react"
import { getCurrentFaculty, type Faculty } from "@/lib/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth"
import { toast } from "sonner"
import { usePathname, useRouter } from "next/navigation"
import { useMobile } from "@/hooks/use-mobile"


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useMobile()
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const facultyData = await getCurrentFaculty()
      if (!facultyData) {
        router.push("/")
      } else {
        setFaculty(facultyData)
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    if (isMobile) {
      setIsSidebarCollapsed(true)
    }
  }, [pathname, isMobile])

  const handleSignOut = async () => {
    try {
      setIsLoading(true)
      await signOut()
      toast.success("Signed out successfully")
      window.location.href = "/" // Using window.location instead of redirect for full page refresh
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error("Error signing out. Please try again.")
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="flex items-center">
          <div className={`transition-all duration-300 py-4 ${isSidebarCollapsed ? "md:px-2" : "px-4"}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="shrink-0"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
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
                className={`transform transition-transform duration-200 ${
                  isSidebarCollapsed ? "rotate-180" : ""
                }`}
              >
                <path d="M21 18H3M21 12H3M21 6H3"/>
              </svg>
            </Button>
          </div>
          <div className="flex-1 container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">
              Research Similarity Detection System
            </h1>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Sidebar and Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <aside 
          className={`fixed md:static left-0 top-[65px] h-[calc(100vh-65px)] bg-background border-r transition-all duration-300 ease-in-out ${
            isSidebarCollapsed ? "w-0 md:w-16 -translate-x-full md:translate-x-0" : "w-64"
          }`}
        >
          <nav className={`p-4 space-y-2 ${isSidebarCollapsed ? "md:px-2" : ""}`}>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${isSidebarCollapsed ? "md:justify-center" : ""}`} 
              asChild
            >
              <Link href="/dashboard" className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
                </svg>
                <span className={isSidebarCollapsed ? "md:hidden" : ""}>Dashboard</span>
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${isSidebarCollapsed ? "md:justify-center" : ""}`} 
              asChild
            >
              <Link href="/dashboard/researches" className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                <span className={isSidebarCollapsed ? "md:hidden" : ""}>Researches</span>
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${isSidebarCollapsed ? "md:justify-center" : ""}`} 
              asChild
            >
              <Link href="/dashboard/admin" className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span className={isSidebarCollapsed ? "md:hidden" : ""}>Admin</span>
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${isSidebarCollapsed ? "md:justify-center" : ""}`} 
              asChild
            >
              <Link href="/dashboard/settings" className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span className={isSidebarCollapsed ? "md:hidden" : ""}>Settings</span>
              </Link>
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 p-6 transition-all duration-300 ${isSidebarCollapsed ? "md:ml-16" : "md:ml-0"}`}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
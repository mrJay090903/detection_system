import { Button } from "@/components/ui/button";
import Image from "next/image";
import LiquidEther from "@/components/ui/LiquidEther";
import { LoginForm } from "@/components/ui/login-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Background Effect */}
      <div className="absolute inset-0 -z-10">
        <LiquidEther
          mouseForce={15}
          cursorSize={80}
          colors={['#1e40af', '#3b82f6', '#93c5fd']}
          autoDemo={true}
          className="w-full h-full"
        />
      </div>

      {/* Header */}
      <header className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image 
              src="/file.svg" 
              alt="Logo" 
              width={32} 
              height={32} 
            />
            <h1 className="text-xl font-bold">Research Concept Detection</h1>
          </div>
          <LoginForm />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-32 pb-16">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Research Concept Similarity Detection
            </h1>
            <p className="text-lg text-muted-foreground">
              Detect similarities between research concepts to ensure originality and avoid duplication
            </p>
          </div>

          {/* Input Form */}
          <div className="space-y-6 p-6 bg-card rounded-lg shadow-lg border">
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-2">
                  Proposed Research Title
                </label>
                <input
                  type="text"
                  id="title"
                  placeholder="Enter your research title"
                  className="w-full px-4 py-2 rounded-md border bg-background"
                />
              </div>

              <div>
                <label htmlFor="concept" className="block text-sm font-medium mb-2">
                  Research Concept
                </label>
                <textarea
                  id="concept"
                  rows={6}
                  placeholder="Describe your research concept..."
                  className="w-full px-4 py-2 rounded-md border bg-background resize-none"
                />
              </div>

              <Button className="w-full">
                Check Similarity
              </Button>
            </div>
          </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">Instant Analysis</h3>
              <p className="text-sm text-muted-foreground">Get immediate results on concept similarity</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">Advanced Detection</h3>
              <p className="text-sm text-muted-foreground">Using sophisticated algorithms for accuracy</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2">Detailed Reports</h3>
              <p className="text-sm text-muted-foreground">Comprehensive similarity analysis reports</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function TestGeminiPage() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)

  const testGeminiConnection = async () => {
    setTesting(true)
    setResult(null)

    try {
      const response = await fetch('/api/test-gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to connect to test endpoint',
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gemini API Connection Test</h1>
          <p className="text-muted-foreground mt-2">
            Test the connection to Google Gemini API using Python backend
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Connection Status</CardTitle>
            <CardDescription>
              Click the button below to test if the Gemini API is properly configured and accessible
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={testGeminiConnection}
              disabled={testing}
              className="w-full"
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {testing ? 'Testing Connection...' : 'Test Gemini API Connection'}
            </Button>

            {result && (
              <Alert variant={result.success ? 'default' : 'destructive'}>
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  <div className="flex-1 space-y-2">
                    <AlertTitle className="text-lg">
                      {result.success ? 'Success!' : 'Connection Failed'}
                    </AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>{result.message}</p>
                      
                      {result.details && (
                        <div className="mt-4">
                          <p className="font-semibold mb-2">Details:</p>
                          {typeof result.details === 'string' ? (
                            <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                              {result.details}
                            </pre>
                          ) : (
                            <>
                              {result.details.model && (
                                <p className="text-sm">
                                  <span className="font-medium">Model:</span> {result.details.model}
                                </p>
                              )}
                              {result.details.response && (
                                <div className="mt-2">
                                  <p className="font-medium text-sm mb-1">Sample Response:</p>
                                  <Textarea
                                    value={result.details.response}
                                    readOnly
                                    className="min-h-[200px] font-mono text-xs"
                                  />
                                </div>
                              )}
                              {result.details.error && (
                                <pre className="bg-destructive/10 p-3 rounded text-xs overflow-auto mt-2">
                                  {result.details.error}
                                </pre>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1">✓</span>
                <span>GEMINI_API_KEY is set in .env file</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">✓</span>
                <span>Python script exists at /workspaces/detection_system/scripts/gemini_api.py</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">✓</span>
                <span>google-genai package is installed (pip)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">✓</span>
                <span>python-dotenv package is installed (pip)</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, Key, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function HighwayApiSettingsClient() {
  const [apiKey, setApiKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key first");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Test the API key by making a request
      const response = await fetch("/api/admin/test-highway-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: "API key is valid and working!",
          details: data,
        });
        toast.success("API key test successful!");
      } else {
        setTestResult({
          success: false,
          message: data.error || "API key test failed",
          details: data,
        });
        toast.error("API key test failed");
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || "Failed to test API key",
      });
      toast.error("Error testing API key");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key first");
      return;
    }

    try {
      const response = await fetch("/api/admin/save-highway-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      if (response.ok) {
        toast.success("API key saved! Please restart the server for changes to take effect.");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save API key");
      }
    } catch (error: any) {
      toast.error("Error saving API key");
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            How to Get Your Highway API Key
          </CardTitle>
          <CardDescription>
            Follow these steps to obtain a Highway API key from your Highway.com account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Step 1: Log into Highway Portal</h3>
            <p className="text-sm text-muted-foreground">
              Go to{" "}
              <a
                href="https://staging.highway.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                staging.highway.com
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              and log in with your credentials.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Step 2: Find API Key Settings</h3>
            <p className="text-sm text-muted-foreground">
              Look for one of these sections in the Highway portal:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-4">
              <li>Settings → API Keys</li>
              <li>Developer → API Access</li>
              <li>Integrations → API Keys</li>
              <li>Account → API Settings</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Step 3: Generate or Copy API Key</h3>
            <p className="text-sm text-muted-foreground">
              If you see an existing API key, copy it. If not, click "Generate New API Key" or
              "Create API Key". Make sure it's for the <strong>staging</strong> environment.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Step 4: Check Permissions</h3>
            <p className="text-sm text-muted-foreground">
              Ensure the API key has permissions to access:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-4">
              <li>Carrier data endpoints</li>
              <li>Carrier health/safety data</li>
              <li>External API access</li>
            </ul>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Can't Find API Key Settings?</AlertTitle>
            <AlertDescription>
              Contact Highway support at{" "}
              <a
                href="mailto:implementations@highway.com"
                className="text-primary hover:underline"
              >
                implementations@highway.com
              </a>{" "}
              and ask them to:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Generate a new staging API key for you</li>
                <li>Check if your account has API access enabled</li>
                <li>Whitelist your server's IP address if needed</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* API Key Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>API Key Configuration</CardTitle>
          <CardDescription>
            Enter your Highway API key below. Make sure it's for the staging environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Highway API Key (Staging)</Label>
            <Textarea
              id="apiKey"
              placeholder="Paste your Highway API key here (JWT token)..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The API key should be a JWT token starting with "eyJ". Remove any spaces or
              line breaks.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleTestKey} disabled={isTesting || !apiKey.trim()}>
              {isTesting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Test Key
                </>
              )}
            </Button>
            <Button onClick={handleSaveKey} variant="outline" disabled={!apiKey.trim()}>
              Save to .env.local
            </Button>
          </div>

          {testResult && (
            <Alert className={testResult.success ? "border-green-500" : "border-red-500"}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertTitle>{testResult.success ? "Success" : "Failed"}</AlertTitle>
              <AlertDescription>
                {testResult.message}
                {testResult.details && (
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(testResult.details, null, 2)}
                  </pre>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Current Key Status */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
          <CardDescription>Status of your current Highway API setup</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={async () => {
              const response = await fetch("/api/admin/debug-highway-key");
              const data = await response.json();
              toast.info("Check console for details", {
                description: `Key Length: ${data.keyLength} chars`,
              });
              console.log("Current Highway API Key Status:", data);
            }}
          >
            Check Current Key Status
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


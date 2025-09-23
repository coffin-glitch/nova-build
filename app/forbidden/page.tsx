import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Home, ArrowLeft, AlertTriangle } from "lucide-react";

export default function Forbidden() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="card-premium p-8 text-center max-w-md">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold color: hsl(var(--foreground))">Access Denied</h1>
              <p className="text-muted-foreground mt-2">
                You don't have permission to access this page.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-medium text-red-500">403 Forbidden</p>
                <p className="text-sm text-red-400">
                  This page requires specific permissions that your account doesn't have.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact an administrator or try the following:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 text-left">
              <li>• Check if you're signed in with the correct account</li>
              <li>• Verify your account has the required role permissions</li>
              <li>• Contact support if you need access to this page</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="btn-primary">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="javascript:history.back()">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Link>
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Need help? Contact support at{" "}
              <a href="mailto:support@novabuild.com" className="text-primary hover:underline">
                support@novabuild.com
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

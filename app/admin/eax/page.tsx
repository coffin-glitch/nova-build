import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EaxAdminPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold color: hsl(var(--foreground))">EAX Updater</h1>
        <p className="text-muted-foreground">
          Import the latest EAX export (Excel/CSV). We normalize columns and upsert to the database.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* File Upload Card */}
        <Card className="card-premium p-6 hover-lift">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold color: hsl(var(--foreground))">Import from Excel/CSV</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload an Excel or CSV file exported from EAX. The system will automatically normalize columns and upsert data.
            </p>
            
            <form action="/api/admin/eax/import" method="post" encType="multipart/form-data" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file" className="text-sm font-medium">Choose File</Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="input-premium"
                  required
                />
              </div>
              <Button type="submit" className="w-full btn-primary">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Import Data
              </Button>
            </form>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Supports .xlsx, .xls, and .csv files</p>
              <p>• Automatically maps common column names</p>
              <p>• Validates and normalizes data before import</p>
            </div>
          </div>
        </Card>

        {/* Interactive Search Card */}
        <Card className="card-premium p-6 hover-lift">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold color: hsl(var(--foreground))">Interactive Search</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Open the EAX portal in a persistent Chromium profile for manual login and export.
            </p>
            
            <div className="bg-muted/30 p-3 rounded-md text-sm font-mono text-muted-foreground">
              <p className="mb-2">Run in your terminal:</p>
              <code className="block select-all">npm run ingest:interactive</code>
            </div>

            <Button
              className="w-full"
              variant="outline"
              onClick={() => alert("Please run 'npm run ingest:interactive' in your terminal to open Chromium.")}
            >
              Show Instructions
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Opens EAX portal in Chromium</p>
              <p>• Maintains login session</p>
              <p>• Allows manual data export</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Import Results Placeholder */}
      <Card className="card-premium p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold color: hsl(var(--foreground))">Import Results</h3>
          <div className="text-sm text-muted-foreground">
            Upload a file to see import results here. The system will show:
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Inserted</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-blue-500" />
              <span>Updated</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span>Skipped</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>Invalid</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Play, 
  Upload, 
  FileSpreadsheet, 
  Terminal,
  Database,
  AlertCircle
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";

export default async function EaxUpdater() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold color: hsl(var(--foreground))">EAX Updater</h1>
        <p className="text-muted-foreground">
          Update load data from EAX system using interactive search or Excel upload.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Interactive Search Card */}
        <Card className="card-premium p-6 hover-lift">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Play className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold color: hsl(var(--foreground))">Interactive Search</h2>
                <p className="text-sm text-muted-foreground">Use Playwright automation</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <Terminal className="w-5 h-5 text-primary mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium color: hsl(var(--foreground))">Instructions:</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open a terminal in the project root</li>
                    <li>Run: <code className="bg-muted px-2 py-1 rounded text-xs">npm run ingest:interactive</code></li>
                    <li>Follow the interactive prompts</li>
                    <li>Data will be automatically processed and saved</li>
                  </ol>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-500">Note</p>
                  <p className="text-sm text-blue-400">
                    This will open a browser window and guide you through the EAX login and search process.
                  </p>
                </div>
              </div>
            </div>
            
            <Button 
              className="w-full btn-primary"
              onClick={() => {
                // This would ideally open a terminal or show instructions
                alert("Please run 'npm run ingest:interactive' in your terminal");
              }}
            >
              <Play className="w-4 h-4 mr-2" />
              Open Interactive Search
            </Button>
          </div>
        </Card>

        {/* Excel Upload Card */}
        <Card className="card-premium p-6 hover-lift">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Upload className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold color: hsl(var(--foreground))">Upload EAX Excel</h2>
                <p className="text-sm text-muted-foreground">Direct file upload</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-primary mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium color: hsl(var(--foreground))">Supported Format:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Excel files (.xlsx)</li>
                    <li>EAX export format</li>
                    <li>Load data with rates and details</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <Database className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-500">Processing</p>
                  <p className="text-sm text-green-400">
                    Data will be parsed and merged into the loads table automatically.
                  </p>
                </div>
              </div>
            </div>
            
            <form action="/api/admin/eax/upload" method="post" encType="multipart/form-data" className="space-y-4">
              <div>
                <Label htmlFor="excel-file" className="text-sm font-medium text-muted-foreground">
                  Select Excel File
                </Label>
                <Input
                  id="excel-file"
                  name="file"
                  type="file"
                  accept=".xlsx,.xls"
                  required
                  className="mt-1 input-premium"
                />
              </div>
              
              <Button type="submit" className="w-full btn-primary">
                <Upload className="w-4 h-4 mr-2" />
                Upload & Process
              </Button>
            </form>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="card-premium p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold color: hsl(var(--foreground))">Recent Updates</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm color: hsl(var(--foreground))">System ready for updates</span>
              </div>
              <span className="text-xs text-muted-foreground">Just now</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm color: hsl(var(--foreground))">EAX integration active</span>
              </div>
              <span className="text-xs text-muted-foreground">2 minutes ago</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

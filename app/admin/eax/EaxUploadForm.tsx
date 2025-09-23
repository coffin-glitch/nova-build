"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface UploadResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export function EaxUploadForm() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/eax/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast.success(`Successfully processed ${data.inserted + data.updated} loads`);
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="file" className="text-sm font-medium text-muted-foreground">
          Select File
        </Label>
        <Input
          id="file"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="mt-1 input-premium file:text-primary file:bg-primary/10 file:border-primary/30 file:hover:bg-primary/20"
        />
      </div>

      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          Processing file...
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium color: hsl(var(--foreground))">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Upload Complete
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-center">
              <div className="font-semibold text-green-500">{result.inserted}</div>
              <div className="text-xs text-green-400">Inserted</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-center">
              <div className="font-semibold text-blue-500">{result.updated}</div>
              <div className="text-xs text-blue-400">Updated</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2 text-center">
              <div className="font-semibold text-orange-500">{result.skipped}</div>
              <div className="text-xs text-orange-400">Skipped</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-red-500">
                <AlertCircle className="w-4 h-4" />
                Errors ({result.errors.length})
              </div>
              <div className="max-h-20 overflow-y-auto text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                {result.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import useSWR from "swr";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Row = {
  rr_number: string;
  published: boolean;
  equipment: string | null;
  total_miles: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  updated_at: string;
};

export default function ManageLoadsClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { mutate } = useSWR("/admin/manage-loads", { fallbackData: initialRows });

  async function toggle(rr: string, next: boolean) {
    const prev = rows.slice();
    setRows(r => r.map(x => x.rr_number === rr ? { ...x, published: next } : x));
    try {
      const res = await fetch(`/api/admin/loads/${encodeURIComponent(rr)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`RR ${rr} ${next ? "published" : "unpublished"}`);
      mutate();
    } catch (e: any) {
      toast.error(`Failed: ${e?.message || "error"}`);
      setRows(prev); // rollback
    }
  }

  async function handleFileUpload() {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/admin/uploads/eax-xlsx", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.ok) {
        toast.success(`Successfully processed ${result.data.rows_processed} loads from Excel file`);
        setSelectedFile(null);
        setIsUploadDialogOpen(false);
        mutate(); // Refresh the data
      } else {
        toast.error(result.error || "Failed to upload Excel file");
      }
    } catch (error) {
      toast.error("Failed to upload Excel file");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="flex justify-end">
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Upload className="w-4 h-4 mr-2" />
              Upload EAX Excel
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Upload EAX Excel File
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Excel File (.xlsx, .xls)
                </label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full"
                />
                {selectedFile && (
                  <p className="text-sm text-gray-600 mt-2">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Excel Format Requirements:</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• First row should contain column headers</li>
                      <li>• Include columns: RR#, Origin, Destination, Equipment, Miles, etc.</li>
                      <li>• Loads will be imported as unpublished by default</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setSelectedFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isUploading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isUploading ? "Uploading..." : "Upload & Process"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loads Table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-gray-600">
              <th>RR#</th><th>Route</th><th>Dates</th><th>Eqp</th><th>Mi</th><th>Published</th>
            </tr>
          </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.rr_number} className="border-b last:border-0 [&>td]:px-4 [&>td]:py-3">
              <td className="font-mono">{r.rr_number}</td>
              <td>{r.origin_city}, {r.origin_state} → {r.destination_city}, {r.destination_state}</td>
              <td>{r.pickup_date || "—"} → {r.delivery_date || "—"}</td>
              <td>{r.equipment || "—"}</td>
              <td>{r.total_miles ?? "—"}</td>
              <td>
                <Button variant={r.published ? "secondary" : "default"} onClick={()=>toggle(r.rr_number, !r.published)}>
                  {r.published ? "Unpublish" : "Publish"}
                </Button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="text-center text-gray-500 py-10">No loads.</td></tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}

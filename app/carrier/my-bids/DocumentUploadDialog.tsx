"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { File, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface DocumentUploadDialogProps {
  bidNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export function DocumentUploadDialog({
  bidNumber,
  isOpen,
  onClose,
  onUploaded
}: DocumentUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only JPEG, PNG, and PDF files are allowed");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !documentType) {
      toast.error("Please select a file and document type");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("documentType", documentType);
      if (notes) {
        formData.append("notes", notes);
      }

      const response = await fetch(`/api/carrier/bids/${bidNumber}/documents`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Document uploaded successfully!");
        setSelectedFile(null);
        setDocumentType("");
        setNotes("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        onUploaded();
        onClose();
      } else {
        toast.error(result.error || "Failed to upload document");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setSelectedFile(null);
      setDocumentType("");
      setNotes("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Submit Documents for Bid #{bidNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Document Type */}
          <div className="space-y-2">
            <Label>Document Type *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cdl">CDL (Commercial Driver's License)</SelectItem>
                <SelectItem value="bol">BOL (Bill of Lading)</SelectItem>
                <SelectItem value="pod">POD (Proof of Delivery)</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>File *</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                disabled={uploading}
                className="flex-1"
              />
              {selectedFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <File className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm flex-1">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Accepted formats: PDF, JPEG, PNG (Max 10MB)
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes about this document..."
              disabled={uploading}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || !documentType || uploading}>
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



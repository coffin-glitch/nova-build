"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, File, Image, FileText, Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface Document {
  id: string;
  bid_number: string;
  carrier_user_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  notes: string | null;
  carrier_name?: string;
  carrier_company_name?: string;
  carrier_mc_number?: string;
}

interface DocumentViewerDialogProps {
  bidNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

const documentTypeLabels: Record<string, string> = {
  cdl: "CDL",
  bol: "Bill of Lading",
  pod: "Proof of Delivery",
  invoice: "Invoice",
  other: "Other"
};

export function DocumentViewerDialog({
  bidNumber,
  isOpen,
  onClose
}: DocumentViewerDialogProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && bidNumber) {
      fetchDocuments();
    }
  }, [isOpen, bidNumber]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/bids/${bidNumber}/documents`);
      const result = await response.json();

      if (result.success) {
        setDocuments(result.data || []);
      } else {
        toast.error(result.error || "Failed to fetch documents");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      // For Supabase Storage URLs, we may need to handle CORS
      const response = await fetch(doc.file_url, {
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("File downloaded successfully");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <File className="w-5 h-5" />
              Documents for Bid #{bidNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <File className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No documents submitted yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-muted rounded-lg">
                          {getFileIcon(doc.mime_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold truncate">{doc.file_name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {documentTypeLabels[doc.document_type] || doc.document_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span>{formatFileSize(doc.file_size)}</span>
                            <span>•</span>
                            <span>
                              Uploaded: {new Date(doc.uploaded_at).toLocaleString()}
                            </span>
                            {doc.carrier_name && (
                              <>
                                <span>•</span>
                                <span>{doc.carrier_name || doc.carrier_company_name}</span>
                              </>
                            )}
                          </div>
                          {doc.notes && (
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Notes:</strong> {doc.notes}
                            </p>
                          )}
                          {doc.mime_type?.startsWith('image/') && (
                            <div className="mt-2">
                              <img
                                src={doc.file_url}
                                alt={doc.file_name}
                                className="max-w-full max-h-64 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setViewingImage(doc.file_url)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        {doc.mime_type?.startsWith('image/') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingImage(doc.file_url)}
                          >
                            <Image className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        )}
                        {doc.mime_type?.includes('pdf') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(doc.file_url, '_blank')}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Open
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/10 dark:bg-black/50 p-4">
              <img
                src={viewingImage}
                alt="Document preview"
                className="max-w-full max-h-full object-contain rounded-md"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setViewingImage(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = viewingImage;
                  a.download = 'document';
                  a.click();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}


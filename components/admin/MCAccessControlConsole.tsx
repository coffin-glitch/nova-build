"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  Shield,
  X,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface MCAccessControl {
  id: string;
  mc_number: string;
  is_active: boolean;
  disabled_reason: string | null;
  disabled_by: string | null;
  disabled_at: string | null;
  enabled_by: string | null;
  enabled_at: string | null;
  carrier_count?: number;
}

interface MCAccessControlConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  initialMcNumber?: string;
}

export function MCAccessControlConsole({
  isOpen,
  onClose,
  initialMcNumber,
}: MCAccessControlConsoleProps) {
  const [mcControls, setMcControls] = useState<MCAccessControl[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingMc, setUpdatingMc] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMCAccessControls();
      if (initialMcNumber) {
        setSearchQuery(initialMcNumber);
      }
    }
  }, [isOpen, initialMcNumber]);

  const loadMCAccessControls = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/mc-access-control");
      const data = await response.json();

      if (data.ok) {
        setMcControls(data.data || []);
      } else {
        toast.error("Failed to load MC access controls");
      }
    } catch (error) {
      console.error("Error loading MC access controls:", error);
      toast.error("Failed to load MC access controls");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMCAccess = async (mcNumber: string, currentState: boolean) => {
    setUpdatingMc(mcNumber);
    try {
      const response = await fetch("/api/admin/mc-access-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mc_number: mcNumber,
          is_active: !currentState,
          disabled_reason: !currentState ? null : "DNU by USPS",
        }),
      });

      const data = await response.json();

      if (data.ok) {
        toast.success(
          `MC ${mcNumber} ${!currentState ? "enabled" : "disabled"} successfully`
        );
        await loadMCAccessControls();
      } else {
        toast.error(data.error || "Failed to update MC access");
      }
    } catch (error) {
      console.error("Error updating MC access:", error);
      toast.error("Failed to update MC access");
    } finally {
      setUpdatingMc(null);
    }
  };

  const filteredControls = mcControls.filter((control) =>
    control.mc_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by active/inactive
  const activeControls = filteredControls.filter((c) => c.is_active);
  const inactiveControls = filteredControls.filter((c) => !c.is_active);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Shield className="h-6 w-6" />
            Main Control - MC Access Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by MC number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Info Banner */}
          <Glass className="p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">MC Access Control</p>
                <p className="text-muted-foreground">
                  Toggle MC numbers to enable/disable access. When disabled (red), all carriers
                  with that MC will be automatically set to "Declined" status and lose access to
                  site functions. New signups with disabled MCs will be blocked.
                </p>
              </div>
            </div>
          </Glass>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              {/* Active MCs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">Active MCs (Blue)</h3>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                    {activeControls.length}
                  </Badge>
                </div>
                {activeControls.length > 0 ? (
                  <div className="space-y-2">
                    {activeControls.map((control) => (
                      <MCControlRow
                        key={control.id || control.mc_number}
                        control={control}
                        onToggle={toggleMCAccess}
                        isUpdating={updatingMc === control.mc_number}
                      />
                    ))}
                  </div>
                ) : (
                  <Glass className="p-4 text-center text-muted-foreground">
                    {searchQuery
                      ? "No active MCs found matching your search"
                      : "No disabled MCs - all MCs are active by default"}
                  </Glass>
                )}
              </div>

              {/* Disabled MCs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <h3 className="text-lg font-semibold">Disabled MCs (Red)</h3>
                  <Badge variant="outline" className="bg-red-500/10 text-red-500">
                    {inactiveControls.length}
                  </Badge>
                </div>
                {inactiveControls.length > 0 ? (
                  <div className="space-y-2">
                    {inactiveControls.map((control) => (
                      <MCControlRow
                        key={control.id || control.mc_number}
                        control={control}
                        onToggle={toggleMCAccess}
                        isUpdating={updatingMc === control.mc_number}
                      />
                    ))}
                  </div>
                ) : (
                  <Glass className="p-4 text-center text-muted-foreground">
                    {searchQuery
                      ? "No disabled MCs found matching your search"
                      : "No disabled MCs - all MCs are active"}
                  </Glass>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MCControlRow({
  control,
  onToggle,
  isUpdating,
}: {
  control: MCAccessControl;
  onToggle: (mcNumber: string, currentState: boolean) => void;
  isUpdating: boolean;
}) {
  const isActive = control.is_active;

  return (
    <Glass
      className={`p-4 border-2 ${
        isActive
          ? "border-blue-500/30 bg-blue-500/5"
          : "border-red-500/30 bg-red-500/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono font-semibold text-lg">MC {control.mc_number}</span>
            {control.carrier_count !== undefined && (
              <Badge variant="outline" className="text-xs">
                {control.carrier_count} carrier{control.carrier_count !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {!isActive && control.disabled_reason && (
            <p className="text-sm text-muted-foreground">
              Reason: {control.disabled_reason}
            </p>
          )}
          {!isActive && control.disabled_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Disabled: {new Date(control.disabled_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground mb-1">
              {isActive ? "Active" : "Disabled"}
            </span>
            <Switch
              checked={isActive}
              onCheckedChange={() => onToggle(control.mc_number, isActive)}
              disabled={isUpdating}
              className={isActive ? "data-[state=checked]:bg-blue-500" : ""}
            />
          </div>
        </div>
      </div>
    </Glass>
  );
}



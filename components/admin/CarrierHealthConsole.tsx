"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { extractCarrierUrl, parseOverviewData } from "@/lib/carrier-health-parser";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Edit2,
  ExternalLink,
  FileCheck,
  FileText,
  Gauge,
  Globe,
  Info,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  Truck,
  Users,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface CarrierHealthConsoleProps {
  mcNumber: string;
  carrierName?: string;
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
  existingData?: any;
}

export function CarrierHealthConsole({
  mcNumber,
  carrierName,
  isOpen,
  onClose,
  accentColor = "#3b82f6",
}: CarrierHealthConsoleProps) {
  const [step, setStep] = useState<'paste' | 'view' | 'insurance'>('paste');
  const [isLoading, setIsLoading] = useState(false);
  const [mcAccessState, setMcAccessState] = useState<{ is_active: boolean; loading: boolean }>({ is_active: true, loading: false });
  
  // Paste fields
  const [carrierUrl, setCarrierUrl] = useState('https://highway.com/broker/carriers/');
  const [insuranceHtml, setInsuranceHtml] = useState('');
  
  // Parsed data
  const [parsedData, setParsedData] = useState<any>(null);
  const [healthScore, setHealthScore] = useState<any>(null);
  
  // Load existing data if available
  useEffect(() => {
    if (isOpen && mcNumber) {
      loadExistingData();
      loadMcAccessState();
    } else if (isOpen) {
      // Reset to defaults when opening
      setCarrierUrl('https://highway.com/broker/carriers/');
      setInsuranceHtml('');
      setParsedData(null);
      setHealthScore(null);
      setLastScraped(null);
    }
  }, [isOpen, mcNumber]);

  const loadMcAccessState = async () => {
    if (!mcNumber) return;
    setMcAccessState(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetch(`/api/admin/mc-access-control?mc=${encodeURIComponent(mcNumber)}`);
      const data = await response.json();
      if (data.ok) {
        setMcAccessState({ is_active: data.data.is_active, loading: false });
      }
    } catch (error) {
      console.error('Error loading MC access state:', error);
      setMcAccessState({ is_active: true, loading: false }); // Default to active
    }
  };

  const toggleMcAccess = async () => {
    if (!mcNumber) return;
    const newState = !mcAccessState.is_active;
    setMcAccessState(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetch('/api/admin/mc-access-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mc_number: mcNumber,
          is_active: newState,
          disabled_reason: newState ? null : 'DNU by USPS',
        }),
      });
      const data = await response.json();
      if (data.ok) {
        setMcAccessState({ is_active: newState, loading: false });
        toast.success(`MC ${mcNumber} ${newState ? 'enabled' : 'disabled'} successfully`);
      } else {
        toast.error(data.error || 'Failed to update MC access');
        setMcAccessState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error toggling MC access:', error);
      toast.error('Failed to update MC access');
      setMcAccessState(prev => ({ ...prev, loading: false }));
    }
  };
  
  const [lastScraped, setLastScraped] = useState<string | null>(null);
  
  const loadExistingData = async () => {
    try {
      const response = await fetch(`/api/admin/carrier-health/get?mc=${encodeURIComponent(mcNumber)}`);
      const data = await response.json();
      
      if (data.ok && data.data) {
        setCarrierUrl(data.data.carrier_url || 'https://highway.com/broker/carriers/');
        setParsedData({
          overview: data.data.overview_data,
          directory: data.data.directory_data,
        });
        setHealthScore({
          score: data.data.health_score,
          status: data.data.health_status,
          breakdown: data.data.breakdown || null,
        });
        setLastScraped(data.data.last_updated_at || null);
        setStep('view');
      } else {
        setCarrierUrl('https://highway.com/broker/carriers/');
        setStep('paste');
      }
    } catch (error) {
      console.error('Error loading existing data:', error);
      setCarrierUrl('https://highway.com/broker/carriers/');
      setStep('paste');
    }
  };
  
  const handlePasteUrl = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const url = extractCarrierUrl(pasted) || pasted;
    setCarrierUrl(url);
  };
  
  const handleProcessInsurance = async () => {
    if (!insuranceHtml.trim()) {
      toast.error('Please paste insurance data');
      return;
    }
    
    if (!carrierUrl || carrierUrl === 'https://highway.com/broker/carriers/') {
      toast.error('Please provide a valid carrier URL');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Parse insurance data from the pasted HTML/text
      const overviewData = parseOverviewData(insuranceHtml);
      
      // Send to server for storage - this will merge with existing data
      const response = await fetch('/api/admin/carrier-health/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mcNumber,
          carrierUrl,
          overviewHtml: insuranceHtml,
          directoryHtml: '', // Empty since we're only updating insurance
        }),
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (result.ok) {
        // Reload data to get updated view
        await loadExistingData();
        setInsuranceHtml('');
        toast.success(`✅ Insurance data stored! Health score: ${result.healthScore.score}/100 (${result.healthScore.status})`);
      } else {
        toast.error('Failed to process insurance data: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      toast.error('Error processing insurance data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleOpenHighway = () => {
    window.open('https://highway.com/broker/carriers/global-search', '_blank', 'width=1200,height=800');
  };
  
  const handlePlaywrightScrape = async () => {
    if (!carrierUrl && !mcNumber) {
      toast.error('Please provide a carrier URL or MC number');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/carrier-health/playwright-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mcNumber,
          carrierUrl: carrierUrl || undefined,
        }),
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (result.ok) {
        toast.success(`✅ Auto-scraped! Health score: ${result.healthScore.score}/100 (${result.healthScore.status})`);
        // Reload data
        await loadExistingData();
      } else {
        toast.error('Failed to auto-scrape: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      toast.error('Error auto-scraping: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" style={{ color: accentColor }} />
            Carrier Health Console - MC {mcNumber}
            {carrierName && (
              <span className="text-sm font-normal text-muted-foreground">
                ({carrierName})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {step === 'paste' && (
          <div className="space-y-6">
            <Glass className="p-6">
              <div className="text-center space-y-4 mb-6">
                <div className="flex justify-center">
                  <div 
                    className="p-4 rounded-full"
                    style={{ backgroundColor: `${accentColor}15` }}
                  >
                    <Globe className="h-8 w-8" style={{ color: accentColor }} />
                  </div>
                </div>
                <h3 className="text-xl font-semibold">Add Health Data</h3>
                <p className="text-muted-foreground text-sm">
                  Choose your preferred method to add carrier health data
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    onClick={handleOpenHighway}
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Highway
                  </Button>
                  <Button
                    onClick={handlePlaywrightScrape}
                    disabled={isLoading || ((!carrierUrl || carrierUrl === 'https://highway.com/broker/carriers/') && !mcNumber)}
                    variant="default"
                    size="sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Scraping...
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4 mr-2" />
                        Auto-Scrape (Playwright)
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-2 text-center">
                  💡 Tip: Install Tampermonkey script for one-click scraping from Highway.com
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="carrier-url">Carrier URL</Label>
                  <div className="flex gap-2 mt-1">
                  <Input
                    id="carrier-url"
                    placeholder="https://highway.com/broker/carriers/154445"
                    value={carrierUrl}
                    onChange={(e) => setCarrierUrl(e.target.value)}
                    onPaste={handlePasteUrl}
                      className="font-mono text-xs flex-1"
                    />
                    <Button
                      onClick={async () => {
                        try {
                          // Copy current URL to clipboard
                          if (carrierUrl && carrierUrl !== 'https://highway.com/broker/carriers/') {
                            await navigator.clipboard.writeText(carrierUrl);
                            toast.success('Carrier link copied to clipboard!');
                          } else {
                            toast.error('No carrier link to save');
                          }
                        } catch (error) {
                          toast.error('Failed to copy link');
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      title="Copy carrier link to clipboard"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste the direct carrier link from Highway - Click save icon to copy
                  </p>
                </div>
              </div>
            </Glass>
          </div>
        )}
        
        {step === 'insurance' && (
          <div className="space-y-6">
            <Glass className="p-6">
              <div className="flex items-center justify-between mb-6">
                <Button
                  onClick={() => setStep('view')}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Back to View
                </Button>
              </div>
              
              <div className="text-center space-y-4 mb-6">
                <div className="flex justify-center">
                  <div 
                    className="p-4 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20"
                  >
                    <CreditCard className="h-8 w-8 text-green-500" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold">Update Insurance Data</h3>
                <p className="text-muted-foreground text-sm">
                  Paste insurance information from Highway.com to update carrier insurance details
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="insurance-carrier-url">Carrier URL</Label>
                  <div className="flex gap-2 mt-1">
                  <Input
                    id="insurance-carrier-url"
                    placeholder="https://highway.com/broker/carriers/154445"
                    value={carrierUrl}
                    onChange={(e) => setCarrierUrl(e.target.value)}
                    onPaste={handlePasteUrl}
                      className="font-mono text-xs flex-1"
                    />
                    <Button
                      onClick={async () => {
                        try {
                          // Copy current URL to clipboard
                          if (carrierUrl && carrierUrl !== 'https://highway.com/broker/carriers/') {
                            await navigator.clipboard.writeText(carrierUrl);
                            toast.success('Carrier link copied to clipboard!');
                          } else {
                            toast.error('No carrier link to save');
                          }
                        } catch (error) {
                          toast.error('Failed to copy link');
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      title="Copy carrier link to clipboard"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    The direct carrier link from Highway (required) - Click save icon to copy
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="insurance-html" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Insurance Information
                  </Label>
                  <Textarea
                    id="insurance-html"
                    placeholder="Paste the insurance section from Highway.com here...&#10;&#10;This should include:&#10;- General Liability&#10;- Auto Insurance&#10;- Cargo Insurance&#10;- Trailer Interchange"
                    value={insuranceHtml}
                    onChange={(e) => setInsuranceHtml(e.target.value)}
                    className="mt-1 font-mono text-xs min-h-[300px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Select and paste the insurance section from the Highway carrier page
                  </p>
                </div>
                
                <Button
                  onClick={handleProcessInsurance}
                  disabled={isLoading || !insuranceHtml.trim() || !carrierUrl || carrierUrl === 'https://highway.com/broker/carriers/'}
                  size="lg"
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Process & Store Insurance Data
                    </>
                  )}
                </Button>
              </div>
            </Glass>
          </div>
        )}
        
        {step === 'view' && parsedData && (
          <HealthDataView
            mcNumber={mcNumber}
            carrierName={carrierName}
            parsedData={parsedData}
            healthScore={healthScore}
            carrierUrl={carrierUrl}
            accentColor={accentColor}
            lastScraped={lastScraped}
            onEdit={() => setStep('insurance')}
            onRefresh={loadExistingData}
            mcAccessState={mcAccessState}
            onToggleMcAccess={toggleMcAccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function HealthDataView({
  mcNumber,
  carrierName,
  parsedData,
  healthScore,
  carrierUrl,
  accentColor,
  lastScraped,
  onEdit,
  onRefresh,
  mcAccessState,
  onToggleMcAccess,
}: {
  mcNumber: string;
  carrierName?: string;
  parsedData: any;
  healthScore: any;
  carrierUrl: string;
  accentColor: string;
  lastScraped: string | null;
  onEdit: () => void;
  onRefresh: () => void;
  mcAccessState: { is_active: boolean; loading: boolean };
  onToggleMcAccess: () => void;
}) {
  const overview = parsedData?.overview || {};
  const directory = parsedData?.directory || {};
  
  // Debug: Log insurance data structure
  useEffect(() => {
    if (overview?.insurance) {
      console.log('Insurance data structure:', JSON.stringify(overview.insurance, null, 2));
    }
    // Debug: Log safety data structure
    if (overview?.safety) {
      console.log('Safety data structure:', JSON.stringify(overview.safety, null, 2));
      console.log('Unsafe Driving:', overview.safety.unsafeDriving);
      console.log('HOS:', overview.safety.hoursOfService);
      console.log('Vehicle Maintenance:', overview.safety.vehicleMaintenance);
      console.log('Controlled Substances:', overview.safety.controlledSubstances);
      console.log('Driver Fitness:', overview.safety.driverFitness);
    }
  }, [overview]);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<any>({
    overview: { ...overview },
    directory: { ...directory },
  });
  
  // Collapsible section states - all expanded by default
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    network: true,
    authority: true,
    inspections: true,
    crashes: true,
    operations: true,
    safety: true,
    equipment: true,
    insurance: true,
    directory: true,
    breakdown: true,
  });
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Handle edit mode
  const handleStartEdit = () => {
    setEditData({
      overview: { ...overview },
      directory: { ...directory },
    });
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({
      overview: { ...overview },
      directory: { ...directory },
    });
  };
  
  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/carrier-health/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mcNumber,
          overviewData: editData.overview,
          directoryData: editData.directory,
        }),
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (result.ok) {
        toast.success('Health data updated successfully');
        setIsEditing(false);
        // Refresh data (which will reload health score with breakdown)
        onRefresh();
      } else {
        toast.error('Failed to update health data: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      toast.error('Error updating health data: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  const updateField = (path: string, value: any) => {
    setEditData((prev: any) => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };
  
  // Get current data (edit mode or view mode)
  const currentOverview = isEditing ? editData.overview : overview;
  const currentDirectory = isEditing ? editData.directory : directory;
  
  // Calculate score breakdown for info tooltip
  const getScoreBreakdown = () => {
    if (!healthScore?.breakdown) return null;
    return healthScore.breakdown;
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'good':
        return 'text-green-600 bg-green-500/10 border-green-500/20';
      case 'decent':
        return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
      case 'okay':
        return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20';
      case 'review':
        return 'text-red-600 bg-red-500/10 border-red-500/20';
      default:
        return 'text-muted-foreground bg-muted/10 border-muted/20';
    }
  };
  
  // Get operating status color
  const getOperatingStatusColor = (status?: string) => {
    if (!status) return 'text-muted-foreground';
    const s = status.toLowerCase();
    if (s.includes('active')) return 'text-green-600';
    if (s.includes('inactive')) return 'text-red-600';
    return 'text-yellow-600';
  };
  
  // Get safety rating color
  const getSafetyRatingColor = (rating?: string) => {
    if (!rating) return 'text-muted-foreground';
    const r = rating.toLowerCase();
    if (r.includes('satisfactory')) return 'text-green-600';
    if (r.includes('conditional')) return 'text-yellow-600';
    if (r.includes('unsatisfactory')) return 'text-red-600';
    if (r.includes('unrated')) return 'text-gray-600';
    return 'text-muted-foreground';
  };
  
  // Get Bluewire score color
  const getBluewireColor = (score?: number) => {
    if (!score) return 'text-muted-foreground';
    if (score > 70) return 'text-green-600';
    if (score > 65) return 'text-blue-600';
    if (score > 60) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div className="space-y-4">
      {/* Premium Health Score Card */}
      <Glass className="p-6 border-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div 
                className="p-4 rounded-2xl shadow-lg border-2"
                style={{ 
                  backgroundColor: `${accentColor}15`,
                  borderColor: `${accentColor}30`
                }}
              >
                <Shield className="h-10 w-10" style={{ color: accentColor }} />
              </div>
              <div>
                <h3 className="text-3xl font-bold mb-1">{carrierName || `MC ${mcNumber}`}</h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>MC {mcNumber}</span>
                  {currentOverview.dotNumber && <span>• DOT {currentOverview.dotNumber}</span>}
                  {currentOverview.scac && <span>• SCAC {currentOverview.scac}</span>}
                </div>
                {lastScraped && (
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Last scraped: {new Date(lastScraped).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSaveEdit} variant="default" size="sm" disabled={isSaving} style={{ backgroundColor: accentColor }}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button onClick={handleCancelEdit} variant="outline" size="sm" disabled={isSaving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleStartEdit} variant="outline" size="sm">
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Data
                  </Button>
                  <Button onClick={onEdit} variant="outline" size="sm" className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 hover:from-green-500/20 hover:to-emerald-500/20">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Update Score Card
                  </Button>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background">
                    <Label htmlFor="mc-access-toggle" className="text-xs font-medium cursor-pointer">
                      MC Access:
                    </Label>
                    {mcAccessState.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Switch
                        id="mc-access-toggle"
                        checked={mcAccessState.is_active}
                        onCheckedChange={onToggleMcAccess}
                        className={mcAccessState.is_active ? "data-[state=checked]:bg-blue-500" : ""}
                      />
                    )}
                    <span className={`text-xs font-semibold ${mcAccessState.is_active ? 'text-blue-500' : 'text-red-500'}`}>
                      {mcAccessState.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <Button onClick={onRefresh} variant="outline" size="sm">
                    Refresh
                  </Button>
                  {carrierUrl && (
                    <Button
                      onClick={() => window.open(carrierUrl, '_blank')}
                      variant="outline"
                      size="sm"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Highway
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Health Score Display */}
          {healthScore && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl border-2 border-blue-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Overall Health Score</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md p-4">
                          <div className="space-y-2">
                            <div className="font-semibold mb-2">Health Score Breakdown</div>
                            {getScoreBreakdown() ? (
                              getScoreBreakdown()!.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                  <span className="capitalize">{item.metric.replace(/_/g, ' ')}:</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{item.value}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="font-semibold">{item.score}/100</span>
                                    <span className="text-xs text-muted-foreground">({item.weight}%)</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                <div>• Bluewire Score: 40% weight</div>
                                <div>• Power Units: 20% weight</div>
                                <div>• Crashes (24 months): 20% weight</div>
                                <div>• Driver Fitness: 20% weight</div>
                              </div>
                            )}
                            <div className="pt-2 border-t text-xs text-muted-foreground">
                              Final Score: {healthScore.score}/100 ({healthScore.status})
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(healthScore.status)}`}>
                    {healthScore.status}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <div 
                    className="text-5xl font-bold"
                    style={{ color: accentColor }}
                  >
                    {healthScore.score}
                  </div>
                  <span className="text-2xl text-muted-foreground">/ 100</span>
                </div>
                {isEditing && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Note: Health score is automatically calculated based on Bluewire Score, Power Units, Crashes, and Driver Fitness
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-muted/30 rounded-xl border">
                <div className="text-sm text-muted-foreground mb-2">Bluewire Score</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireScore || ''}
                    onChange={(e) => updateField('overview.bluewireScore', parseFloat(e.target.value) || 0)}
                    className={`text-4xl font-bold h-16 ${getBluewireColor(currentOverview.bluewireScore)}`}
                  />
                ) : (
                  <div className={`text-4xl font-bold ${getBluewireColor(currentOverview.bluewireScore)}`}>
                    {currentOverview.bluewireScore ? currentOverview.bluewireScore.toFixed(1) : 'N/A'}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {currentOverview.bluewireScore && (
                    <>
                      {currentOverview.bluewireScore > 70 && 'Good'}
                      {currentOverview.bluewireScore > 65 && currentOverview.bluewireScore <= 70 && 'Decent'}
                      {currentOverview.bluewireScore > 60 && currentOverview.bluewireScore <= 65 && 'Okay'}
                      {currentOverview.bluewireScore <= 60 && 'Review'}
                    </>
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-muted/30 rounded-xl border">
                <div className="text-sm text-muted-foreground mb-2">Power Units</div>
                {isEditing ? (
                  <Input
                    type="number"
                    value={currentOverview.powerUnits || ''}
                    onChange={(e) => updateField('overview.powerUnits', parseInt(e.target.value) || 0)}
                    className="text-4xl font-bold h-16"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-4xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.powerUnits || 'N/A'}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {isEditing ? (
                    <Input
                      type="number"
                      placeholder="Trailers"
                      value={currentOverview.trailers || ''}
                      onChange={(e) => updateField('overview.trailers', parseInt(e.target.value) || 0)}
                      className="mt-2 h-8"
                    />
                  ) : (
                    currentOverview.trailers && `${currentOverview.trailers} Trailers`
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Glass>
      
      {/* Bluewire Score Breakdown */}
      {currentOverview.bluewireComponents && Object.keys(currentOverview.bluewireComponents).length > 0 && (
        <Glass className="p-6 border-2">
          <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" style={{ color: accentColor }} />
            Bluewire Score Breakdown
            {currentOverview.bluewireUpdated && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (Updated: {currentOverview.bluewireUpdated.split(/\s+(?:Privacy|©|@keyframes|\.intercom)/i)[0]})
              </span>
            )}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {currentOverview.bluewireComponents.crashes !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">Crashes</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireComponents.crashes || ''}
                    onChange={(e) => updateField('overview.bluewireComponents.crashes', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-12"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.bluewireComponents.crashes.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            )}
            {currentOverview.bluewireComponents.violations !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">Violations</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireComponents.violations || ''}
                    onChange={(e) => updateField('overview.bluewireComponents.violations', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-12"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.bluewireComponents.violations.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            )}
            {currentOverview.bluewireComponents.csaBasics !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">CSA BASICs</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireComponents.csaBasics || ''}
                    onChange={(e) => updateField('overview.bluewireComponents.csaBasics', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-12"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.bluewireComponents.csaBasics.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            )}
            {currentOverview.bluewireComponents.driverOos !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">Driver OOS</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireComponents.driverOos || ''}
                    onChange={(e) => updateField('overview.bluewireComponents.driverOos', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-12"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.bluewireComponents.driverOos.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            )}
            {currentOverview.bluewireComponents.criticalAcuteViolations !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">Critical Acute</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireComponents.criticalAcuteViolations || ''}
                    onChange={(e) => updateField('overview.bluewireComponents.criticalAcuteViolations', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-12"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.bluewireComponents.criticalAcuteViolations.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            )}
            {currentOverview.bluewireComponents.newEntrants !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">New Entrants</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireComponents.newEntrants || ''}
                    onChange={(e) => updateField('overview.bluewireComponents.newEntrants', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-12"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.bluewireComponents.newEntrants.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            )}
            {currentOverview.bluewireComponents.mcs150 !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">MCS-150</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireComponents.mcs150 || ''}
                    onChange={(e) => updateField('overview.bluewireComponents.mcs150', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-12"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.bluewireComponents.mcs150.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            )}
            {currentOverview.bluewireComponents.judicialHellholes !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">Judicial Hellholes</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireComponents.judicialHellholes || ''}
                    onChange={(e) => updateField('overview.bluewireComponents.judicialHellholes', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-12"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.bluewireComponents.judicialHellholes.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            )}
            {currentOverview.bluewireComponents.safetyRating !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">Safety Rating</div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={currentOverview.bluewireComponents.safetyRating || ''}
                    onChange={(e) => updateField('overview.bluewireComponents.safetyRating', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold h-12"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {currentOverview.bluewireComponents.safetyRating.toFixed(1)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            )}
          </div>
        </Glass>
      )}
      
      {/* Connection Status & Assessment */}
      <Glass className="p-6 border-2">
        <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" style={{ color: accentColor }} />
          Connection Status & Assessment
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-muted/20 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">ELD Connection Status</div>
            <div className={`text-lg font-bold ${currentOverview.connectionStatus === 'Connected' ? 'text-green-600' : 'text-red-600'}`}>
              {currentOverview.connectionStatus || 'Unknown'}
            </div>
            {overview.eldConnection?.connectedDate && (
              <div className="text-xs text-muted-foreground mt-1">
                Connected on {String(overview.eldConnection.connectedDate)
                  .replace(/[^\d\/]/g, '')
                  .match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)?.[0] || 
                  String(overview.eldConnection.connectedDate)
                    .split(/\s+/)[0]
                    .split(/[^\d\/]/)[0]
                    .substring(0, 10)}
              </div>
            )}
            {overview.eldConnection?.lastUpdated && !overview.eldConnection?.connectedDate && (
              <div className="text-xs text-muted-foreground mt-1">
                {String(overview.eldConnection.lastUpdated)
                  .split(/\s+(?:The|Assessment|Interstate|View|Network|Equipment|carrier|has|a|connected|Updated|minutes|ago)/i)[0]
                  .replace(/[^\d\s]*(?=\d+\s+minutes?\s+ago)/i, '')
                  .trim()
                  .substring(0, 20)}
              </div>
            )}
          </div>
          <div className="p-4 bg-muted/20 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Assessment Status</div>
            {isEditing ? (
              <select
                value={currentOverview.assessmentStatus || 'Unknown'}
                onChange={(e) => updateField('overview.assessmentStatus', e.target.value)}
                className={`text-lg font-bold border rounded px-2 py-1 ${
                  currentOverview.assessmentStatus === 'Pass' ? 'text-green-600' :
                  currentOverview.assessmentStatus === 'Partial Pass' ? 'text-yellow-600' :
                  currentOverview.assessmentStatus === 'Fail' ? 'text-red-600' : 'text-muted-foreground'
                }`}
              >
                <option value="Pass">Pass</option>
                <option value="Partial Pass">Partial Pass</option>
                <option value="Fail">Fail</option>
                <option value="Unknown">Unknown</option>
              </select>
            ) : (
            <div className={`text-lg font-bold ${
              overview.assessmentStatus === 'Pass' ? 'text-green-600' :
              overview.assessmentStatus === 'Partial Pass' ? 'text-yellow-600' :
              overview.assessmentStatus === 'Fail' ? 'text-red-600' : 'text-muted-foreground'
            }`}>
              {overview.assessmentStatus || 'Unknown'}
            </div>
            )}
            {overview.assessmentStatus === 'Partial Pass' && (
              <div className="text-xs text-muted-foreground mt-1">
                Interstate - California, Temperature Controlled
              </div>
            )}
          </div>
        </div>
      </Glass>
      
      {/* Network Section */}
      {currentOverview.network && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('network')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5" style={{ color: accentColor }} />
              Network
            </h4>
            {expandedSections.network ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          {expandedSections.network && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/20 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Preferred Areas</div>
                {isEditing ? (
                  <Input
                    type="text"
                    value={currentOverview.network?.preferredStates || ''}
                    onChange={(e) => updateField('overview.network.preferredStates', e.target.value)}
                    className="text-lg font-semibold"
                    placeholder="e.g., 48 States"
                  />
                ) : (
                <div className="text-lg font-semibold">
                    {currentOverview.network?.preferredStates || 'N/A'} States
                </div>
                )}
              </div>
              <div className="p-3 bg-muted/20 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Cross Border</div>
                {isEditing ? (
                  <select
                    value={currentOverview.network?.crossBorder ? 'Yes' : 'No'}
                    onChange={(e) => updateField('overview.network.crossBorder', e.target.value === 'Yes')}
                    className="text-lg font-semibold border rounded px-2 py-1"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                <div className="text-lg font-semibold">
                    {currentOverview.network?.crossBorder ? 'Yes' : 'No'}
                </div>
                )}
              </div>
            </div>
          )}
        </Glass>
      )}
      
      {/* Authority Section */}
      {currentOverview.authority && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('authority')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <FileCheck className="h-5 w-5" style={{ color: accentColor }} />
              Authority
            </h4>
            {expandedSections.authority ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          {expandedSections.authority && (
            <div className="space-y-4">
              {currentOverview.authority.types && currentOverview.authority.types.length > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Authority Types</div>
                  <div className="flex flex-wrap gap-2">
                    {currentOverview.authority.types.map((type: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-blue-500/10 text-blue-600 text-sm rounded">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {currentOverview.authority.history && currentOverview.authority.history.length > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Authority History</div>
                  <div className="space-y-2">
                    {currentOverview.authority.history
                      .filter((record: any) => {
                        if (!record || !record.type || !record.action || !record.date) return false;
                        // Additional validation: ensure type, action, and date are reasonable
                        const type = String(record.type).trim();
                        const action = String(record.action).trim();
                        const date = String(record.date).trim();
                        return type.length > 0 && type.length < 100 &&
                               ['WITHDRAWN', 'GRANTED', 'REVOKED'].includes(action) &&
                               date.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/);
                      })
                      .map((record: any, idx: number) => {
                        // Clean the type - remove extra whitespace, HTML entities, and limit length
                        let cleanType = String(record.type)
                          .trim()
                          .replace(/\s+/g, ' ')
                          .replace(/&amp;/g, '&')
                          .replace(/&nbsp;/g, ' ')
                          .replace(/[^\w\s\/-]/g, '')
                          .substring(0, 50);
                        const cleanDate = String(record.date).trim().match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)?.[0] || String(record.date).trim().substring(0, 10);
                        const cleanAction = String(record.action).trim();
                        return (
                          <div key={idx} className="p-3 bg-muted/20 rounded-lg flex justify-between items-center">
                            <div>
                              <div className="font-semibold">{cleanType}</div>
                              <div className="text-xs text-muted-foreground">{cleanDate}</div>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              cleanAction === 'GRANTED' ? 'bg-green-500/10 text-green-600' :
                              cleanAction === 'WITHDRAWN' ? 'bg-yellow-500/10 text-yellow-600' :
                              'bg-red-500/10 text-red-600'
                            }`}>
                              {cleanAction}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              {currentOverview.authority.oosRates && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Out of Service Rates</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentOverview.authority.oosRates.driver && (
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="text-sm font-semibold mb-1">Driver</div>
                        <div className="text-xs text-muted-foreground">
                          {overview.authority.oosRates.driver.oos} OOS / {overview.authority.oosRates.driver.inspections} Inspections
                        </div>
                        <div className="text-sm font-semibold mt-1">
                          {overview.authority.oosRates.driver.percentage}% (National: {overview.authority.oosRates.driver.nationalAverage}%)
                        </div>
                      </div>
                    )}
                    {currentOverview.authority.oosRates.vehicle && (
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="text-sm font-semibold mb-1">Vehicle</div>
                        <div className="text-xs text-muted-foreground">
                          {overview.authority.oosRates.vehicle.oos} OOS / {overview.authority.oosRates.vehicle.inspections} Inspections
                        </div>
                        <div className="text-sm font-semibold mt-1">
                          {overview.authority.oosRates.vehicle.percentage}% (National: {overview.authority.oosRates.vehicle.nationalAverage}%)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Glass>
      )}
      
      {/* Inspections Section */}
      {overview.inspections && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('inspections')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <FileCheck className="h-5 w-5" style={{ color: accentColor }} />
              Inspections
              {currentOverview.inspections.count && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({currentOverview.inspections.count} total)
                </span>
              )}
            </h4>
            {expandedSections.inspections ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          {expandedSections.inspections && (
            <div className="space-y-4">
              {overview.inspections.ratio && (
                <div className="p-3 bg-muted/20 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Inspection-to-Fleet Ratio</div>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={currentOverview.inspections.ratio || ''}
                      onChange={(e) => updateField('overview.inspections.ratio', e.target.value)}
                      className="text-lg font-semibold"
                    />
                  ) : (
                  <div className="text-lg font-semibold">{currentOverview.inspections.ratio}</div>
                  )}
                </div>
              )}
              {currentOverview.inspections.percentile && (
                <div className="p-3 bg-muted/20 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Percentile Ranking</div>
                  <div className="text-lg font-semibold">Top {currentOverview.inspections.percentile}</div>
                </div>
              )}
              {currentOverview.inspections.history && currentOverview.inspections.history.length > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Inspection History</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {currentOverview.inspections.history.map((record: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted/20 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold">{record.date}</div>
                            <div className="text-xs text-muted-foreground">
                              {record.type} • {record.state} • {record.plateNumber}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{record.violations} Violations</div>
                            {record.oos > 0 && (
                              <div className="text-xs text-red-600">{record.oos} OOS</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Glass>
      )}
      
      {/* Crashes Section */}
      {currentOverview.crashes && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('crashes')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" style={{ color: accentColor }} />
              Crashes
              {currentOverview.crashes.count24Months && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({currentOverview.crashes.count24Months} in last 24 months)
                </span>
              )}
            </h4>
            {expandedSections.crashes ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          {expandedSections.crashes && currentOverview.crashes.history && currentOverview.crashes.history.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currentOverview.crashes.history.map((record: any, idx: number) => (
                <div key={idx} className="p-3 bg-muted/20 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{record.date}</div>
                      <div className="text-xs text-muted-foreground">
                        {record.locationState} • Report: {record.reportNumber}
                      </div>
                    </div>
                    <div className="text-right">
                      {record.fatalities > 0 && (
                        <div className="text-sm font-semibold text-red-600">{record.fatalities} Fatalities</div>
                      )}
                      {record.injuries > 0 && (
                        <div className="text-xs text-yellow-600">{record.injuries} Injuries</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Glass>
      )}
      
      {/* Operations Section */}
      {currentOverview.operations && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('operations')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: accentColor }} />
              Operations
            </h4>
            {expandedSections.operations ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          {expandedSections.operations && (
            <div className="space-y-3">
              {currentOverview.operations.fleetSize && (
                <div className="p-3 bg-muted/20 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Fleet Size</div>
                  <div className="text-lg font-semibold">{currentOverview.operations.fleetSize}</div>
                </div>
              )}
              {currentOverview.operations.cargoCarried && currentOverview.operations.cargoCarried.length > 0 && (
                <div className="p-3 bg-muted/20 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">Cargo Carried</div>
                  <div className="flex flex-wrap gap-2">
                    {currentOverview.operations.cargoCarried.map((cargo: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-blue-500/10 text-blue-600 text-sm rounded">
                        {cargo}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Glass>
      )}
      
      {/* Critical Status Indicators - Console Style */}
      <Glass className="p-6 border-2">
        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5" style={{ color: accentColor }} />
          Status Console
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Connection Status */}
          <div className="relative p-5 rounded-xl border-2 bg-gradient-to-br from-background to-muted/20 overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                  overview.connectionStatus === 'Connected' 
                    ? 'bg-green-500/20 text-green-600' 
                    : 'bg-red-500/20 text-red-600'
                }`}>
                  <Activity className={`h-5 w-5 ${
                    overview.connectionStatus === 'Connected' ? 'text-green-600' : 'text-red-600'
                  }`} />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Connection
                  </div>
                  {isEditing ? (
                    <select
                      value={currentOverview.connectionStatus || 'Unknown'}
                      onChange={(e) => updateField('overview.connectionStatus', e.target.value)}
                      className="text-lg font-bold border rounded px-2 py-1"
                    >
                      <option value="Connected">Connected</option>
                      <option value="Not Connected">Not Connected</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  ) : (
                    <div className={`text-lg font-bold mt-0.5 ${
                      currentOverview.connectionStatus === 'Connected' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {currentOverview.connectionStatus || 'Unknown'}
                    </div>
                  )}
                </div>
              </div>
              {currentOverview.eldConnection?.connectedDate && (
                <div className="text-xs text-muted-foreground mt-2 pl-11">
                  Since {String(currentOverview.eldConnection.connectedDate)
                    .replace(/[^\d\/]/g, '')
                    .match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)?.[0] || 
                    String(currentOverview.eldConnection.connectedDate).split(/\s+/)[0].substring(0, 10)}
                </div>
              )}
            </div>
          </div>
          
          {/* Safety Rating */}
          <div className="relative p-5 rounded-xl border-2 bg-gradient-to-br from-background to-muted/20 overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${
              currentOverview.safetyRating?.toLowerCase().includes('satisfactory') 
                ? 'from-green-500/10 to-green-500/5'
                : currentOverview.safetyRating?.toLowerCase().includes('conditional')
                ? 'from-yellow-500/10 to-yellow-500/5'
                : currentOverview.safetyRating?.toLowerCase().includes('unsatisfactory')
                ? 'from-red-500/10 to-red-500/5'
                : 'from-gray-500/10 to-gray-500/5'
            } rounded-full blur-2xl -mr-10 -mt-10`} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                  currentOverview.safetyRating?.toLowerCase().includes('satisfactory')
                    ? 'bg-green-500/20 text-green-600'
                    : currentOverview.safetyRating?.toLowerCase().includes('conditional')
                    ? 'bg-yellow-500/20 text-yellow-600'
                    : currentOverview.safetyRating?.toLowerCase().includes('unsatisfactory')
                    ? 'bg-red-500/20 text-red-600'
                    : 'bg-gray-500/20 text-gray-600'
                }`}>
                  <Shield className={`h-5 w-5 ${
                    currentOverview.safetyRating?.toLowerCase().includes('satisfactory')
                      ? 'text-green-600'
                      : overview.safetyRating?.toLowerCase().includes('conditional')
                      ? 'text-yellow-600'
                      : overview.safetyRating?.toLowerCase().includes('unsatisfactory')
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`} />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Safety Rating
                  </div>
                  {isEditing ? (
                    <select
                      value={(() => {
                        const rating = currentOverview.safetyRating || '';
                        const validRatings = ['Satisfactory', 'Conditional', 'Unsatisfactory', 'Unrated'];
                        const matched = validRatings.find(v => rating.toLowerCase().includes(v.toLowerCase()));
                        return matched || 'Unrated';
                      })()}
                      onChange={(e) => updateField('overview.safetyRating', e.target.value)}
                      className={`text-lg font-bold border rounded px-2 py-1 ${getSafetyRatingColor(currentOverview.safetyRating)}`}
                    >
                      <option value="Satisfactory">Satisfactory</option>
                      <option value="Conditional">Conditional</option>
                      <option value="Unsatisfactory">Unsatisfactory</option>
                      <option value="Unrated">Unrated</option>
                    </select>
                  ) : (
                    <div className={`text-lg font-bold mt-0.5 ${getSafetyRatingColor(currentOverview.safetyRating)}`}>
                      {(() => {
                        const rating = currentOverview.safetyRating || '';
                        if (!rating) return 'Unrated';
                        // Clean rating - extract only valid values
                        const validRatings = ['Satisfactory', 'Conditional', 'Unsatisfactory', 'Unrated'];
                        const matched = validRatings.find(v => rating.toLowerCase().includes(v.toLowerCase()));
                        if (matched) return matched;
                        // If it's a long string, try to extract just the rating part
                        const cleaned = String(rating)
                          .split(/\s+(?:Certifications|CARB|ELD|The|carrier|credentials|Unsafe|Hours-of-Service|Compliance|Vehicle|Maintenance|Controlled|Substances|Alcohol|Driver|Fitness)/i)[0]
                          .trim()
                          .substring(0, 20);
                        return cleaned || 'Unrated';
                      })()}
                    </div>
                  )}
                </div>
              </div>
              {currentOverview.safetyRating && currentOverview.safetyRating !== 'Unrated' && (
                <div className="text-xs text-muted-foreground mt-2 pl-11">
                  FMCSA Compliance
                </div>
              )}
            </div>
          </div>
          
          {/* Operating Status */}
          <div className="relative p-5 rounded-xl border-2 bg-gradient-to-br from-background to-muted/20 overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${
              overview.operatingStatus?.toLowerCase().includes('active')
                ? 'from-green-500/10 to-green-500/5'
                : overview.operatingStatus?.toLowerCase().includes('inactive')
                ? 'from-red-500/10 to-red-500/5'
                : 'from-yellow-500/10 to-yellow-500/5'
            } rounded-full blur-2xl -mr-10 -mt-10`} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                  overview.operatingStatus?.toLowerCase().includes('active')
                    ? 'bg-green-500/20 text-green-600'
                    : overview.operatingStatus?.toLowerCase().includes('inactive')
                    ? 'bg-red-500/20 text-red-600'
                    : 'bg-yellow-500/20 text-yellow-600'
                }`}>
                  <Building2 className={`h-5 w-5 ${
                    overview.operatingStatus?.toLowerCase().includes('active')
                      ? 'text-green-600'
                      : overview.operatingStatus?.toLowerCase().includes('inactive')
                      ? 'text-red-600'
                      : 'text-yellow-600'
                  }`} />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Operating Status
                  </div>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={currentOverview.operatingStatus || ''}
                      onChange={(e) => updateField('overview.operatingStatus', e.target.value)}
                      className="text-lg font-bold"
                      placeholder="Operating Status"
                    />
                  ) : (
                    <div className={`text-lg font-bold mt-0.5 ${getOperatingStatusColor(currentOverview.operatingStatus)}`}>
                      {(() => {
                        const status: string = currentOverview.operatingStatus || '';
                        if (!status) return 'Unknown';
                        // Clean status - extract only the status part, not descriptions
                        let cleaned = String(status)
                          .split(/\s+(?:Safety|rating|Certifications|CARB|ELD|The|carrier|credentials|Unsafe|Hours-of-Service|Compliance|Vehicle|Maintenance|Controlled|Substances|Alcohol|Driver|Fitness)/i)[0]
                          .trim();
                        // Capitalize first letter of each word
                        cleaned = cleaned.split(' ').map((word: string) => 
                          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                        ).join(' ');
                        // Limit length
                        return cleaned.substring(0, 30) || 'Unknown';
                      })()}
                    </div>
                  )}
                </div>
              </div>
              {currentOverview.dotStatus && (
                <div className="text-xs text-muted-foreground mt-2 pl-11">
                  DOT: {currentOverview.dotStatus}
                </div>
              )}
            </div>
          </div>
          
          {/* ELD Provider */}
          <div className="relative p-5 rounded-xl border-2 bg-gradient-to-br from-background to-muted/20 overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-600">
                  <Gauge className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    ELD Provider
                  </div>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={currentOverview.eldProvider || currentOverview.eldConnection?.provider || ''}
                      onChange={(e) => updateField('overview.eldProvider', e.target.value)}
                      className="text-lg font-bold"
                      placeholder="ELD Provider"
                    />
                  ) : (
                    <div className="text-lg font-bold mt-0.5 text-foreground">
                      {(() => {
                        const provider = currentOverview.eldProvider || currentOverview.eldConnection?.provider || '';
                        if (!provider) return 'N/A';
                        // Clean provider name - remove long descriptive text
                        let cleaned = String(provider)
                          .split(/\s+(?:The|carrier|credentials|are|valid|and|the|ELD|account|provides|a|clear|physical|digital|footprint|TIN|Carriers|with|a|Verified|have|a|legal|name|and|tax|identification|number|matching|government|records|Learn|more|VERIFIED|Observed|Equipment|Last|Mos|Power|Units|Dry|van|Uncategorized|Box|Trucks|Suggest|an|Edit|Connected|Overview|Directory)/i)[0]
                          .trim()
                          .replace(/^ELD\s+/i, '')
                          .replace(/\s+ELD\s*$/i, ' ELD')
                          .substring(0, 25);
                        // If it's still too long or contains unwanted text, try to extract just the provider name
                        if (cleaned.length > 20 || cleaned.toLowerCase().includes('credentials')) {
                          const providerMatch = cleaned.match(/(Greenlight|Samsara|Geotab|Omnitracs|PeopleNet|KeepTruckin|Verizon|Qualcomm|XRS|FleetComplete|Teletrac|Zonar|BigRoad|FleetMatics|GPS Insight|Linxup|FleetHub|Fleetio)[\s]*ELD?/i);
                          if (providerMatch) {
                            cleaned = providerMatch[0].trim();
                          } else {
                            cleaned = cleaned.split(/\s+/)[0] + ' ELD';
                          }
                        }
                        return cleaned || 'N/A';
                      })()}
                    </div>
                  )}
                </div>
              </div>
              {currentOverview.eldConnection?.lastUpdated && !currentOverview.eldConnection?.connectedDate && (
                <div className="text-xs text-muted-foreground mt-2 pl-11">
                  {String(currentOverview.eldConnection.lastUpdated)
                    .split(/\s+(?:The|Assessment|Interstate|View|Network|Equipment|carrier|has|a|connected|Updated|minutes|ago)/i)[0]
                    .replace(/[^\d\s]*(?=\d+\s+minutes?\s+ago)/i, '')
                    .trim()
                    .substring(0, 20)}
                </div>
              )}
            </div>
          </div>
        </div>
      </Glass>
      
      {/* Collapsible Overview Section */}
      <Glass className="p-6 border-2">
        <button
          onClick={() => toggleSection('overview')}
          className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
        >
          <h4 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: accentColor }} />
            Carrier Overview
          </h4>
          {expandedSections.overview ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        
        {expandedSections.overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                <span className="text-sm text-muted-foreground">DOT Status</span>
                {isEditing ? (
                  <Input
                    type="text"
                    value={currentOverview.dotStatus || ''}
                    onChange={(e) => updateField('overview.dotStatus', e.target.value)}
                    className="text-sm font-semibold w-32"
                    placeholder="Active/Inactive"
                  />
                ) : (
                  <span className="text-sm font-semibold">{currentOverview.dotStatus || 'N/A'}</span>
                )}
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                <span className="text-sm text-muted-foreground">Assessment Status</span>
                {isEditing ? (
                  <select
                    value={currentOverview.assessmentStatus || 'Unknown'}
                    onChange={(e) => updateField('overview.assessmentStatus', e.target.value)}
                    className="text-sm font-semibold px-2 py-1 rounded border"
                  >
                    <option value="Pass">Pass</option>
                    <option value="Partial Pass">Partial Pass</option>
                    <option value="Fail">Fail</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                ) : (
                <span className={`text-sm font-semibold ${
                    currentOverview.assessmentStatus === 'Pass' ? 'text-green-600' :
                    currentOverview.assessmentStatus === 'Partial Pass' ? 'text-yellow-600' :
                    currentOverview.assessmentStatus === 'Fail' ? 'text-red-600' : ''
                }`}>
                    {currentOverview.assessmentStatus || 'Unknown'}
                </span>
                )}
              </div>
                <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Dispatch Phone
                  </span>
                {isEditing ? (
                  <Input
                    type="tel"
                    value={currentOverview.dispatchContact?.phone || ''}
                    onChange={(e) => updateField('overview.dispatchContact.phone', e.target.value)}
                    className="text-sm font-semibold w-40"
                    placeholder="(555) 123-4567"
                  />
                ) : (
                  <span className="text-sm font-semibold">{currentOverview.dispatchContact?.phone || 'N/A'}</span>
                )}
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Dispatch Email
                  </span>
                {isEditing ? (
                  <Input
                    type="email"
                    value={currentOverview.dispatchContact?.email || ''}
                    onChange={(e) => updateField('overview.dispatchContact.email', e.target.value)}
                    className="text-sm font-semibold w-48"
                    placeholder="email@example.com"
                  />
                ) : (
                  <span className="text-sm font-semibold">{currentOverview.dispatchContact?.email || 'N/A'}</span>
                )}
                </div>
            </div>
            
            <div className="space-y-3">
                <div className="p-3 bg-muted/20 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Address
                  </div>
                {isEditing ? (
                  <Textarea
                    value={currentOverview.address || ''}
                    onChange={(e) => updateField('overview.address', e.target.value)}
                    className="text-sm font-medium min-h-[60px]"
                    placeholder="Enter full address"
                  />
                ) : (
                  <div className="text-sm font-medium">{currentOverview.address || 'N/A'}</div>
                )}
                </div>
                <div className="p-3 bg-muted/20 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">Certifications</div>
                {isEditing ? (
                  <Textarea
                    value={Array.isArray(currentOverview.certifications) 
                      ? currentOverview.certifications.map((c: any) => typeof c === 'string' ? c : c.name).join(', ')
                      : ''}
                    onChange={(e) => {
                      const certs = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
                      updateField('overview.certifications', certs);
                    }}
                    className="text-sm min-h-[60px]"
                    placeholder="Enter certifications separated by commas"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {currentOverview.certifications && currentOverview.certifications.length > 0 ? (
                      currentOverview.certifications.map((cert: string | { name: string; date?: string; verified?: boolean }, idx: number) => {
                      const certName = typeof cert === 'string' ? cert : cert.name;
                      const certDate = typeof cert === 'object' && cert.date ? cert.date : null;
                      return (
                        <span key={idx} className="px-2 py-1 bg-blue-500/10 text-blue-600 text-xs rounded">
                          {certName}
                          {certDate && <span className="ml-1 text-muted-foreground">({certDate})</span>}
                        </span>
                      );
                      })
                    ) : (
                      <span className="text-xs text-muted-foreground">No certifications</span>
                    )}
                </div>
              )}
              </div>
            </div>
          </div>
        )}
      </Glass>
      
      {/* Safety & Compliance Section */}
      {overview.safety && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('safety')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: accentColor }} />
              Safety & Compliance
            </h4>
            {expandedSections.safety ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          
          {expandedSections.safety && (
            <div className="space-y-4">
              {/* CSA BASICs */}
              {(currentOverview.safety || isEditing) && (
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-muted-foreground">CSA Percentile Equivalent & BASIC Score</div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {/* Unsafe Driving */}
                    <div className="p-3 bg-muted/20 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-2 font-semibold">Unsafe Driving</div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">CSA Percentile</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.unsafeDriving?.percentile || ''}
                              onChange={(e) => updateField('overview.safety.unsafeDriving.percentile', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">{currentOverview.safety?.unsafeDriving?.percentile || 'N/A'}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">BASIC Score</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.unsafeDriving?.score || ''}
                              onChange={(e) => updateField('overview.safety.unsafeDriving.score', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">
                              {currentOverview.safety?.unsafeDriving?.score != null 
                                ? currentOverview.safety.unsafeDriving.score 
                                : 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* HOS Compliance */}
                    <div className="p-3 bg-muted/20 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-2 font-semibold">HOS Compliance</div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">CSA Percentile</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.hoursOfService?.percentile || ''}
                              onChange={(e) => updateField('overview.safety.hoursOfService.percentile', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">{currentOverview.safety?.hoursOfService?.percentile || 'N/A'}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">BASIC Score</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.hoursOfService?.score || ''}
                              onChange={(e) => updateField('overview.safety.hoursOfService.score', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">
                              {currentOverview.safety?.hoursOfService?.score != null 
                                ? currentOverview.safety.hoursOfService.score 
                                : 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Vehicle Maintenance */}
                    <div className="p-3 bg-muted/20 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-2 font-semibold">Vehicle Maintenance</div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">CSA Percentile</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.vehicleMaintenance?.percentile || ''}
                              onChange={(e) => updateField('overview.safety.vehicleMaintenance.percentile', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">{currentOverview.safety?.vehicleMaintenance?.percentile || 'N/A'}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">BASIC Score</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.vehicleMaintenance?.score || ''}
                              onChange={(e) => updateField('overview.safety.vehicleMaintenance.score', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">
                              {currentOverview.safety?.vehicleMaintenance?.score != null 
                                ? currentOverview.safety.vehicleMaintenance.score 
                                : 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Controlled Substances */}
                    <div className="p-3 bg-muted/20 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-2 font-semibold">Controlled Substances</div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">CSA Percentile</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.controlledSubstances?.percentile || ''}
                              onChange={(e) => updateField('overview.safety.controlledSubstances.percentile', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">{currentOverview.safety?.controlledSubstances?.percentile || 'N/A'}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">BASIC Score</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.controlledSubstances?.score || ''}
                              onChange={(e) => updateField('overview.safety.controlledSubstances.score', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">
                              {currentOverview.safety?.controlledSubstances?.score != null 
                                ? currentOverview.safety.controlledSubstances.score 
                                : 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Driver Fitness */}
                    <div className="p-3 bg-muted/20 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-2 font-semibold">Driver Fitness</div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">CSA Percentile</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.driverFitness?.percentile || ''}
                              onChange={(e) => updateField('overview.safety.driverFitness.percentile', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">{currentOverview.safety?.driverFitness?.percentile || 'N/A'}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">BASIC Score</div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={currentOverview.safety?.driverFitness?.score || ''}
                              onChange={(e) => updateField('overview.safety.driverFitness.score', e.target.value)}
                              className="text-sm font-bold h-8"
                              placeholder="N/A"
                            />
                          ) : (
                            <div className="text-sm font-bold">
                              {currentOverview.safety?.driverFitness?.score != null 
                                ? currentOverview.safety.driverFitness.score 
                                : 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Crashes & Inspections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-semibold">Crashes (24 Months)</span>
                  </div>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={currentOverview.crashes?.count24Months || currentOverview.crashCount24Months || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        updateField('overview.crashes.count24Months', val);
                        updateField('overview.crashCount24Months', val);
                      }}
                      className="text-3xl font-bold text-red-600 h-12"
                    />
                  ) : (
                  <div className="text-3xl font-bold text-red-600">
                      {currentOverview.crashes?.count24Months || currentOverview.crashCount24Months || 0}
                  </div>
                  )}
                </div>
                
                  <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileCheck className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold">Inspections</span>
                    </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        value={currentOverview.inspections?.count || ''}
                        onChange={(e) => updateField('overview.inspections.count', parseInt(e.target.value) || 0)}
                        className="text-3xl font-bold text-blue-600 h-12"
                        placeholder="0"
                      />
                      <Input
                        type="text"
                        value={currentOverview.inspections?.ratio || ''}
                        onChange={(e) => updateField('overview.inspections.ratio', e.target.value)}
                        className="text-xs text-muted-foreground h-8"
                        placeholder="Ratio"
                      />
                    </div>
                  ) : (
                    <>
                    <div className="text-3xl font-bold text-blue-600">
                        {currentOverview.inspections?.count || 'N/A'}
                    </div>
                      {currentOverview.inspections?.ratio && (
                      <div className="text-xs text-muted-foreground mt-1">
                          Ratio: {currentOverview.inspections.ratio}
                      </div>
                    )}
                    </>
                )}
                </div>
              </div>
            </div>
          )}
        </Glass>
      )}
      
      {/* Equipment Section */}
      {overview.powerUnits && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('equipment')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <Truck className="h-5 w-5" style={{ color: accentColor }} />
              Equipment & Fleet
            </h4>
            {expandedSections.equipment ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          
          {expandedSections.equipment && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted/20 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Power Units</div>
                <div className="text-2xl font-bold" style={{ color: accentColor }}>
                  {overview.powerUnits}
                </div>
              </div>
              {overview.trailers && (
                <div className="p-4 bg-muted/20 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Trailers</div>
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {overview.trailers}
                  </div>
                </div>
              )}
              {overview.averageFleetAge && (
                <div className="p-4 bg-muted/20 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Avg Fleet Age</div>
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {overview.averageFleetAge}
                  </div>
                </div>
              )}
            </div>
          )}
        </Glass>
      )}
      
      {/* Insurance Section */}
      {(currentOverview.insurance || isEditing) && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('insurance')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5" style={{ color: accentColor }} />
              Insurance Coverage
            </h4>
            {expandedSections.insurance ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          
          {expandedSections.insurance && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* General Liability */}
              <div className={`p-5 rounded-xl border-2 relative overflow-hidden ${currentOverview.insurance?.generalLiability?.active ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/30' : 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/30'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-full blur-2xl -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${currentOverview.insurance?.generalLiability?.active ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <span className="text-base font-bold">General Liability</span>
                    </div>
                    {isEditing ? (
                      <select
                        value={currentOverview.insurance?.generalLiability?.active ? 'Active' : 'Inactive'}
                        onChange={(e) => {
                          if (!currentOverview.insurance) updateField('overview.insurance', {});
                          updateField('overview.insurance.generalLiability.active', e.target.value === 'Active');
                        }}
                        className="text-xs px-2 py-1 rounded border bg-background"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${currentOverview.insurance?.generalLiability?.active ? 'bg-green-500/20 text-green-600 border border-green-500/30' : 'bg-red-500/20 text-red-600 border border-red-500/30'}`}>
                        {currentOverview.insurance?.generalLiability?.active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    )}
                  </div>
                  
                  {/* Expiration Preview */}
                  {currentOverview.insurance?.generalLiability?.expirationDate && !isEditing && (
                    <div className="mb-4 p-3 rounded-lg bg-background/50 border border-muted">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Expires</span>
                        <span className="text-sm font-bold">{currentOverview.insurance.generalLiability.expirationDate}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    {isEditing ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Insurer Name</Label>
                          <Input
                            value={currentOverview.insurance?.generalLiability?.insurerName || ''}
                            onChange={(e) => updateField('overview.insurance.generalLiability.insurerName', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="Insurer Name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Policy Number</Label>
                          <Input
                            value={currentOverview.insurance?.generalLiability?.policyNumber || ''}
                            onChange={(e) => updateField('overview.insurance.generalLiability.policyNumber', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="Policy Number"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Effective Date</Label>
                            <Input
                              value={currentOverview.insurance?.generalLiability?.effectiveDate || ''}
                              onChange={(e) => updateField('overview.insurance.generalLiability.effectiveDate', e.target.value)}
                              className="mt-1 h-8"
                              placeholder="7/26/25"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Expiration Date</Label>
                            <Input
                              value={currentOverview.insurance?.generalLiability?.expirationDate || ''}
                              onChange={(e) => updateField('overview.insurance.generalLiability.expirationDate', e.target.value)}
                              className="mt-1 h-8"
                              placeholder="7/26/26"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Each Occurrence</Label>
                          <Input
                            value={currentOverview.insurance?.generalLiability?.eachOccurrence || ''}
                            onChange={(e) => updateField('overview.insurance.generalLiability.eachOccurrence', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="$1,000,000"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">General Aggregate</Label>
                          <Input
                            value={currentOverview.insurance?.generalLiability?.generalAggregate || ''}
                            onChange={(e) => updateField('overview.insurance.generalLiability.generalAggregate', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="$2,000,000"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {currentOverview.insurance?.generalLiability?.insurerName ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Insurer:</span>
                            <span className="font-medium">{currentOverview.insurance.generalLiability.insurerName}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.generalLiability?.policyNumber ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Policy:</span>
                            <span className="font-medium font-mono text-xs">{currentOverview.insurance.generalLiability.policyNumber}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.generalLiability?.effectiveDate ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Effective:</span>
                            <span>{currentOverview.insurance.generalLiability.effectiveDate}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.generalLiability?.expirationDate && !currentOverview.insurance?.generalLiability?.expirationDate.includes('Expires') ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Expires:</span>
                            <span className="font-semibold">{currentOverview.insurance.generalLiability.expirationDate}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.generalLiability?.eachOccurrence ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Each Occurrence:</span>
                            <span className="font-semibold text-green-600">{currentOverview.insurance.generalLiability.eachOccurrence}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.generalLiability?.generalAggregate ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">General Aggregate:</span>
                            <span className="font-semibold text-green-600">{currentOverview.insurance.generalLiability.generalAggregate}</span>
                          </div>
                        ) : null}
                        {!currentOverview.insurance?.generalLiability?.insurerName && 
                         !currentOverview.insurance?.generalLiability?.policyNumber && 
                         !currentOverview.insurance?.generalLiability?.effectiveDate && 
                         !currentOverview.insurance?.generalLiability?.expirationDate && (
                          <div className="text-xs text-muted-foreground italic">No details available</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Auto Insurance */}
              <div className={`p-5 rounded-xl border-2 relative overflow-hidden ${currentOverview.insurance?.auto?.active ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/30' : 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/30'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-full blur-2xl -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${currentOverview.insurance?.auto?.active ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                        <Truck className="h-4 w-4" />
                      </div>
                      <span className="text-base font-bold">Auto</span>
                    </div>
                    {isEditing ? (
                      <select
                        value={currentOverview.insurance?.auto?.active ? 'Active' : 'Inactive'}
                        onChange={(e) => {
                          if (!currentOverview.insurance) updateField('overview.insurance', {});
                          updateField('overview.insurance.auto.active', e.target.value === 'Active');
                        }}
                        className="text-xs px-2 py-1 rounded border bg-background"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${currentOverview.insurance?.auto?.active ? 'bg-green-500/20 text-green-600 border border-green-500/30' : 'bg-red-500/20 text-red-600 border border-red-500/30'}`}>
                        {currentOverview.insurance?.auto?.active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    )}
                  </div>
                  
                  {/* Expiration Preview */}
                  {currentOverview.insurance?.auto?.expirationDate && !isEditing && (
                    <div className="mb-4 p-3 rounded-lg bg-background/50 border border-muted">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Expires</span>
                        <span className="text-sm font-bold">{currentOverview.insurance.auto.expirationDate}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    {isEditing ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Insurer Name</Label>
                          <Input
                            value={currentOverview.insurance?.auto?.insurerName || ''}
                            onChange={(e) => updateField('overview.insurance.auto.insurerName', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="Insurer Name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Policy Number</Label>
                          <Input
                            value={currentOverview.insurance?.auto?.policyNumber || ''}
                            onChange={(e) => updateField('overview.insurance.auto.policyNumber', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="Policy Number"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Effective Date</Label>
                            <Input
                              value={currentOverview.insurance?.auto?.effectiveDate || ''}
                              onChange={(e) => updateField('overview.insurance.auto.effectiveDate', e.target.value)}
                              className="mt-1 h-8"
                              placeholder="7/26/25"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Expiration Date</Label>
                            <Input
                              value={currentOverview.insurance?.auto?.expirationDate || ''}
                              onChange={(e) => updateField('overview.insurance.auto.expirationDate', e.target.value)}
                              className="mt-1 h-8"
                              placeholder="7/26/26"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Limit</Label>
                          <Input
                            value={currentOverview.insurance?.auto?.limit || ''}
                            onChange={(e) => updateField('overview.insurance.auto.limit', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="$1,000,000"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {currentOverview.insurance?.auto?.insurerName ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Insurer:</span>
                            <span className="font-medium">{currentOverview.insurance.auto.insurerName}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.auto?.policyNumber ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Policy:</span>
                            <span className="font-medium font-mono text-xs">{currentOverview.insurance.auto.policyNumber}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.auto?.effectiveDate ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Effective:</span>
                            <span>{currentOverview.insurance.auto.effectiveDate}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.auto?.expirationDate && !currentOverview.insurance?.auto?.expirationDate.includes('Expires') ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Expires:</span>
                            <span className="font-semibold">{currentOverview.insurance.auto.expirationDate}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.auto?.limit ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Limit:</span>
                            <span className="font-semibold text-green-600">{currentOverview.insurance.auto.limit}</span>
                          </div>
                        ) : null}
                        {!currentOverview.insurance?.auto?.insurerName && 
                         !currentOverview.insurance?.auto?.policyNumber && 
                         !currentOverview.insurance?.auto?.effectiveDate && 
                         !currentOverview.insurance?.auto?.expirationDate && (
                          <div className="text-xs text-muted-foreground italic">No details available</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Cargo Insurance */}
              <div className={`p-5 rounded-xl border-2 relative overflow-hidden ${currentOverview.insurance?.cargo?.active ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/30' : 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/30'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-full blur-2xl -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${currentOverview.insurance?.cargo?.active ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className="text-base font-bold">Cargo</span>
                    </div>
                    {isEditing ? (
                      <select
                        value={currentOverview.insurance?.cargo?.active ? 'Active' : 'Inactive'}
                        onChange={(e) => {
                          if (!currentOverview.insurance) updateField('overview.insurance', {});
                          updateField('overview.insurance.cargo.active', e.target.value === 'Active');
                        }}
                        className="text-xs px-2 py-1 rounded border bg-background"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${currentOverview.insurance?.cargo?.active ? 'bg-green-500/20 text-green-600 border border-green-500/30' : 'bg-red-500/20 text-red-600 border border-red-500/30'}`}>
                        {currentOverview.insurance?.cargo?.active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    )}
                  </div>
                  
                  {/* Expiration Preview */}
                  {currentOverview.insurance?.cargo?.expirationDate && !isEditing && (
                    <div className="mb-4 p-3 rounded-lg bg-background/50 border border-muted">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Expires</span>
                        <span className="text-sm font-bold">{currentOverview.insurance.cargo.expirationDate}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    {isEditing ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Insurer Name</Label>
                          <Input
                            value={currentOverview.insurance?.cargo?.insurerName || ''}
                            onChange={(e) => updateField('overview.insurance.cargo.insurerName', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="Insurer Name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Policy Number</Label>
                          <Input
                            value={currentOverview.insurance?.cargo?.policyNumber || ''}
                            onChange={(e) => updateField('overview.insurance.cargo.policyNumber', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="Policy Number"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Effective Date</Label>
                            <Input
                              value={currentOverview.insurance?.cargo?.effectiveDate || ''}
                              onChange={(e) => updateField('overview.insurance.cargo.effectiveDate', e.target.value)}
                              className="mt-1 h-8"
                              placeholder="10/11/25"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Expiration Date</Label>
                            <Input
                              value={currentOverview.insurance?.cargo?.expirationDate || ''}
                              onChange={(e) => updateField('overview.insurance.cargo.expirationDate', e.target.value)}
                              className="mt-1 h-8"
                              placeholder="10/11/26"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Limit</Label>
                          <Input
                            value={currentOverview.insurance?.cargo?.limit || ''}
                            onChange={(e) => updateField('overview.insurance.cargo.limit', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="$100,000"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {currentOverview.insurance?.cargo?.insurerName ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Insurer:</span>
                            <span className="font-medium">{currentOverview.insurance.cargo.insurerName}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.cargo?.policyNumber ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Policy:</span>
                            <span className="font-medium font-mono text-xs">{currentOverview.insurance.cargo.policyNumber}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.cargo?.effectiveDate ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Effective:</span>
                            <span>{currentOverview.insurance.cargo.effectiveDate}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.cargo?.expirationDate && !currentOverview.insurance?.cargo?.expirationDate.includes('Expires') ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Expires:</span>
                            <span className="font-semibold">{currentOverview.insurance.cargo.expirationDate}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.cargo?.limit ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Limit:</span>
                            <span className="font-semibold text-green-600">{currentOverview.insurance.cargo.limit}</span>
                          </div>
                        ) : null}
                        {!currentOverview.insurance?.cargo?.insurerName && 
                         !currentOverview.insurance?.cargo?.policyNumber && 
                         !currentOverview.insurance?.cargo?.effectiveDate && 
                         !currentOverview.insurance?.cargo?.expirationDate && (
                          <div className="text-xs text-muted-foreground italic">No details available</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Trailer Interchange Insurance */}
              <div className={`p-5 rounded-xl border-2 relative overflow-hidden ${currentOverview.insurance?.trailerInterchange?.active ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/30' : 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/30'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-full blur-2xl -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${currentOverview.insurance?.trailerInterchange?.active ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                        <Truck className="h-4 w-4" />
                      </div>
                      <span className="text-base font-bold">Trailer Interchange</span>
                    </div>
                    {isEditing ? (
                      <select
                        value={currentOverview.insurance?.trailerInterchange?.active ? 'Active' : 'Inactive'}
                        onChange={(e) => {
                          if (!currentOverview.insurance) updateField('overview.insurance', {});
                          updateField('overview.insurance.trailerInterchange.active', e.target.value === 'Active');
                        }}
                        className="text-xs px-2 py-1 rounded border bg-background"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${currentOverview.insurance?.trailerInterchange?.active ? 'bg-green-500/20 text-green-600 border border-green-500/30' : 'bg-red-500/20 text-red-600 border border-red-500/30'}`}>
                        {currentOverview.insurance?.trailerInterchange?.active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    )}
                  </div>
                  
                  {/* Expiration Preview */}
                  {currentOverview.insurance?.trailerInterchange?.expirationDate && !isEditing && (
                    <div className="mb-4 p-3 rounded-lg bg-background/50 border border-muted">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Expires</span>
                        <span className="text-sm font-bold">{currentOverview.insurance.trailerInterchange.expirationDate}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    {isEditing ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Insurer Name</Label>
                          <Input
                            value={currentOverview.insurance?.trailerInterchange?.insurerName || ''}
                            onChange={(e) => updateField('overview.insurance.trailerInterchange.insurerName', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="Insurer Name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Policy Number</Label>
                          <Input
                            value={currentOverview.insurance?.trailerInterchange?.policyNumber || ''}
                            onChange={(e) => updateField('overview.insurance.trailerInterchange.policyNumber', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="Policy Number"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Effective Date</Label>
                            <Input
                              value={currentOverview.insurance?.trailerInterchange?.effectiveDate || ''}
                              onChange={(e) => updateField('overview.insurance.trailerInterchange.effectiveDate', e.target.value)}
                              className="mt-1 h-8"
                              placeholder="10/11/25"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Expiration Date</Label>
                            <Input
                              value={currentOverview.insurance?.trailerInterchange?.expirationDate || ''}
                              onChange={(e) => updateField('overview.insurance.trailerInterchange.expirationDate', e.target.value)}
                              className="mt-1 h-8"
                              placeholder="10/11/26"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Limit</Label>
                          <Input
                            value={currentOverview.insurance?.trailerInterchange?.limit || ''}
                            onChange={(e) => updateField('overview.insurance.trailerInterchange.limit', e.target.value)}
                            className="mt-1 h-8"
                            placeholder="$50,000"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {currentOverview.insurance?.trailerInterchange?.insurerName ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Insurer:</span>
                            <span className="font-medium">{currentOverview.insurance.trailerInterchange.insurerName}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.trailerInterchange?.policyNumber ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Policy:</span>
                            <span className="font-medium font-mono text-xs">{currentOverview.insurance.trailerInterchange.policyNumber}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.trailerInterchange?.effectiveDate ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Effective:</span>
                            <span>{currentOverview.insurance.trailerInterchange.effectiveDate}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.trailerInterchange?.expirationDate && !currentOverview.insurance?.trailerInterchange?.expirationDate.includes('Expires') ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Expires:</span>
                            <span className="font-semibold">{currentOverview.insurance.trailerInterchange.expirationDate}</span>
                          </div>
                        ) : null}
                        {currentOverview.insurance?.trailerInterchange?.limit ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-20">Limit:</span>
                            <span className="font-semibold text-green-600">{currentOverview.insurance.trailerInterchange.limit}</span>
                          </div>
                        ) : null}
                        {!currentOverview.insurance?.trailerInterchange?.insurerName && 
                         !currentOverview.insurance?.trailerInterchange?.policyNumber && 
                         !currentOverview.insurance?.trailerInterchange?.effectiveDate && 
                         !currentOverview.insurance?.trailerInterchange?.expirationDate && (
                          <div className="text-xs text-muted-foreground italic">No details available</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Old duplicate insurance cards removed - using new styled cards above */}
            </div>
          )}
        </Glass>
      )}
      
      {/* Directory & Contacts Section */}
      {directory && Object.keys(directory).length > 0 && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('directory')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5" style={{ color: accentColor }} />
              Directory & Contacts
            </h4>
            {expandedSections.directory ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          
          {expandedSections.directory && (
            <div className="space-y-6">
              {/* Verified Users */}
              {directory.verifiedUsers && directory.verifiedUsers.length > 0 && (
                <div className="p-5 rounded-xl border-2 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border-blue-500/20">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Verified Users ({directory.verifiedUsers.length})
                  </h5>
                  <div className="space-y-2">
                    {directory.verifiedUsers.map((user: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-background/50 border border-muted">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{user.name}</div>
                            {user.phone && <div className="text-sm text-muted-foreground">{user.phone}</div>}
                            {user.email && <div className="text-sm text-muted-foreground">{user.email}</div>}
                          </div>
                          {user.status === 'Verified' && (
                            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-600">Verified</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Contacts */}
              {directory.contacts && directory.contacts.length > 0 && (
                <div className="p-5 rounded-xl border-2 bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Contacts ({directory.contacts.length})
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {directory.contacts.map((contact: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-background/50 border border-muted">
                        <div className="font-medium">{contact.name}</div>
                        <div className="text-xs text-muted-foreground">{contact.role}</div>
                        {contact.phone && <div className="text-sm">{contact.phone}</div>}
                        {contact.email && <div className="text-sm text-muted-foreground">{contact.email}</div>}
                        {contact.created && <div className="text-xs text-muted-foreground mt-1">Created: {contact.created}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Rate Confirmation Emails */}
              {directory.rateConfirmationEmails && directory.rateConfirmationEmails.length > 0 && (
                <div className="p-5 rounded-xl border-2 bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Rate Confirmation Emails ({directory.rateConfirmationEmails.length})
                  </h5>
                  <div className="space-y-2">
                    {directory.rateConfirmationEmails.map((email: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-background/50 border border-muted">
                        <div className="font-mono text-sm">{email.email}</div>
                        {email.alias && <div className="text-xs text-muted-foreground">Alias: {email.alias}</div>}
                        {email.description && <div className="text-xs text-muted-foreground">Description: {email.description}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Addresses */}
              {directory.addresses && directory.addresses.length > 0 && (
                <div className="p-5 rounded-xl border-2 bg-gradient-to-br from-orange-500/5 to-red-500/5 border-orange-500/20">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Addresses ({directory.addresses.length})
                  </h5>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {directory.addresses.map((addr: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-background/50 border border-muted">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-1 rounded ${
                                addr.type === 'Physical' ? 'bg-blue-500/20 text-blue-600' : 'bg-green-500/20 text-green-600'
                              }`}>
                                {addr.type}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                addr.status === 'Current' ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-600'
                              }`}>
                                {addr.status}
                              </span>
                            </div>
                            {addr.address && (
                              <div className="text-sm font-medium">
                                {addr.address}
                                {addr.city && `, ${addr.city}`}
                                {addr.state && `, ${addr.state}`}
                                {addr.zip && ` ${addr.zip}`}
                              </div>
                            )}
                            {addr.firstSeen && (
                              <div className="text-xs text-muted-foreground mt-1">First Seen: {addr.firstSeen}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Deactivated Users */}
              {directory.deactivatedUsers && directory.deactivatedUsers.length > 0 && (
                <div className="p-5 rounded-xl border-2 bg-gradient-to-br from-gray-500/5 to-slate-500/5 border-gray-500/20">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Deactivated Users ({directory.deactivatedUsers.length})
                  </h5>
                  <div className="space-y-2">
                    {directory.deactivatedUsers.map((user: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-background/50 border border-muted">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{user.name}</div>
                            {user.phone && <div className="text-sm text-muted-foreground">{user.phone}</div>}
                            {user.email && <div className="text-sm text-muted-foreground">{user.email}</div>}
                          </div>
                          <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-600">Deactivated</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Glass>
      )}
      
      {/* Health Score Breakdown */}
      {healthScore?.breakdown && healthScore.breakdown.length > 0 && (
        <Glass className="p-6 border-2">
          <button
            onClick={() => toggleSection('breakdown')}
            className="w-full flex items-center justify-between mb-4 p-3 -m-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <h4 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" style={{ color: accentColor }} />
              Health Score Breakdown
            </h4>
            {expandedSections.breakdown ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          
          {expandedSections.breakdown && (
            <div className="p-5 rounded-xl border-2 bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
              <div className="space-y-3">
                {healthScore.breakdown.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                    <span className="capitalize text-sm">{item.metric.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{item.value}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="font-semibold">{item.score}/100</span>
                      <span className="text-xs text-muted-foreground">({item.weight * 100}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Glass>
      )}
    </div>
  );
}

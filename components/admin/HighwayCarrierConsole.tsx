"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Activity,
    AlertCircle,
    Calendar,
    CheckCircle2,
    ExternalLink,
    Globe,
    Loader2,
    RefreshCw,
    Search,
    Shield,
    TrendingUp,
    Truck,
    XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface HighwayCarrierData {
  mc_number: string;
  carrier_name: string;
  carrier_url: string;
  carrier_id: string;
  scraped_at: string;
  data: {
    carrierName: string;
    totalCrashes24Months: string | number;
    mcs150PowerUnits: string | number;
    highwayObservedUnits: string | number;
    inspectionCount: string | number;
    fmcsaDate: string;
    authorityAge: string;
    oosGaps: string;
    crashIndicator: string;
    driverFitness: string;
    hos: string;
    drugAlcohol: string;
    unsafeDriving: string;
    vehicleMaintenance: string;
    oosDriverFitness: string;
    oosVehiclesFitness: string;
    bluewireScore: string;
    [key: string]: any; // Allow additional fields
  };
}

interface HighwayCarrierConsoleProps {
  mcNumber: string;
  carrierName?: string;
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
}

export function HighwayCarrierConsole({
  mcNumber,
  carrierName,
  isOpen,
  onClose,
  accentColor = "#3b82f6"
}: HighwayCarrierConsoleProps) {
  const [step, setStep] = useState<'login' | 'search' | 'select' | 'scraping' | 'complete' | 'manual-search'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [carrierData, setCarrierData] = useState<HighwayCarrierData | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [scrapingProgress, setScrapingProgress] = useState<string>('');

  // Check if data already exists for this MC
  useEffect(() => {
    if (isOpen && mcNumber) {
      checkExistingData();
    }
  }, [isOpen, mcNumber]);

  // Auto-proceed if cookies are available (separate effect to avoid dependency issues)
  useEffect(() => {
    if (isOpen && mcNumber && step === 'login') {
      checkForStoredCookies().then(hasCookies => {
        if (hasCookies) {
          // Automatically proceed to search if cookies are available
          setTimeout(() => {
            setStep('search');
            handleSearch();
          }, 500);
        }
      });
    }
  }, [isOpen, mcNumber, step]);

  const checkExistingData = async () => {
    try {
      const response = await fetch(`/api/admin/highway-carrier?mc=${encodeURIComponent(mcNumber)}`);
      const data = await response.json();
      
      if (data.ok && data.data) {
        setCarrierData(data.data);
        setStep('complete');
      } else {
        setStep('login');
      }
    } catch (error) {
      console.error('Error checking existing data:', error);
      setStep('login');
    }
  };

  const [showCookieExtractor, setShowCookieExtractor] = useState(false);
  const [cookieBookmarklet, setCookieBookmarklet] = useState('');

  useEffect(() => {
    // Generate bookmarklet code using Playwright's storageState format
    // This extracts cookies, localStorage, and sessionStorage (industry standard approach)
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    
    // Build bookmarklet with proper escaping - use string concatenation to avoid template literal issues
    const bookmarklet = 'javascript:(function(){' +
      'try{' +
      'alert("Starting cookie extraction...");' +
      'var cookies=document.cookie.split(";").map(function(c){' +
      'var parts=c.trim().split("=");' +
      'var name=parts[0].trim();' +
      'var value=parts.slice(1).join("=").trim();' +
      'return{' +
      'name:name,' +
      'value:value,' +
      'domain:window.location.hostname.replace(/^www\\./,""),' +
      'path:"/",' +
      'expires:-1,' +
      'httpOnly:false,' +
      'secure:window.location.protocol==="https:",' +
      'sameSite:"Lax"' +
      '};' +
      '}).filter(function(c){return c.name&&c.value&&c.name.length>0;});' +
      'var localStorageData={};' +
      'for(var i=0;i<localStorage.length;i++){' +
      'var key=localStorage.key(i);' +
      'if(key){localStorageData[key]=localStorage.getItem(key);}' +
      '}' +
      'var sessionStorageData={};' +
      'for(var j=0;j<sessionStorage.length;j++){' +
      'var skey=sessionStorage.key(j);' +
      'if(skey){sessionStorageData[skey]=sessionStorage.getItem(skey);}' +
      '}' +
      'console.log("Extracted:",{cookies:cookies.length,localStorage:Object.keys(localStorageData).length,sessionStorage:Object.keys(sessionStorageData).length});' +
      'if(cookies.length===0&&Object.keys(localStorageData).length===0){' +
      'alert("❌ No authentication data found. Make sure you are logged into Highway.com");' +
      'return;' +
      '}' +
      'var storageState={' +
      'cookies:cookies,' +
      'origins:[{' +
      'origin:window.location.origin,' +
      'localStorage:[{' +
      'name:"highway_storage",' +
      'value:JSON.stringify({' +
      'localStorage:localStorageData,' +
      'sessionStorage:sessionStorageData,' +
      'extractedAt:new Date().toISOString(),' +
      'url:window.location.href' +
      '})' +
      '}]' +
      '}]' +
      '};' +
      'var simplifiedData={' +
      'cookies:cookies,' +
      'localStorage:localStorageData,' +
      'sessionStorage:sessionStorageData,' +
      'extractedAt:new Date().toISOString(),' +
      'url:window.location.href' +
      '};' +
      'console.log("Storage state prepared:",storageState);' +
      'var minimalData={extractedAt:simplifiedData.extractedAt,url:simplifiedData.url,cookieCount:cookies.length,localStorageCount:Object.keys(localStorageData).length};' +
      'try{' +
      'localStorage.setItem("highway_cookies_minimal",JSON.stringify(minimalData));' +
      'console.log("✅ Stored minimal data in localStorage");' +
      '}catch(e){' +
      'console.warn("Could not store in localStorage (quota exceeded):",e.message);' +
      'console.log("This is OK - data will be stored via clipboard instead");' +
      '}' +
      'var storageStateJson=JSON.stringify({storageState:storageState,simplified:simplifiedData});' +
      'function copyToClipboard(text){' +
      'if(navigator.clipboard&&window.isSecureContext){' +
      'return navigator.clipboard.writeText(text).catch(function(err){' +
      'console.warn("Clipboard API failed:",err);' +
      'return fallbackCopy(text);' +
      '});' +
      '}else{' +
      'return fallbackCopy(text);' +
      '}' +
      '}' +
      'function fallbackCopy(text){' +
      'var textarea=document.createElement("textarea");' +
      'textarea.value=text;' +
      'textarea.style.position="fixed";' +
      'textarea.style.left="-999999px";' +
      'textarea.style.top="-999999px";' +
      'document.body.appendChild(textarea);' +
      'textarea.focus();' +
      'textarea.select();' +
      'try{' +
      'var successful=document.execCommand("copy");' +
      'document.body.removeChild(textarea);' +
      'if(successful){' +
      'return Promise.resolve();' +
      '}else{' +
      'return Promise.reject(new Error("execCommand copy failed"));' +
      '}' +
      '}catch(err){' +
      'document.body.removeChild(textarea);' +
      'return Promise.reject(err);' +
      '}' +
      '}' +
      'window.focus();' +
      'setTimeout(function(){' +
      'copyToClipboard(storageStateJson).then(function(){' +
      'alert("✅ Highway authentication state extracted! ("+cookies.length+" cookies, "+Object.keys(localStorageData).length+" localStorage items)\\n\\n📋 Data copied to clipboard!\\n\\nGo back to your app and paste it in the Paste Data field.");' +
      'console.log("✅ Data copied to clipboard");' +
      '}).catch(function(err){' +
      'console.error("All copy methods failed:",err);' +
      'var message="✅ Data extracted! ("+cookies.length+" cookies)\\n\\n⚠️ Could not copy to clipboard automatically.\\n\\nPlease copy the data from the console log below.";' +
      'alert(message);' +
      'console.log("=== COPY THIS DATA ===");' +
      'console.log(storageStateJson);' +
      'console.log("=== END OF DATA ===");' +
      'prompt("Copy this data:",storageStateJson);' +
      '});' +
      '},100);' +
      '}catch(error){' +
      'console.error("Bookmarklet error:",error);' +
      'alert("❌ Error extracting authentication state: "+error.message);' +
      '}' +
      '})();';
    
    setCookieBookmarklet(bookmarklet);
  }, []);

  const handleStartProcess = () => {
    // Check if cookies are already stored
    checkForStoredCookies().then(hasCookies => {
      if (hasCookies) {
        // Cookies exist, proceed directly to search
        handleLoggedIn();
      } else {
        // Show cookie extractor instructions
        setShowCookieExtractor(true);
      }
    });
  };

  const checkForStoredCookies = async (): Promise<boolean> => {
    try {
      // Check localStorage for minimal indicator (just metadata, not full data)
      const localMinimal = localStorage.getItem('highway_cookies_minimal');
      const localCookies = localStorage.getItem('highway_cookies'); // Legacy support
      console.log('Checking localStorage:', {
        minimal: localMinimal ? 'Found' : 'Not found',
        legacy: localCookies ? 'Found' : 'Not found'
      });
      
      // Check minimal data (new format - just metadata to know cookies were extracted)
      if (localMinimal) {
        try {
          const data = JSON.parse(localMinimal);
          if (data.extractedAt) {
            const extractedAt = new Date(data.extractedAt);
            const daysSince = (Date.now() - extractedAt.getTime()) / (1000 * 60 * 60 * 24);
            console.log(`Minimal data extracted ${daysSince.toFixed(2)} days ago, ${data.cookieCount || 0} cookies`);
            
            if (daysSince < 7 && data.cookieCount > 0) {
              console.log('✅ Found minimal data in localStorage (cookies were extracted)');
              // Continue to check server for full data
            }
          }
        } catch (e) {
          console.error('Error parsing minimal data:', e);
        }
      }
      
      // Legacy support - check old format if it exists
      if (localCookies) {
        try {
          const data = JSON.parse(localCookies);
          if (data.extractedAt) {
            const extractedAt = new Date(data.extractedAt);
            const daysSince = (Date.now() - extractedAt.getTime()) / (1000 * 60 * 60 * 24);
            console.log(`Legacy data extracted ${daysSince.toFixed(2)} days ago`);
            
            if (daysSince < 7 && data.cookies && data.cookies.length > 0) {
              console.log('✅ Found valid legacy data in localStorage');
              // Continue to check server for full data
            }
          }
        } catch (parseError) {
          console.error('Error parsing legacy localStorage data:', parseError);
        }
      }

      // Check server
      console.log('Checking server for cookies...');
      const response = await fetch('/api/admin/highway-cookies/get');
      const data = await response.json();
      console.log('Server response:', data);
      
      if (data.ok && data.cookies && Array.isArray(data.cookies) && data.cookies.length > 0) {
        if (data.extractedAt) {
          const extractedAt = new Date(data.extractedAt);
          const daysSince = (Date.now() - extractedAt.getTime()) / (1000 * 60 * 60 * 24);
          console.log(`Server cookies extracted ${daysSince.toFixed(2)} days ago`);
          
          if (daysSince < 7) {
            console.log('✅ Found valid cookies on server');
            return true;
          } else {
            console.log('⚠️ Server cookies are expired');
          }
        } else {
          // If no extractedAt, assume valid
          console.log('✅ Found cookies on server (no expiration check)');
          return true;
        }
      } else {
        console.log('❌ No cookies found on server:', data.error || 'Unknown error');
      }

      return false;
    } catch (error) {
      console.error('Error checking for stored cookies:', error);
      return false;
    }
  };

  const handleExtractCookies = () => {
    // Open Highway in new window with instructions
    const highwayUrl = "https://highway.com/broker/carriers/global-search";
    const newWindow = window.open(highwayUrl, '_blank', 'width=1200,height=800');
    
    toast.info(
      'Once logged into Highway, drag the "Extract Cookies" button to your bookmarks bar, then click it on the Highway page.',
      { duration: 10000 }
    );
  };

  const handleLoggedIn = () => {
    setStep('search');
    // Trigger search
    handleSearch();
  };

  const handleSearch = async () => {
    setIsLoading(true);
    setScrapingProgress('Searching for carrier...');
    
    try {
      const response = await fetch('/api/admin/highway-scrape/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcNumber })
      });
      
      const data = await response.json();
      
      if (data.requiresManualSearch) {
        // Highway requires authentication - guide user to manual search
        setStep('manual-search');
        toast.info('Please search for the carrier manually in Highway and provide the carrier URL');
        return;
      }
      
      if (data.ok && data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setStep('select');
        setScrapingProgress('');
      } else {
        toast.error(data.error || 'No carriers found for this MC number');
        setStep('search');
      }
    } catch (error: any) {
      toast.error('Failed to search for carrier: ' + error.message);
      setStep('search');
    } finally {
      setIsLoading(false);
    }
  };
  
  const [manualCarrierUrl, setManualCarrierUrl] = useState('');
  const [manualCarrierId, setManualCarrierId] = useState('');
  
  const handleManualCarrierSubmit = async () => {
    if (!manualCarrierUrl && !manualCarrierId) {
      toast.error('Please provide either a carrier URL or carrier ID');
      return;
    }
    
    let carrierId = manualCarrierId;
    let carrierUrl = manualCarrierUrl;
    
    // Extract carrier ID from URL if URL provided
    if (carrierUrl && !carrierId) {
      const match = carrierUrl.match(/\/broker\/carriers\/(\d+)/);
      if (match) {
        carrierId = match[1];
        if (!carrierUrl.startsWith('http')) {
          carrierUrl = `https://highway.com${carrierUrl}`;
        }
      } else {
        toast.error('Invalid carrier URL. Please provide a URL like: https://highway.com/broker/carriers/154445');
        return;
      }
    } else if (carrierId && !carrierUrl) {
      carrierUrl = `https://highway.com/broker/carriers/${carrierId}`;
    }
    
    if (!carrierId) {
      toast.error('Could not extract carrier ID from URL');
      return;
    }
    
    // Proceed to scraping with the provided carrier info
    setSelectedCarrierId(carrierId);
    setStep('scraping');
    setIsLoading(true);
    setScrapingProgress('Scraping carrier data...');
    
    try {
      const response = await fetch('/api/admin/highway-scrape/carrier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mcNumber,
          carrierId,
          carrierUrl
        })
      });
      
      const data = await response.json();
      
      if (data.ok && data.data) {
        setCarrierData(data.data);
        setStep('complete');
        toast.success('Carrier data scraped and cached successfully!');
      } else {
        throw new Error(data.error || 'Failed to scrape carrier data');
      }
    } catch (error: any) {
      toast.error('Failed to scrape carrier: ' + error.message);
      setStep('manual-search');
    } finally {
      setIsLoading(false);
      setScrapingProgress('');
    }
  };

  const handleSelectCarrier = async (carrierId: string, carrierUrl: string) => {
    setSelectedCarrierId(carrierId);
    setStep('scraping');
    setIsLoading(true);
    setScrapingProgress('Scraping carrier data...');
    
    try {
      const response = await fetch('/api/admin/highway-scrape/carrier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mcNumber,
          carrierId,
          carrierUrl
        })
      });
      
      const data = await response.json();
      
      if (data.ok && data.data) {
        setCarrierData(data.data);
        setStep('complete');
        toast.success('Carrier data scraped and cached successfully!');
      } else {
        throw new Error(data.error || 'Failed to scrape carrier data');
      }
    } catch (error: any) {
      toast.error('Failed to scrape carrier: ' + error.message);
      setStep('select');
    } finally {
      setIsLoading(false);
      setScrapingProgress('');
    }
  };

  const handleRefresh = async () => {
    if (!carrierData) return;
    
    setIsLoading(true);
    setScrapingProgress('Refreshing carrier data...');
    
    try {
      const response = await fetch('/api/admin/highway-scrape/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mcNumber,
          carrierId: carrierData.carrier_id,
          carrierUrl: carrierData.carrier_url
        })
      });
      
      const data = await response.json();
      
      if (data.ok && data.data) {
        setCarrierData(data.data);
        toast.success('Carrier data refreshed!');
      } else {
        throw new Error(data.error || 'Failed to refresh carrier data');
      }
    } catch (error: any) {
      toast.error('Failed to refresh: ' + error.message);
    } finally {
      setIsLoading(false);
      setScrapingProgress('');
    }
  };

  const formatValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === "") return "N/A";
    return String(value);
  };

  const getStatusBadge = (value: string, threshold: number, isLowerBetter: boolean = false) => {
    if (!value || value.trim() === "") return null;
    
    const match = value.match(/(\d+\.?\d*)/);
    if (!match) return null;
    
    const num = parseFloat(match[1]);
    const isOver = value.toUpperCase().includes("OVER");
    const isOK = value.toUpperCase().includes("OK");
    
    if (isOver) {
      return (
        <Badge variant="destructive" className="ml-2">
          <XCircle className="h-3 w-3 mr-1" />
          OVER
        </Badge>
      );
    }
    if (isOK || (isLowerBetter ? num <= threshold : num <= threshold)) {
      return (
        <Badge variant="default" className="ml-2 bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          OK
        </Badge>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" style={{ color: accentColor }} />
            Highway Carrier Health - MC {mcNumber}
            {carrierName && (
              <span className="text-sm font-normal text-muted-foreground">
                ({carrierName})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'login' && (
          <div className="space-y-6">
            {!showCookieExtractor ? (
              <Glass className="p-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div 
                      className="p-4 rounded-full"
                      style={{ backgroundColor: `${accentColor}15` }}
                    >
                      <Globe className="h-8 w-8" style={{ color: accentColor }} />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold">Connect to Highway</h3>
                  <p className="text-muted-foreground">
                    Checking for stored authentication...
                  </p>
                  <Button
                    onClick={handleStartProcess}
                    size="lg"
                    style={{ backgroundColor: accentColor }}
                    className="mt-4"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Start Health Check
                  </Button>
                </div>
              </Glass>
            ) : (
              <Glass className="p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="flex justify-center mb-4">
                      <div 
                        className="p-4 rounded-full"
                        style={{ backgroundColor: `${accentColor}15` }}
                      >
                        <Shield className="h-8 w-8" style={{ color: accentColor }} />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Extract Highway Cookies</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      To enable automatic authentication, extract your Highway cookies once. This only needs to be done once per week.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-2">Step 1: Go to Highway</p>
                      <Button
                        onClick={handleExtractCookies}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Highway (Login if needed)
                      </Button>
                    </div>
                    
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-2">Step 2: Extract Cookies</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Copy the bookmarklet code below, then create a bookmark with it:
                      </p>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={cookieBookmarklet}
                            readOnly
                            className="text-xs font-mono flex-1"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(cookieBookmarklet);
                                toast.success('Bookmarklet code copied to clipboard!');
                              } catch (error) {
                                // Fallback for older browsers
                                const textArea = document.createElement('textarea');
                                textArea.value = cookieBookmarklet;
                                textArea.style.position = 'fixed';
                                textArea.style.opacity = '0';
                                document.body.appendChild(textArea);
                                textArea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textArea);
                                toast.success('Bookmarklet code copied!');
                              }
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>Instructions:</strong></p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Right-click your bookmarks bar and select "Add page" or "New bookmark"</li>
                            <li>Name it "Extract Highway Cookies"</li>
                            <li>Paste the copied code into the URL field</li>
                            <li>Save the bookmark</li>
                            <li>Go to Highway.com and click the bookmark</li>
                          </ol>
                        </div>
                        <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
                          <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">💡 Quick Test:</p>
                          <p className="text-muted-foreground mb-2">
                            To test if the bookmarklet works, copy the code above, go to Highway.com, open the browser console (F12), paste it, and press Enter.
                          </p>
                          <p className="text-muted-foreground">
                            You should see an alert saying "Starting cookie extraction..." if it's working.
                          </p>
                        </div>
                        <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs">
                          <p className="font-semibold text-yellow-600 dark:text-yellow-400 mb-1">⚠️ Troubleshooting:</p>
                          <p className="text-muted-foreground mb-1">
                            If clicking the bookmark does nothing:
                          </p>
                          <ol className="list-decimal list-inside mt-1 space-y-1 text-muted-foreground">
                            <li>Make sure you're on Highway.com (not a different domain)</li>
                            <li>Check browser console (F12) for errors</li>
                            <li>Try pasting the code directly in the console instead</li>
                            <li>Some browsers block bookmarklets - try a different browser</li>
                            <li>Make sure the bookmark URL starts with "javascript:"</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-2">Step 3: Paste Data</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        The bookmarklet copied data to your clipboard. Paste it here:
                      </p>
                      <div className="space-y-2">
                        <Input
                          id="paste-storage-state"
                          placeholder="Paste the storageState JSON here (Ctrl+V / Cmd+V)"
                          className="text-xs font-mono"
                          onPaste={async (e) => {
                            try {
                              const pastedText = e.clipboardData.getData('text');
                              const data = JSON.parse(pastedText);
                              
                              const response = await fetch('/api/admin/highway-cookies/store', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data),
                                credentials: 'include'
                              });
                              
                              const result = await response.json();
                              
                              if (result.ok) {
                                toast.success(`✅ Data stored! (${result.cookieCount} cookies)`);
                                (e.target as HTMLInputElement).value = '';
                                setTimeout(() => {
                                  handleLoggedIn();
                                }, 500);
                              } else {
                                toast.error('Failed to store: ' + (result.error || 'Unknown error'));
                              }
                            } catch (error: any) {
                              toast.error('Invalid data format: ' + error.message);
                            }
                          }}
                        />
                        <Button
                          onClick={async () => {
                            const input = document.getElementById('paste-storage-state') as HTMLInputElement;
                            if (!input?.value) {
                              toast.error('Please paste the data first');
                              return;
                            }
                            
                            try {
                              const data = JSON.parse(input.value);
                              const response = await fetch('/api/admin/highway-cookies/store', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data),
                                credentials: 'include'
                              });
                              
                              const result = await response.json();
                              
                              if (result.ok) {
                                toast.success(`✅ Data stored! (${result.cookieCount} cookies)`);
                                input.value = '';
                                setTimeout(() => {
                                  handleLoggedIn();
                                }, 500);
                              } else {
                                toast.error('Failed to store: ' + (result.error || 'Unknown error'));
                              }
                            } catch (error: any) {
                              toast.error('Invalid data format: ' + error.message);
                            }
                          }}
                          size="sm"
                          className="w-full"
                          style={{ backgroundColor: accentColor }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Store Pasted Data
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => setShowCookieExtractor(false)}
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                  >
                    Back
                  </Button>
                </div>
              </Glass>
            )}
          </div>
        )}

        {step === 'search' && (
          <div className="space-y-6">
            <Glass className="p-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: accentColor }} />
                <h3 className="text-xl font-semibold">Searching for Carrier</h3>
                <p className="text-muted-foreground">
                  Searching Highway for MC {mcNumber}...
                </p>
                {scrapingProgress && (
                  <p className="text-sm text-muted-foreground">{scrapingProgress}</p>
                )}
              </div>
            </Glass>
          </div>
        )}

        {step === 'manual-search' && (
          <div className="space-y-6">
            <Glass className="p-6">
              <div className="text-center space-y-4 mb-6">
                <div className="flex justify-center">
                  <div 
                    className="p-4 rounded-full"
                    style={{ backgroundColor: `${accentColor}15` }}
                  >
                    <Search className="h-8 w-8" style={{ color: accentColor }} />
                  </div>
                </div>
                <h3 className="text-xl font-semibold">Manual Carrier Search</h3>
                <p className="text-muted-foreground">
                  Highway requires authentication. Please search for MC {mcNumber} in your browser, then provide the carrier URL or ID below.
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="carrier-url">Carrier URL</Label>
                  <Input
                    id="carrier-url"
                    placeholder="https://highway.com/broker/carriers/154445"
                    value={manualCarrierUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualCarrierUrl(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Or provide just the carrier ID below
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="carrier-id">Carrier ID</Label>
                  <Input
                    id="carrier-id"
                    placeholder="154445"
                    value={manualCarrierId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualCarrierId(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The numeric ID from the carrier URL
                  </p>
                </div>
                
                <Button
                  onClick={handleManualCarrierSubmit}
                  disabled={isLoading || (!manualCarrierUrl && !manualCarrierId)}
                  size="lg"
                  className="w-full"
                  style={{ backgroundColor: accentColor }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Scrape Carrier Data
                    </>
                  )}
                </Button>
              </div>
            </Glass>
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-6">
            <Glass className="p-6">
              <h3 className="text-lg font-semibold mb-4">Select Carrier</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Multiple carriers found for MC {mcNumber}. Please select the correct one:
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <Card 
                    key={index}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleSelectCarrier(result.id, result.url)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{result.name}</p>
                          <p className="text-sm text-muted-foreground">MC: {result.mc}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCarrier(result.id, result.url);
                          }}
                        >
                          Select
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Glass>
          </div>
        )}

        {step === 'scraping' && (
          <div className="space-y-6">
            <Glass className="p-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: accentColor }} />
                <h3 className="text-xl font-semibold">Scraping Carrier Data</h3>
                <p className="text-muted-foreground">
                  {scrapingProgress || 'Please wait while we scrape the carrier information...'}
                </p>
              </div>
            </Glass>
          </div>
        )}

        {step === 'complete' && carrierData && (
          <div className="space-y-6">
            {/* Header with actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-sm">
                  MC: {carrierData.mc_number}
                </Badge>
                <Badge variant="outline" className="text-sm">
                  Last Updated: {new Date(carrierData.scraped_at).toLocaleString()}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  style={{ backgroundColor: accentColor }}
                  className="font-semibold"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Update Health
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(carrierData.carrier_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Highway
                </Button>
              </div>
            </div>

            {/* Carrier Info */}
            <Glass className="p-6">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" style={{ color: accentColor }} />
                  {carrierData.data.carrierName || carrierData.carrier_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Overview Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Crashes (24mo)</span>
                    </div>
                    <p className="text-lg font-semibold">{formatValue(carrierData.data.totalCrashes24Months)}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Power Units</span>
                    </div>
                    <p className="text-lg font-semibold">{formatValue(carrierData.data.mcs150PowerUnits)}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Observed Units</span>
                    </div>
                    <p className="text-lg font-semibold">{formatValue(carrierData.data.highwayObservedUnits)}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Inspections</span>
                    </div>
                    <p className="text-lg font-semibold">{formatValue(carrierData.data.inspectionCount)}</p>
                  </div>
                </div>

                {/* Authority & Compliance */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Authority & Compliance
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">FMCSA Date</span>
                      <p className="font-medium">{formatValue(carrierData.data.fmcsaDate)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Authority Age</span>
                      <p className="font-medium">{formatValue(carrierData.data.authorityAge)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">OOS Gaps</span>
                      <div className="flex items-center">
                        <p className="font-medium">{formatValue(carrierData.data.oosGaps)}</p>
                        {carrierData.data.oosGaps === "Yes" && (
                          <Badge variant="default" className="ml-2 bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Good
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BASIC Scores */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    BASIC Scores
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Crash Indicator (65% Limit)</span>
                        {getStatusBadge(carrierData.data.crashIndicator, 65)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatValue(carrierData.data.crashIndicator)}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Driver Fitness (80% Limit)</span>
                        {getStatusBadge(carrierData.data.driverFitness, 80)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatValue(carrierData.data.driverFitness)}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">HOS Compliance (65% Limit)</span>
                        {getStatusBadge(carrierData.data.hos, 65)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatValue(carrierData.data.hos)}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Drug & Alcohol (0% Limit)</span>
                        {getStatusBadge(carrierData.data.drugAlcohol, 0)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatValue(carrierData.data.drugAlcohol)}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Unsafe Driving (65% Limit)</span>
                        {getStatusBadge(carrierData.data.unsafeDriving, 65)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatValue(carrierData.data.unsafeDriving)}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Vehicle Maintenance (80% Limit)</span>
                        {getStatusBadge(carrierData.data.vehicleMaintenance, 80)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatValue(carrierData.data.vehicleMaintenance)}</p>
                    </div>
                  </div>
                </div>

                {/* Out of Service Percentages */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Out of Service Percentages
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <span className="text-sm font-medium">Driver Fitness OOS% (10% Limit)</span>
                      <div className="flex items-center mt-1">
                        <p className="text-lg font-semibold">{formatValue(carrierData.data.oosDriverFitness)}%</p>
                        {parseFloat(carrierData.data.oosDriverFitness || "0") <= 10 ? (
                          <Badge variant="default" className="ml-2 bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="ml-2">
                            <XCircle className="h-3 w-3 mr-1" />
                            OVER
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <span className="text-sm font-medium">Vehicles Fitness OOS% (30% Limit)</span>
                      <div className="flex items-center mt-1">
                        <p className="text-lg font-semibold">{formatValue(carrierData.data.oosVehiclesFitness)}%</p>
                        {parseFloat(carrierData.data.oosVehiclesFitness || "0") <= 30 ? (
                          <Badge variant="default" className="ml-2 bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="ml-2">
                            <XCircle className="h-3 w-3 mr-1" />
                            OVER
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BlueWire Score */}
                {carrierData.data.bluewireScore && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">BlueWire Score</span>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                          {formatValue(carrierData.data.bluewireScore)}
                        </p>
                      </div>
                      <Shield className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Glass>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


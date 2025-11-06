"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle, Activity, Shield, Truck, Calendar, TrendingUp } from "lucide-react";

interface CarrierHealthData {
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
}

interface CarrierHealthCardProps {
  healthData: CarrierHealthData;
  mcNumber: string;
}

function getStatusBadge(value: string, threshold: number, isLowerBetter: boolean = false) {
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
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "N/A";
  return String(value);
}

export function CarrierHealthCard({ healthData, mcNumber }: CarrierHealthCardProps) {
  return (
    <Card className="w-full max-w-4xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Carrier Health Report
          </CardTitle>
          <Badge variant="outline" className="text-sm">
            MC: {mcNumber}
          </Badge>
        </div>
        {healthData.carrierName && (
          <p className="text-sm text-muted-foreground mt-2">
            {healthData.carrierName}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Crashes (24mo)</span>
            </div>
            <p className="text-lg font-semibold">{formatValue(healthData.totalCrashes24Months)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Power Units</span>
            </div>
            <p className="text-lg font-semibold">{formatValue(healthData.mcs150PowerUnits)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Observed Units</span>
            </div>
            <p className="text-lg font-semibold">{formatValue(healthData.highwayObservedUnits)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Inspections</span>
            </div>
            <p className="text-lg font-semibold">{formatValue(healthData.inspectionCount)}</p>
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
              <p className="font-medium">{formatValue(healthData.fmcsaDate)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Authority Age</span>
              <p className="font-medium">{formatValue(healthData.authorityAge)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">OOS Gaps</span>
              <div className="flex items-center">
                <p className="font-medium">{formatValue(healthData.oosGaps)}</p>
                {healthData.oosGaps === "Yes" && (
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
                {getStatusBadge(healthData.crashIndicator, 65)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatValue(healthData.crashIndicator)}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Driver Fitness (80% Limit)</span>
                {getStatusBadge(healthData.driverFitness, 80)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatValue(healthData.driverFitness)}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">HOS Compliance (65% Limit)</span>
                {getStatusBadge(healthData.hos, 65)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatValue(healthData.hos)}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Drug & Alcohol (0% Limit)</span>
                {getStatusBadge(healthData.drugAlcohol, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatValue(healthData.drugAlcohol)}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Unsafe Driving (65% Limit)</span>
                {getStatusBadge(healthData.unsafeDriving, 65)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatValue(healthData.unsafeDriving)}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Vehicle Maintenance (80% Limit)</span>
                {getStatusBadge(healthData.vehicleMaintenance, 80)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatValue(healthData.vehicleMaintenance)}</p>
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
                <p className="text-lg font-semibold">{formatValue(healthData.oosDriverFitness)}%</p>
                {parseFloat(healthData.oosDriverFitness || "0") <= 10 && (
                  <Badge variant="default" className="ml-2 bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    OK
                  </Badge>
                )}
                {parseFloat(healthData.oosDriverFitness || "0") > 10 && (
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
                <p className="text-lg font-semibold">{formatValue(healthData.oosVehiclesFitness)}%</p>
                {parseFloat(healthData.oosVehiclesFitness || "0") <= 30 && (
                  <Badge variant="default" className="ml-2 bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    OK
                  </Badge>
                )}
                {parseFloat(healthData.oosVehiclesFitness || "0") > 30 && (
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
        {healthData.bluewireScore && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">BlueWire Score</span>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                  {formatValue(healthData.bluewireScore)}
                </p>
              </div>
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


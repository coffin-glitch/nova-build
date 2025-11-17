/**
 * Carrier Health Score Calculator
 * Calculates health scores based on thresholds and parsed data
 */

import sql from "@/lib/db";

export interface HealthThreshold {
  metric_name: string;
  metric_type: 'numeric' | 'boolean' | 'enum' | 'text';
  thresholds: {
    excellent?: number;
    good?: number;
    fair?: number;
    poor?: number;
    [key: string]: number | undefined;
  };
  weight: number;
  rules?: Record<string, unknown>;
  description?: string;
}

export interface HealthScoreResult {
  score: number; // 0-100
  status: 'Good' | 'Decent' | 'Okay' | 'Review';
  breakdown: Array<{
    metric: string;
    value: string | number;
    score: number;
    weight: number;
    contribution: number;
  }>;
}

/**
 * Get all active thresholds from database
 */
export async function getHealthThresholds(): Promise<HealthThreshold[]> {
  try {
    const result = await sql`
      SELECT 
        metric_name,
        metric_type,
        thresholds,
        weight,
        rules
      FROM carrier_health_thresholds
      WHERE is_active = true
      ORDER BY weight DESC
    `;
    
    return result.map((row: any) => ({
      metric_name: row.metric_name,
      metric_type: row.metric_type,
      thresholds: row.thresholds as HealthThreshold['thresholds'],
      weight: row.weight,
      rules: row.rules,
    }));
  } catch (error) {
    console.error('Error fetching health thresholds:', error);
    return [];
  }
}

/**
 * Calculate health score based on parsed data and thresholds
 * New scoring system:
 * - Bluewire Score: >70 = Good, >65 = Decent, >60 = Okay, <60 = Review
 * - More power units = better score
 * - Less crashes in last 24 months = better score
 * - Better driver fitness score = better score
 */
export async function calculateHealthScore(
  parsedData: {
    bluewireScore?: number;
    connectionStatus?: string;
    assessmentStatus?: string;
    dotStatus?: string;
    safetyRating?: string;
    powerUnits?: number;
    crashes?: { count24Months?: number };
    safety?: { driverFitness?: { score?: string; percentile?: string } };
    [key: string]: any;
  }
): Promise<HealthScoreResult> {
  const breakdown: HealthScoreResult['breakdown'] = [];
  let totalWeight = 0;
  let weightedScore = 0;
  
  // 1. Bluewire Score (40% weight) - Primary metric
  if (parsedData.bluewireScore !== undefined && parsedData.bluewireScore !== null) {
    let bluewireScore = 0;
    let bluewireStatus = 'Review';
    
    if (parsedData.bluewireScore > 70) {
      bluewireScore = 100;
      bluewireStatus = 'Good';
    } else if (parsedData.bluewireScore > 65) {
      bluewireScore = 80;
      bluewireStatus = 'Decent';
    } else if (parsedData.bluewireScore > 60) {
      bluewireScore = 60;
      bluewireStatus = 'Okay';
    } else {
      bluewireScore = 30;
      bluewireStatus = 'Review';
    }
    
    const contribution = (bluewireScore * 40) / 100;
    breakdown.push({
      metric: 'bluewire_score',
      value: parsedData.bluewireScore,
      score: bluewireScore,
      weight: 40,
      contribution: contribution,
    });
    weightedScore += contribution;
    totalWeight += 40;
  }
  
  // 2. Power Units (20% weight) - More units = better
  if (parsedData.powerUnits !== undefined && parsedData.powerUnits !== null) {
    let unitsScore = 0;
    if (parsedData.powerUnits >= 500) unitsScore = 100;
    else if (parsedData.powerUnits >= 200) unitsScore = 85;
    else if (parsedData.powerUnits >= 100) unitsScore = 70;
    else if (parsedData.powerUnits >= 50) unitsScore = 55;
    else if (parsedData.powerUnits >= 25) unitsScore = 40;
    else unitsScore = 25;
    
    const contribution = (unitsScore * 20) / 100;
    breakdown.push({
      metric: 'power_units',
      value: parsedData.powerUnits,
      score: unitsScore,
      weight: 20,
      contribution: contribution,
    });
    weightedScore += contribution;
    totalWeight += 20;
  }
  
  // 3. Crashes in last 24 months (20% weight) - Less crashes = better
  const crashCount = parsedData.crashes?.count24Months || parsedData.crashCount24Months || 0;
  let crashScore = 0;
  if (crashCount === 0) crashScore = 100;
  else if (crashCount <= 2) crashScore = 80;
  else if (crashCount <= 5) crashScore = 60;
  else if (crashCount <= 10) crashScore = 40;
  else crashScore = 20;
  
  const crashContribution = (crashScore * 20) / 100;
  breakdown.push({
    metric: 'crashes_24_months',
    value: crashCount,
    score: crashScore,
    weight: 20,
    contribution: crashContribution,
  });
  weightedScore += crashContribution;
  totalWeight += 20;
  
  // 4. Driver Fitness Score (20% weight) - Better score = better
  const driverFitnessPercentile = parsedData.safety?.driverFitness?.percentile;
  let driverFitnessScore = 50; // Default
  if (driverFitnessPercentile) {
    const percentile = parseFloat(driverFitnessPercentile.replace('%', ''));
    if (!isNaN(percentile)) {
      // Lower percentile is better (0% = best, 100% = worst)
      if (percentile <= 10) driverFitnessScore = 100;
      else if (percentile <= 25) driverFitnessScore = 85;
      else if (percentile <= 50) driverFitnessScore = 70;
      else if (percentile <= 75) driverFitnessScore = 50;
      else driverFitnessScore = 30;
    }
  }
  
  const driverFitnessContribution = (driverFitnessScore * 20) / 100;
  breakdown.push({
    metric: 'driver_fitness',
    value: driverFitnessPercentile || 'N/A',
    score: driverFitnessScore,
    weight: 20,
    contribution: driverFitnessContribution,
  });
  weightedScore += driverFitnessContribution;
  totalWeight += 20;
  
  // Normalize score (0-100)
  const finalScore = totalWeight > 0 
    ? Math.round((weightedScore / totalWeight) * 100)
    : 0;
  
  // Determine status based on Bluewire score if available, otherwise use final score
  let status: HealthScoreResult['status'] = 'Review';
  const primaryScore = parsedData.bluewireScore !== undefined ? parsedData.bluewireScore : finalScore;
  
  if (primaryScore > 70) status = 'Good';
  else if (primaryScore > 65) status = 'Decent';
  else if (primaryScore > 60) status = 'Okay';
  else status = 'Review';
  
  return {
    score: finalScore,
    status,
    breakdown,
  };
}

/**
 * Get metric value from parsed data
 */
function getMetricValue(data: Record<string, any>, metricName: string): any {
  // Map metric names to data fields
  const fieldMap: Record<string, string> = {
    'bluewire_score': 'bluewireScore',
    'connection_status': 'connectionStatus',
    'assessment_status': 'assessmentStatus',
    'dot_status': 'dotStatus',
    'safety_rating': 'safetyRating',
  };
  
  const fieldName = fieldMap[metricName] || metricName;
  return data[fieldName];
}

/**
 * Calculate score for a single metric based on threshold
 */
function calculateMetricScore(value: any, threshold: HealthThreshold): number {
  if (threshold.metric_type === 'numeric') {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numValue)) return 0;
    
    // Use threshold ranges
    if (threshold.thresholds.excellent && numValue >= threshold.thresholds.excellent) return 100;
    if (threshold.thresholds.good && numValue >= threshold.thresholds.good) return 80;
    if (threshold.thresholds.fair && numValue >= threshold.thresholds.fair) return 60;
    if (threshold.thresholds.poor && numValue >= threshold.thresholds.poor) return 40;
    return 20;
  }
  
  if (threshold.metric_type === 'enum') {
    const strValue = String(value).toLowerCase();
    const thresholds = threshold.thresholds;
    
    // Check each threshold level
    for (const [key, score] of Object.entries(thresholds)) {
      if (strValue.includes(key.toLowerCase())) {
        return score as number;
      }
    }
    
    // Default based on value
    if (strValue.includes('pass') || strValue.includes('active') || strValue.includes('connected')) {
      return 100;
    }
    if (strValue.includes('partial') || strValue.includes('conditional')) {
      return 60;
    }
    if (strValue.includes('fail') || strValue.includes('inactive') || strValue.includes('not connected')) {
      return 0;
    }
    
    return 50; // Unknown
  }
  
  if (threshold.metric_type === 'boolean') {
    return value === true || value === 'true' || value === 'yes' ? 100 : 0;
  }
  
  return 50; // Default for text/unknown
}

/**
 * Update health thresholds
 */
export async function updateHealthThreshold(
  metricName: string,
  updates: Partial<HealthThreshold>
): Promise<void> {
  const thresholdsJson = updates.thresholds ? JSON.stringify(updates.thresholds) : null;
  const rulesJson = updates.rules ? JSON.stringify(updates.rules) : null;
  
  await sql`
    UPDATE carrier_health_thresholds
    SET
      thresholds = ${thresholdsJson ? sql.unsafe(`'${thresholdsJson.replace(/'/g, "''")}'::jsonb`) : null},
      weight = ${updates.weight ?? null},
      rules = ${rulesJson ? sql.unsafe(`'${rulesJson.replace(/'/g, "''")}'::jsonb`) : null},
      description = ${updates.description ?? null},
      updated_at = NOW()
    WHERE metric_name = ${metricName}
  `;
}


# 📏 Distance Threshold - Complete Explanation

## What is Distance Threshold?

**Distance Threshold** (`distance_threshold_miles`) is a setting that controls how similar a new load's distance must be to your favorite loads for it to be considered a "similar load" match.

## How It Works

### 1. **In Database Function (`find_similar_loads`)**

The distance threshold is used in the SQL function to filter loads:

```sql
-- Example: If your favorite is 300 miles and threshold is 50 miles
-- System will match loads between 250-350 miles (300 ± 50)

WHERE ABS(tb.distance_miles - fr.distance_miles) <= cp.dist_threshold
```

**Formula:**
```
|New Load Distance - Favorite Distance| ≤ Distance Threshold
```

**Example:**
- Favorite load: **300 miles**
- Distance threshold: **50 miles**
- Matches: **250-350 miles** (300 ± 50)
- Does NOT match: **200 miles** (difference = 100, > 50)

### 2. **In Similar Load Matching**

When processing similar load triggers, the system:
1. Gets your favorite loads
2. Finds new loads where: `|new_distance - favorite_distance| ≤ threshold`
3. Calculates similarity score based on how close the distances are

### 3. **Distance Threshold vs Other Distance Settings**

Your system has **THREE different distance-related settings**:

#### **A. Distance Threshold** (`distance_threshold_miles`)
- **Purpose:** How close must a load's distance be to your favorites?
- **Default:** 50 miles
- **Used for:** Similar load matching
- **Example:** Favorite = 300mi, Threshold = 50mi → Matches 250-350mi

#### **B. Min/Max Distance** (`min_distance`, `max_distance`)
- **Purpose:** Absolute distance limits (regardless of favorites)
- **Default:** 0-2000 miles
- **Used for:** Filtering out loads that are too short or too long
- **Example:** Only show loads between 100-500 miles total

#### **C. Distance Flexibility** (`distance_flexibility`)
- **Purpose:** Percentage-based variance allowance
- **Default:** 25%
- **Used for:** Advanced matching scoring
- **Example:** Favorite = 300mi, Flexibility = 25% → Matches 225-375mi (300 ± 25%)

## Is Distance Threshold Necessary?

### ✅ **YES, it's necessary for similar load matching**

**Why:**
1. **Prevents irrelevant matches:** Without it, a 50-mile favorite could match a 2000-mile load
2. **Improves match quality:** Only loads with similar distances are considered
3. **Reduces notification spam:** Carriers only get notified about loads they'd actually consider

### ⚠️ **But it's NOT used for exact matches**

**Exact match triggers** don't use distance threshold because:
- They match by **route** (origin → destination), not distance
- A PA → IL route is a match whether it's 500mi or 600mi
- Distance is irrelevant for exact route matching

## Current Settings for dukeisaac12@gmail.com

- **Distance Threshold:** 50 miles
- **Min Distance:** 0 miles
- **Max Distance:** 2000 miles
- **Distance Flexibility:** 25%

## How It Works in Practice

### Scenario 1: Similar Load Matching
```
Favorite: NILES, IL → FORT DODGE, IA (355 miles)
Threshold: 50 miles

✅ Matches:
  - CHICAGO, IL → DES MOINES, IA (340 miles) ✅ (difference: 15mi)
  - MILWAUKEE, WI → OMAHA, NE (380 miles) ✅ (difference: 25mi)

❌ Doesn't Match:
  - CHICAGO, IL → KANSAS CITY, MO (500 miles) ❌ (difference: 145mi > 50mi)
```

### Scenario 2: Exact Match (No Distance Threshold)
```
Favorite: PA → IL (any distance)
Trigger: Exact match

✅ Matches:
  - PA → IL (300 miles) ✅
  - PA → IL (600 miles) ✅
  - PA → IL (1000 miles) ✅

Distance doesn't matter - only route matters!
```

## Recommendations

### **For Similar Loads:**
- **Keep distance threshold:** 50 miles is good for most carriers
- **Adjust if needed:** 
  - Increase to 100mi if you want more matches
  - Decrease to 25mi if you want stricter matching

### **For Exact Matches:**
- **Distance threshold is ignored** - route matching only
- Use `min_distance` and `max_distance` if you want to filter by absolute distance

### **Best Practice:**
Use **both**:
- **Distance threshold** for similar load matching (flexible, relative)
- **Min/Max distance** for absolute limits (strict, absolute)

## Summary

| Setting | Purpose | Used For | Default |
|---------|---------|----------|---------|
| **Distance Threshold** | Relative distance matching | Similar loads | 50 miles |
| **Min/Max Distance** | Absolute distance limits | All notifications | 0-2000 miles |
| **Distance Flexibility** | Percentage variance | Advanced scoring | 25% |

**Distance threshold is necessary for similar load matching but NOT for exact matches.**


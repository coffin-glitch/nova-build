import { requireApiCarrier } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

// Notification trigger types
export type NotificationTriggerType = 
  | 'similar_load' 
  | 'exact_match' 
  | 'new_route'
  | 'favorite_available'
  | 'deadline_approaching';

export interface NotificationTriggerConfig {
  distanceThreshold?: number;
  statePreferences?: string[];
  equipmentPreferences?: string[];
  minDistance?: number;
  maxDistance?: number;
  priceThreshold?: number;
  timeThreshold?: number; // hours
  favoriteBidNumbers?: string[]; // Legacy - for backward compatibility
  favoriteDistanceRange?: { // New - preferred method
    minDistance: number;
    maxDistance: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const triggerType = searchParams.get("triggerType") as NotificationTriggerType;
    const isActive = searchParams.get("isActive") !== "false";

    // Get notification triggers with bid and route info for exact_match triggers
    // First get all triggers
    const triggersBase = await sql`
      SELECT 
        nt.id,
        nt.supabase_carrier_user_id,
        nt.trigger_type,
        nt.trigger_config,
        nt.is_active,
        nt.created_at,
        nt.updated_at
      FROM notification_triggers nt
      WHERE nt.supabase_carrier_user_id = ${userId}
      ${triggerType ? sql`AND nt.trigger_type = ${triggerType}` : sql``}
      ${isActive !== null ? sql`AND nt.is_active = ${isActive}` : sql``}
      ORDER BY created_at DESC
    `;

    // Enrich triggers with bid number and route
    const triggers = await Promise.all(triggersBase.map(async (trigger) => {
      // Parse trigger_config if it's a string
      let config = trigger.trigger_config;
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch (e) {
          console.error('Error parsing trigger_config:', e);
          config = {};
        }
      }
      
      // For exact_match triggers, get route info
      if (trigger.trigger_type === 'exact_match') {
        // New format: use distance range
        if (config?.favoriteDistanceRange) {
          // Find a favorite within the distance range for display
          const favoriteResult = await sql`
            SELECT cf.bid_number, tb.stops, tb.distance_miles
            FROM carrier_favorites cf
            JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
            WHERE cf.supabase_carrier_user_id = ${userId}
              AND tb.distance_miles >= ${config.favoriteDistanceRange.minDistance}
              AND tb.distance_miles <= ${config.favoriteDistanceRange.maxDistance}
            LIMIT 1
          `;
          
          return {
            ...trigger,
            trigger_config: config,
            bid_number: favoriteResult[0]?.bid_number || null,
            route: favoriteResult[0]?.stops || null,
            distance_range: config.favoriteDistanceRange
          };
        }
        
        // Legacy format: use bid numbers
        if (config?.favoriteBidNumbers?.length > 0) {
          const bidNumber = config.favoriteBidNumbers[0];
          
          // Get route for this bid
          const routeResult = await sql`
            SELECT tb.stops
            FROM carrier_favorites cf
            JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
            WHERE cf.supabase_carrier_user_id = ${userId}
              AND cf.bid_number = ${bidNumber}
            LIMIT 1
          `;
          
          return {
            ...trigger,
            trigger_config: config,
            bid_number: bidNumber,
            route: routeResult[0]?.stops || null
          };
        }
      }
      
      // For similar_load triggers, get route from config if available
      if (trigger.trigger_type === 'similar_load') {
        // New format: use distance range
        if (config?.favoriteDistanceRange) {
          const favoriteResult = await sql`
            SELECT cf.bid_number, tb.stops, tb.distance_miles
            FROM carrier_favorites cf
            JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
            WHERE cf.supabase_carrier_user_id = ${userId}
              AND tb.distance_miles >= ${config.favoriteDistanceRange.minDistance}
              AND tb.distance_miles <= ${config.favoriteDistanceRange.maxDistance}
            LIMIT 1
          `;
          
          return {
            ...trigger,
            trigger_config: config,
            bid_number: favoriteResult[0]?.bid_number || null,
            route: favoriteResult[0]?.stops || null,
            distance_range: config.favoriteDistanceRange
          };
        }
        
        // Legacy format: use bid numbers
        if (config?.favoriteBidNumbers?.length > 0) {
          const bidNumber = config.favoriteBidNumbers[0];
          
          // Get route for this bid
          const routeResult = await sql`
            SELECT tb.stops
            FROM carrier_favorites cf
            JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
            WHERE cf.supabase_carrier_user_id = ${userId}
              AND cf.bid_number = ${bidNumber}
            LIMIT 1
          `;
          
          return {
            ...trigger,
            trigger_config: config,
            bid_number: bidNumber,
            route: routeResult[0]?.stops || null
          };
        }
      }
      
      return {
        ...trigger,
        trigger_config: config
      };
    }));

    return NextResponse.json({
      ok: true,
      data: triggers
    });

  } catch (error) {
    console.error("Error fetching notification triggers:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification triggers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const { triggerType, triggerConfig, isActive = true } = body;

    if (!triggerType || !triggerConfig) {
      return NextResponse.json(
        { error: "Trigger type and config are required" },
        { status: 400 }
      );
    }

    // Validate trigger config based on type
    const validationError = validateTriggerConfig(triggerType, triggerConfig);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    // Check for duplicate state matches
    if (triggerType === 'exact_match' && triggerConfig.matchType === 'state') {
      const originState = triggerConfig.originState;
      const destinationState = triggerConfig.destinationState;
      
      if (originState && destinationState) {
        // Check if user already has a state match for this route
        const existingTriggers = await sql`
          SELECT id, trigger_config
          FROM notification_triggers
          WHERE supabase_carrier_user_id = ${userId}
            AND trigger_type = 'exact_match'
            AND is_active = true
        `;
        
        for (const existing of existingTriggers) {
          let existingConfig = existing.trigger_config;
          if (typeof existingConfig === 'string') {
            try {
              existingConfig = JSON.parse(existingConfig);
            } catch {
              continue;
            }
          }
          
          // If it's a state match with the same origin and destination states
          if (existingConfig.matchType === 'state' && 
              existingConfig.originState === originState && 
              existingConfig.destinationState === destinationState) {
            return NextResponse.json(
              { error: `You already have a state match alert for ${originState} → ${destinationState}. Please use exact match for different cities.` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Insert new notification trigger (Supabase-only)
    const result = await sql`
      INSERT INTO notification_triggers (
        supabase_carrier_user_id,
        trigger_type,
        trigger_config,
        is_active
      )
      VALUES (
        ${userId},
        ${triggerType},
        ${JSON.stringify(triggerConfig)},
        ${isActive}
      )
      RETURNING id, created_at
    `;

    return NextResponse.json({
      ok: true,
      data: {
        id: result[0].id,
        triggerType,
        triggerConfig,
        isActive,
        createdAt: result[0].created_at
      },
      message: "Notification trigger created successfully"
    });

  } catch (error) {
    console.error("Error creating notification trigger:", error);
    return NextResponse.json(
      { error: "Failed to create notification trigger" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const { id, triggerConfig, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Trigger ID is required" },
        { status: 400 }
      );
    }

    // Update notification trigger
    // If triggerConfig is provided, merge it with existing config
    let updatedConfig: any = null;
    if (triggerConfig) {
      // Get existing trigger to merge configs
      const existing = await sql`
        SELECT trigger_config FROM notification_triggers
        WHERE id = ${id} AND supabase_carrier_user_id = ${userId}
        LIMIT 1
      `;
      
      if (existing.length > 0) {
        let existingConfig = existing[0].trigger_config;
        if (typeof existingConfig === 'string') {
          try {
            existingConfig = JSON.parse(existingConfig);
          } catch {
            existingConfig = {};
          }
        }
        // Merge existing config with new config
        updatedConfig = { ...existingConfig, ...triggerConfig };
      } else {
        updatedConfig = triggerConfig;
      }
    }
    
    // Build the UPDATE query - handle each field separately
    let result;
    if (updatedConfig !== null && isActive !== undefined && isActive !== null) {
      // Update both trigger_config and is_active
      result = await sql`
        UPDATE notification_triggers 
        SET 
          trigger_config = ${JSON.stringify(updatedConfig)},
          is_active = ${isActive},
          updated_at = NOW()
        WHERE id = ${id} 
        AND supabase_carrier_user_id = ${userId}
        RETURNING id
      `;
    } else if (updatedConfig !== null) {
      // Update only trigger_config
      result = await sql`
        UPDATE notification_triggers 
        SET 
          trigger_config = ${JSON.stringify(updatedConfig)},
          updated_at = NOW()
        WHERE id = ${id} 
        AND supabase_carrier_user_id = ${userId}
        RETURNING id
      `;
    } else if (isActive !== undefined && isActive !== null) {
      // Update only is_active
      result = await sql`
        UPDATE notification_triggers 
        SET 
          is_active = ${isActive},
          updated_at = NOW()
        WHERE id = ${id} 
        AND supabase_carrier_user_id = ${userId}
        RETURNING id
      `;
    } else {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Trigger not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Notification trigger updated successfully"
    });

  } catch (error) {
    console.error("Error updating notification trigger:", error);
    return NextResponse.json(
      { error: "Failed to update notification trigger" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Trigger ID is required" },
        { status: 400 }
      );
    }

    // Delete notification trigger
    const result = await sql`
      DELETE FROM notification_triggers 
      WHERE id = ${id} 
      AND supabase_carrier_user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Trigger not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Notification trigger deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting notification trigger:", error);
    return NextResponse.json(
      { error: "Failed to delete notification trigger" },
      { status: 500 }
    );
  }
}

// Helper function to validate trigger configuration
function validateTriggerConfig(triggerType: NotificationTriggerType, config: NotificationTriggerConfig): string | null {
  switch (triggerType) {
    case 'similar_load':
      if (!config.distanceThreshold || config.distanceThreshold < 1 || config.distanceThreshold > 500) {
        return "Distance threshold must be between 1 and 500 miles";
      }
      break;
    
    case 'exact_match':
      // Check for new distance range format or legacy bid numbers
      if (!config.favoriteDistanceRange && (!config.favoriteBidNumbers || config.favoriteBidNumbers.length === 0)) {
        return "Either favorite distance range or favorite bid numbers are required for exact match";
      }
      
      // Validate distance range if provided
      if (config.favoriteDistanceRange) {
        if (typeof config.favoriteDistanceRange.minDistance !== 'number' || 
            typeof config.favoriteDistanceRange.maxDistance !== 'number') {
          return "Distance range must have valid minDistance and maxDistance numbers";
        }
        if (config.favoriteDistanceRange.minDistance < 0 || config.favoriteDistanceRange.maxDistance < 0) {
          return "Distance values must be non-negative";
        }
        if (config.favoriteDistanceRange.minDistance > config.favoriteDistanceRange.maxDistance) {
          return "Min distance cannot be greater than max distance";
        }
      }
      break;
    
    case 'new_route':
      if (!config.statePreferences || config.statePreferences.length === 0) {
        return "At least one state preference is required for new route notifications";
      }
      break;
    
    case 'favorite_available':
      // Check for new distance range format or legacy bid numbers
      if (!config.favoriteDistanceRange && (!config.favoriteBidNumbers || config.favoriteBidNumbers.length === 0)) {
        return "Either favorite distance range or favorite bid numbers are required";
      }
      
      // Validate distance range if provided
      if (config.favoriteDistanceRange) {
        if (typeof config.favoriteDistanceRange.minDistance !== 'number' || 
            typeof config.favoriteDistanceRange.maxDistance !== 'number') {
          return "Distance range must have valid minDistance and maxDistance numbers";
        }
        if (config.favoriteDistanceRange.minDistance < 0 || config.favoriteDistanceRange.maxDistance < 0) {
          return "Distance values must be non-negative";
        }
        if (config.favoriteDistanceRange.minDistance > config.favoriteDistanceRange.maxDistance) {
          return "Min distance cannot be greater than max distance";
        }
      }
      break;
    
    case 'deadline_approaching':
      if (!config.timeThreshold || config.timeThreshold < 1 || config.timeThreshold > 24) {
        return "Time threshold must be between 1 and 24 hours";
      }
      break;
    
    default:
      return "Invalid trigger type";
  }
  
  return null;
}

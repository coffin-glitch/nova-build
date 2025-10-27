import sql from '@/lib/db';
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Notification trigger types
export type NotificationTriggerType = 
  | 'similar_load' 
  | 'exact_match' 
  | 'price_drop' 
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
  favoriteBidNumbers?: string[];
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const triggerType = searchParams.get("triggerType") as NotificationTriggerType;
    const isActive = searchParams.get("isActive") !== "false";

    // Build WHERE conditions
    let whereConditions = [`carrier_user_id = '${userId}'`];
    
    if (triggerType) {
      whereConditions.push(`trigger_type = '${triggerType}'`);
    }
    
    if (isActive !== null) {
      whereConditions.push(`is_active = ${isActive}`);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Get notification triggers with bid and route info for exact_match triggers
    // First get all triggers
    const triggersBase = await sql`
      SELECT 
        nt.id,
        nt.carrier_user_id,
        nt.trigger_type,
        nt.trigger_config,
        nt.is_active,
        nt.created_at,
        nt.updated_at
      FROM notification_triggers nt
      ${sql.unsafe(whereClause)}
      ORDER BY created_at DESC
    `;

    // For exact_match triggers, enrich with bid number and route
    const triggers = await Promise.all(triggersBase.map(async (trigger) => {
      if (trigger.trigger_type === 'exact_match' && trigger.trigger_config?.favoriteBidNumbers?.length > 0) {
        const bidNumber = trigger.trigger_config.favoriteBidNumbers[0];
        
        // Get route for this bid
        const routeResult = await sql`
          SELECT tb.stops
          FROM carrier_favorites cf
          JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
          WHERE cf.carrier_user_id = ${trigger.carrier_user_id}
            AND cf.bid_number = ${bidNumber}
          LIMIT 1
        `;
        
        return {
          ...trigger,
          bid_number: bidNumber,
          route: routeResult[0]?.stops || null
        };
      }
      return trigger;
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
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Insert new notification trigger
    const result = await sql`
      INSERT INTO notification_triggers (
        carrier_user_id,
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
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, triggerConfig, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Trigger ID is required" },
        { status: 400 }
      );
    }

    // Update notification trigger
    const result = await sql`
      UPDATE notification_triggers 
      SET 
        trigger_config = COALESCE(${JSON.stringify(triggerConfig)}, trigger_config),
        is_active = COALESCE(${isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${id} 
      AND carrier_user_id = ${userId}
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
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      AND carrier_user_id = ${userId}
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
      if (!config.favoriteBidNumbers || config.favoriteBidNumbers.length === 0) {
        return "At least one favorite bid number is required for exact match";
      }
      break;
    
    case 'price_drop':
      if (!config.priceThreshold || config.priceThreshold < 0) {
        return "Price threshold must be a positive number";
      }
      break;
    
    case 'new_route':
      if (!config.statePreferences || config.statePreferences.length === 0) {
        return "At least one state preference is required for new route notifications";
      }
      break;
    
    case 'favorite_available':
      if (!config.favoriteBidNumbers || config.favoriteBidNumbers.length === 0) {
        return "At least one favorite bid number is required";
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

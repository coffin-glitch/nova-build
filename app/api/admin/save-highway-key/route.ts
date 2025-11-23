import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const body = await request.json();
    const { apiKey } = body;

    // Input validation
    const validation = validateInput(
      { apiKey },
      {
        apiKey: { required: true, type: 'string', minLength: 10, maxLength: 5000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_save_highway_key_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!apiKey) {
      const response = NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Clean the API key
    const cleanKey = apiKey.replace(/\s/g, "");

    // Read current .env.local
    const envPath = join(process.cwd(), ".env.local");
    let envContent = "";

    try {
      envContent = await readFile(envPath, "utf-8");
    } catch (error) {
      // File doesn't exist, create it
      envContent = "";
    }

    // Update or add HIGHWAY_API_KEY
    const lines = envContent.split("\n");
    let found = false;
    const updatedLines = lines.map((line) => {
      if (line.startsWith("HIGHWAY_API_KEY=")) {
        found = true;
        return `HIGHWAY_API_KEY=${cleanKey}`;
      }
      return line;
    });

    if (!found) {
      // Add new line
      if (envContent && !envContent.endsWith("\n")) {
        updatedLines.push("");
      }
      updatedLines.push(`HIGHWAY_API_KEY=${cleanKey}`);
    }

    // Write back to file
    await writeFile(envPath, updatedLines.join("\n"), "utf-8");

    logSecurityEvent('highway_key_saved', userId);
    
    const response = NextResponse.json({
      success: true,
      message: "API key saved to .env.local. Please restart the server for changes to take effect.",
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error saving API key:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_key_save_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to save API key",
        details: process.env.NODE_ENV === 'development' 
          ? error.message
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}


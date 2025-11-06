import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      message: "API key saved to .env.local. Please restart the server for changes to take effect.",
    });
  } catch (error: any) {
    console.error("Error saving API key:", error);
    return NextResponse.json(
      { error: "Failed to save API key", details: error.message },
      { status: 500 }
    );
  }
}


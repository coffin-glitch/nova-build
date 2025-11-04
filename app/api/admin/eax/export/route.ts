import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";

export async function POST(request: NextRequest) {
  // Ensure user is admin (Supabase-only)
  await requireApiAdmin(request);

  // Fire-and-forget local run:
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "eax:export"], {
    cwd: process.cwd(),
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  return NextResponse.json({ ok: true, message: "Exporter started. Check the Chromium window." });
}

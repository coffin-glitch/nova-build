import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  // Fire-and-forget local run:
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "eax:export"], {
    cwd: process.cwd(),
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  return NextResponse.json({ ok: true, message: "Exporter started. Check the Chromium window." });
}

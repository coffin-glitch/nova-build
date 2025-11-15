import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminSettingsClient } from "./AdminSettingsClient";

export default async function AdminSettingsPage() {
  await requireAdmin();

  return <AdminSettingsClient />;
}


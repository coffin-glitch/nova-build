import { redirect } from "next/navigation";
import { getUnifiedAuth } from "@/lib/auth-unified";
import HighwayApiSettingsClient from "./HighwayApiSettingsClient";

export const dynamic = 'force-dynamic';

export default async function HighwayApiSettingsPage() {
  const auth = await getUnifiedAuth();

  if (!auth.userId || auth.userRole !== "admin") {
    redirect("/sign-in");
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Highway API Settings</h1>
        <HighwayApiSettingsClient />
      </div>
    </div>
  );
}


import NotificationAnalytics from "@/components/admin/NotificationAnalytics";
import SecurityMonitoring from "@/components/admin/SecurityMonitoring";
import { getAdminStats } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboard() {
  await requireAdmin();
  const stats = await getAdminStats();

  return (
    <div className="space-y-8">
      <AdminDashboardClient stats={stats} />

      {/* Notification Analytics Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Notification Analytics</h2>
            <p className="text-muted-foreground">
              Monitor trigger performance and notification metrics
            </p>
          </div>
          <NotificationAnalytics />
        </div>
      </div>

      {/* Security Monitoring Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Security Monitoring</h2>
            <p className="text-muted-foreground">
              Real-time security events, alerts, and rate limit monitoring
            </p>
          </div>
          <SecurityMonitoring />
        </div>
      </div>
    </div>
  );
}

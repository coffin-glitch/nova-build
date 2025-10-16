import PageHeader from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/clerk-server";
import { AdminUsersConsole } from "./AdminUsersConsole";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();

  return (
    <div className="py-8">
      <PageHeader 
        title="Carrier Management Console" 
        subtitle="Manage carrier profiles, send messages, and oversee carrier operations"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Users" }
        ]}
      />
      
      <AdminUsersConsole />
    </div>
  );
}
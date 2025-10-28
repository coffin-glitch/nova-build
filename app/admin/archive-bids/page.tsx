import PageHeader from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/clerk-server";
import { ArchiveBidsTimeline } from "./ArchiveBidsTimeline";

export const dynamic = "force-dynamic";

export default async function AdminArchiveBidsPage() {
  await requireAdmin();

  return (
    <div className="py-8">
      <PageHeader 
        title="Archive Bids Timeline" 
        subtitle="Comprehensive view of all archived bids with parsing history and analytics"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Bids", href: "/admin/bids" },
          { label: "Archive Timeline" }
        ]}
      />
      
      <ArchiveBidsTimeline />
    </div>
  );
}

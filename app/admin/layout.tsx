import { requireAdmin } from "@/lib/auth";
import AIAssistantWrapper from "@/components/admin/AIAssistantWrapper";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // This will redirect if user is not admin
  await requireAdmin();

  return (
    <>
      {children}
      <AIAssistantWrapper />
    </>
  );
}

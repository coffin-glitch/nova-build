import { ProfileGuard } from "@/components/ProfileGuard";

export default function CarrierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileGuard>
      {children}
    </ProfileGuard>
  );
}

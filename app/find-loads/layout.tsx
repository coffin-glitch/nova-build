import { ProfileGuard } from "@/components/ProfileGuard";

export default function FindLoadsLayout({
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

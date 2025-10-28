import { ProfileGuard } from "@/components/ProfileGuard";

export default function BidBoardLayout({
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

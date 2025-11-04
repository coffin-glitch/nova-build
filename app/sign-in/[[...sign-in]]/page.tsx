import SupabaseSignIn from "@/components/SupabaseSignIn";

// Always use Supabase auth (Clerk removed)
export default function Page() {
  return <SupabaseSignIn />;
}

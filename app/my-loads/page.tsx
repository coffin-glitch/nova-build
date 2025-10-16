import { redirect } from "next/navigation";

export default function MyLoadsPage() {
  // Redirect to the new carrier loads console
  redirect('/carrier/my-loads');
}
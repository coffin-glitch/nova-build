"use client";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main style={{ display:"grid", placeItems:"center", minHeight:"100dvh" }}>
      <SignUp routing="hash" />
    </main>
  );
}

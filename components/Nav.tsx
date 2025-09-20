"use client";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Nav() {
  return (
    <nav style={{display:"flex",gap:16,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #eee"}}>
      <Link href="/">NOVA Build</Link>
      <Link href="/bid-board">Bid Board</Link>
      <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
        <SignedOut>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up">Sign up</Link>
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </nav>
  );
}

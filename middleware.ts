import { clerkMiddleware } from "@clerk/nextjs/server";

// Public routes (note the (.*) so nested Clerk paths remain public)
const publicRoutes = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/bid-board",
  "/api/telegram/webhook/(.*)",
];

export default clerkMiddleware({ publicRoutes });

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};

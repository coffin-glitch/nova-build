"use server";

import { revalidatePath, revalidateTag } from "next/cache";

export async function revalidateAdmin() {
  // Light hammer — refresh key admin pages
  revalidatePath("/admin/manage-loads");
  revalidatePath("/admin/bids");
}

export async function revalidateTagSafe(tag: string) {
  try { revalidateTag(tag); } catch {}
}

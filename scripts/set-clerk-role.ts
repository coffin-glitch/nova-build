import 'dotenv/config';
import { users } from '@clerk/clerk-sdk-node';

async function main() {
  const clerkUserId = process.argv[2];
  const role = process.argv[3] || 'carrier';
  if (!clerkUserId) {
    console.error('Usage: npx tsx scripts/set-clerk-role.ts <clerk_user_id> [role]');
    process.exit(1);
  }

  const u = await users.getUser(clerkUserId);
  const current = (u.publicMetadata || {}) as Record<string, any>;
  current.role = role;

  await users.updateUser(clerkUserId, { publicMetadata: current });
  console.log(`✅ Set publicMetadata.role="${role}" for ${clerkUserId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

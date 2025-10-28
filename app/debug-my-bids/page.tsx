import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";

export default async function DebugMyBidsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    return <div>Not authenticated</div>;
  }

  // Get all awarded bids for this user
  const awardedBids = await sql`
    SELECT 
      aa.id,
      aa.bid_number,
      aa.winner_user_id,
      aa.awarded_at,
      tb.tag,
      tb.source_channel
    FROM auction_awards aa
    LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
    WHERE aa.winner_user_id = ${userId}
    ORDER BY aa.awarded_at DESC
  `;

  // Get all auction awards (for comparison)
  const allAwards = await sql`
    SELECT 
      aa.id,
      aa.bid_number,
      aa.winner_user_id,
      aa.awarded_at
    FROM auction_awards aa
    ORDER BY aa.awarded_at DESC
  `;

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Debug: My Awarded Bids</h1>
      
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded">
          <p className="font-semibold">Your User ID:</p>
          <code>{userId}</code>
        </div>

        <div className="bg-yellow-50 p-4 rounded">
          <p className="font-semibold">Total Awarded Bids in Database: {allAwards.length}</p>
          <p className="text-sm mt-2">First 10:</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            {allAwards.slice(0, 10).map(award => (
              <li key={award.id}>
                Bid #{award.bid_number} → {award.winner_user_id?.substring(0, 15)}...
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-green-50 p-4 rounded">
          <p className="font-semibold">Your Awarded Bids: {awardedBids.length}</p>
          <div className="mt-2 space-y-2">
            {awardedBids.length === 0 ? (
              <p className="text-red-600">No bids found for your user ID!</p>
            ) : (
              awardedBids.map(bid => (
                <div key={bid.id} className="border p-2 rounded">
                  <p><strong>Bid #{bid.bid_number}</strong></p>
                  <p className="text-sm">Awarded: {new Date(bid.awarded_at).toLocaleString()}</p>
                  <p className="text-sm">Tag: {bid.tag || 'None'}</p>
                  <p className="text-sm">Source: {bid.source_channel || 'None'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


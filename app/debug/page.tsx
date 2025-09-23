import { testDatabaseConnection } from "@/lib/actions";

export default async function DebugPage() {
  const dbTest = await testDatabaseConnection();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Environment Variables</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>NODE_ENV: {process.env.NODE_ENV}</li>
            <li>DATABASE_URL: {process.env.DATABASE_URL ? "✅ Set" : "❌ Missing"}</li>
            <li>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "✅ Set" : "❌ Missing"}</li>
            <li>CLERK_SECRET_KEY: {process.env.CLERK_SECRET_KEY ? "✅ Set" : "❌ Missing"}</li>
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Database Connection</h2>
          {dbTest.success ? (
            <p className="text-green-600">✅ Database connected successfully</p>
          ) : (
            <div>
              <p className="text-red-600">❌ Database connection failed</p>
              <p className="text-sm text-muted-foreground">Error: {dbTest.error}</p>
            </div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold">Status</h2>
          <p className="text-green-600">✅ Page loaded successfully</p>
        </div>
      </div>
    </div>
  );
}

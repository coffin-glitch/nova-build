# Upstash Redis Setup Instructions

## Step 1: Get Your Redis Connection String

From your Upstash dashboard, you need the **TCP connection string with TLS**.

1. In your Upstash dashboard, look for the **TCP** section
2. You should see a connection string like:
   ```
   redis-cli --tls -u redis://default:YOUR_PASSWORD@active-penguin-36152.upstash.io:6379
   ```

3. Extract the connection string and convert it to use `rediss://` (with double 's' for TLS):
   ```
   rediss://default:YOUR_PASSWORD@active-penguin-36152.upstash.io:6379
   ```

## Step 2: Add to Environment Variables

Add this to your `.env.local` file:

```bash
REDIS_URL=rediss://default:YOUR_PASSWORD@active-penguin-36152.upstash.io:6379
```

**Important**: Replace `YOUR_PASSWORD` with your actual password from Upstash.

## Step 3: Get Your Password

If you don't see the password in the dashboard:
1. Click on the **Token** field (it might show as dots)
2. Or use the "Reset Credentials" button to generate new ones
3. Copy the password from the connection string shown

## Step 4: Test Connection

Run this to test:
```bash
npm run worker:notifications
```

You should see: `🚀 Notification workers started and listening for jobs...`

If you see connection errors, check:
- Password is correct
- Using `rediss://` (with double 's') not `redis://`
- TLS is enabled in Upstash (which it is by default)


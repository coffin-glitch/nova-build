set -euo pipefail

# === Your Supabase pooler settings (you said these are correct) ===
NEW_HOST='aws-1-us-east-2.pooler.supabase.com'
NEW_USER='postgres.rbiomzdrlmsexehrhowa'
NEW_PASS='LVJPHzZbah5pW4Lp'
NEW_DB='postgres'
NEW_URL="postgresql://${NEW_USER}:${NEW_PASS}@${NEW_HOST}:5432/${NEW_DB}?sslmode=require"

echo "[fix_db] Updating .env DATABASE_URL → pooler host"
awk -v url="$NEW_URL" '
  BEGIN {wrote=0}
  /^DATABASE_URL=/ {print "DATABASE_URL=" url; wrote=1; next}
  /^PGHOSTADDR=/ {next}  # drop any stale PGHOSTADDR
  {print}
  END {if(!wrote) print "DATABASE_URL=" url}
' .env > .env.new && mv .env.new .env

echo "[fix_db] .env summary:"
grep -E '^(DATABASE_URL|PGHOSTADDR)=' .env | sed 's#:\([^@]*\)@#:<redacted>@#'

if [ -f .env.local ]; then
  echo "[fix_db] Syncing .env.local DATABASE_URL"
  awk -v url="$NEW_URL" '
    BEGIN {wrote=0}
    /^DATABASE_URL=/ {print "DATABASE_URL=" url; wrote=1; next}
    {print}
    END {if(!wrote) print "DATABASE_URL=" url}
  ' .env.local > .env.local.new && mv .env.local.new .env.local
fi

echo "[fix_db] Python ping with psycopg:"
python - <<'PY'
import os, asyncio, psycopg
from urllib.parse import urlparse

url = os.environ.get("DATABASE_URL","")
print("DATABASE_URL (redacted):", url.replace(url.split('@')[0], "postgresql://<redacted>"))
u = urlparse(url)
print("Parsed host:", u.hostname, " user:", u.username, " db:", u.path.lstrip('/'))

async def ping():
    try:
        async with await psycopg.AsyncConnection.connect(url) as conn:
            async with conn.cursor() as cur:
                await cur.execute("select current_user, current_database(), inet_server_addr()")
                row = await cur.fetchone()
                print("DB OK:", row)
    except Exception as e:
        print("DB ERROR:", e)

asyncio.run(ping())
PY

echo "[fix_db] Restarting forwarder…"
chmod +x ./run_telegram_forwarder.sh
./run_telegram_forwarder.sh

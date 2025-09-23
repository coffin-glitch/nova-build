import os
import re
import asyncio
from dotenv import load_dotenv
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from telethon.errors import ChannelPrivateError, UsernameNotOccupiedError, FloodWaitError
from telethon.tl.types import PeerChannel, PeerChat, PeerUser

# Load ~/.nova_telegram.env
load_dotenv(os.path.expanduser("~/.nova_telegram.env"))

API_ID = int(os.getenv("TELEGRAM_API_ID", "0"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "")
SOURCE_CHANNEL = os.getenv("SOURCE_CHANNEL", "").strip()  # username (without @) or numeric id
TARGET_GROUP_ID = os.getenv("TARGET_GROUP_ID", "").strip()  # if numeric supergroup: starts with -100...

if not API_ID or not API_HASH:
    raise SystemExit("Missing TELEGRAM_API_ID / TELEGRAM_API_HASH in ~/.nova_telegram.env")
if not SOURCE_CHANNEL:
    raise SystemExit("Missing SOURCE_CHANNEL in ~/.nova_telegram.env")
if not TARGET_GROUP_ID:
    raise SystemExit("Missing TARGET_GROUP_ID in ~/.nova_telegram.env")

SESSION_FILE = "storage/telethon_session"  # file-based session

# Regex (no VERBOSE mode) to match USPS bid posts
# Notes:
# - tolerant of either "Stops:" or "🚛Stops:"
# - captures the optional trailing #STATE tag if present
BID_RX = re.compile(
    r"(?is)"
    r"\bNew\s+Load\s+Bid:\s*(?P<bid>\d{5,})\b.*?"
    r"Distance:\s*(?P<mi>[\d.,]+)\s*miles?.*?"
    r"Pickup:\s*(?P<pickup>[^\n\r]+)\s*"
    r"Delivery:\s*(?P<delivery>[^\n\r]+)\s*"
    r"(?:🚛)?Stops:\s*(?P<stops>.+?)"
    r"(?:\s*\#(?P<tag>[A-Z]{2}))?"
    r"(?:\s|$)"
    ,
    re.IGNORECASE | re.DOTALL
)

def normalize_stops(block: str) -> str:
    """Keep the Stop lines tidy."""
    # Ensure each Stop line is on its own line and trimmed
    lines = []
    for raw in block.splitlines():
        t = raw.strip()
        if not t:
            continue
        lines.append(t)
    # If it came as one long line with "Stop 1:" / "Stop 2:", split on that
    if len(lines) == 1 and "Stop " in lines[0]:
        parts = re.split(r"(?=Stop\s+\d+:)", lines[0])
        lines = [p.strip() for p in parts if p.strip()]
    return "\n".join(lines)

def friendly_forward_text(text: str) -> str:
    """
    If it matches the USPS bid format, lightly normalize it.
    Otherwise, forward the original text.
    """
    m = BID_RX.search(text or "")
    if not m:
        return text

    bid = m.group("bid")
    mi = m.group("mi")
    pickup = (m.group("pickup") or "").strip()
    delivery = (m.group("delivery") or "").strip()
    stops_raw = (m.group("stops") or "").strip()
    tag = (m.group("tag") or "").strip()

    stops = normalize_stops(stops_raw)

    parts = [
        f"New Load Bid: {bid}",
        f"Distance: {mi} miles",
        f"Pickup: {pickup}",
        f"Delivery: {delivery}",
        "Stops:",
        stops,
    ]
    if tag:
        parts.append(f"#{tag}")

    parts.append("\n(Forwarded by NOVA)")
    return "\n".join(parts)

async def resolve_peer(client: TelegramClient, raw: str):
    """
    Accepts username (ben_usps) or numeric id (-100123...) and returns an entity/peer usable in send_message/iter.
    """
    raw = raw.strip()
    # Numeric?
    if re.fullmatch(r"-?\d+", raw):
        i = int(raw)
        if i < 0:
            return PeerChannel(i)  # supergroup/channel
        return PeerUser(i)

    # Username
    try:
        entity = await client.get_entity(raw)
        return entity
    except (UsernameNotOccupiedError, ValueError):
        raise SystemExit(f"Could not resolve @{raw}. Is the username correct and visible?")

async def main():
    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)
    await client.start()  # prompts 1st time for your phone & login code (sent by Telegram)

    src = await resolve_peer(client, SOURCE_CHANNEL)
    dst = await resolve_peer(client, TARGET_GROUP_ID)

    print("✅ Running forwarder")
    print(f"   Source: {SOURCE_CHANNEL} → {src}")
    print(f"   Target: {TARGET_GROUP_ID} → {dst}")

    # On new messages in source channel
    @client.on(events.NewMessage(chats=src))
    async def handler(event):
        try:
            msg = event.message
            if msg.message:
                text = friendly_forward_text(msg.message)
                await client.send_message(dst, text, link_preview=False)
            elif msg.media:
                # forward media as copy
                await client.send_message(dst, msg)
        except FloodWaitError as e:
            print(f"Flood wait ({e.seconds}s). Sleeping...")
            await asyncio.sleep(e.seconds)
        except Exception as e:
            print("Error forwarding message:", e)

    # Backfill last ~20 posts on start (optional)
    print("Backfilling last 20 posts...")
    try:
        async for message in client.iter_messages(src, limit=20, reverse=True):
            try:
                if message.message:
                    text = friendly_forward_text(message.message)
                    await client.send_message(dst, text, link_preview=False)
                elif message.media:
                    await client.send_message(dst, message)
            except Exception as e:
                print("Backfill send error:", e)
    except ChannelPrivateError:
        print("Cannot read from source: private channel? Make sure your account has access.")
    print("Listening for new posts...")

    await client.run_until_disconnected()

if __name__ == "__main__":
    asyncio.run(main())

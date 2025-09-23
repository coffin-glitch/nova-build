# scripts/telegram_bot_forwarder.py
# NOVA Telegram forwarder + parser + Postgres upsert
# Works with python-telegram-bot v22.x
import os
import re
import asyncio
import logging
import signal
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from dotenv import load_dotenv
import humanize
import psycopg
from psycopg.rows import dict_row

from telegram import Update, Message
from telegram.ext import (
    Application, ApplicationBuilder, MessageHandler, ContextTypes, filters
)

# ---------- Config & Logging ----------
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("nova.tele.forwarder")

BOT_TOKEN         = os.environ.get("BOT_TOKEN", "").strip()
SOURCE_CHANNEL_ID = int(os.environ.get("SOURCE_CHANNEL_ID", "0"))
TARGET_GROUP_ID   = int(os.environ.get("TARGET_GROUP_ID", "0"))
DATABASE_URL      = os.environ.get("DATABASE_URL", "").strip()

if not BOT_TOKEN or not SOURCE_CHANNEL_ID or not TARGET_GROUP_ID:
    raise SystemExit("Missing BOT_TOKEN / SOURCE_CHANNEL_ID / TARGET_GROUP_ID in .env")

if DATABASE_URL:
    log.info("Postgres enabled.")
else:
    log.warning("DATABASE_URL not set; DB upserts will be skipped.")

# ---------- DB helpers ----------
async def db_upsert_bid(conn: psycopg.AsyncConnection, d: Dict[str, Any]) -> None:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            insert into public.telegram_bids
              (bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
               stops, tag, source_channel, forwarded_to, received_at, expires_at)
            values
              (%(bid_number)s, %(distance_miles)s, %(pickup_timestamp)s, %(delivery_timestamp)s,
               %(stops)s, %(tag)s, %(source_channel)s, %(forwarded_to)s, %(received_at)s, %(expires_at)s)
            on conflict (bid_number) do update set
              distance_miles    = excluded.distance_miles,
              pickup_timestamp  = excluded.pickup_timestamp,
              delivery_timestamp= excluded.delivery_timestamp,
              stops             = excluded.stops,
              tag               = excluded.tag,
              source_channel    = excluded.source_channel,
              forwarded_to      = excluded.forwarded_to,
              received_at       = excluded.received_at,
              expires_at        = excluded.expires_at
            """,
            {
                "bid_number": d.get("bid_number"),
                "distance_miles": d.get("distance_miles"),
                "pickup_timestamp": d.get("pickup_timestamp"),
                "delivery_timestamp": d.get("delivery_timestamp"),
                "stops": d.get("stops") or [],
                "tag": d.get("tag"),
                "source_channel": d.get("source_channel"),
                "forwarded_to": d.get("forwarded_to"),
                "received_at": d.get("received_at", datetime.now(timezone.utc)),
                "expires_at": d.get("expires_at"),
            },
        )

# ---------- Parser ----------
TIME_RX = r"(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)"
DATE_RX = r"(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])/(20\d\d)"
DT_RX   = rf"{DATE_RX}\s+{TIME_RX}"

# Non-VERBOSE, DOTALL+IGNORECASE. No emojis required; just "Stops:" anchor.
BID_RX = re.compile(
    r"(?si)"                                # DOTALL + IGNORECASE
    r"^\s*New\s+Load\s+Bid:\s*(?P<bid>\d+)\s+"
    r"Distance:\s*(?P<dist>[\d\.]+)\s*mi(?:les)?\s+"
    r"Pickup:\s*(?P<pick>.+?)\s+"
    r"Delivery:\s*(?P<deliv>.+?)\s+"
    r"(?:.*?\n)*?Stops:\s*[\r\n]+"
    r"(?P<stops>(?:\s*Stop\s*\d+:\s*.*\n?)+)"
    r"(?:\s*\n\s*(?P<tag>\#[A-Za-z0-9_]+))?"
)

STOP_RX = re.compile(r"(?i)Stop\s*\d+:\s*(?P<place>.+)")

def _parse_dt_text(dt_text: str) -> Optional[datetime]:
    m = re.search(DT_RX, dt_text or "", flags=re.IGNORECASE)
    if not m:
        return None
    mm, dd, yyyy, hh12, minute, ampm = m.groups()
    mm = int(mm); dd = int(dd); yyyy = int(yyyy)
    hh = int(hh12) % 12
    if ampm.upper() == "PM":
        hh += 12
    return datetime(yyyy, mm, dd, hh, int(minute), tzinfo=timezone.utc)

def parse_bid(text: str) -> Optional[Dict[str, Any]]:
    m = BID_RX.search(text or "")
    if not m:
        return None
    bid_number = m.group("bid")
    try:
        distance = float(m.group("dist"))
    except Exception:
        distance = None
    pickup_dt = _parse_dt_text(m.group("pick"))
    delivery_dt = _parse_dt_text(m.group("deliv"))

    stops: List[str] = []
    for line in (m.group("stops") or "").splitlines():
        sm = STOP_RX.search(line.strip())
        if sm:
            stops.append(sm.group("place").strip())

    tag_raw = (m.group("tag") or "").strip()
    tag = tag_raw[1:].upper() if tag_raw.startswith("#") else (tag_raw.upper() or None)

    return {
        "bid_number": bid_number,
        "distance_miles": distance,
        "pickup_timestamp": pickup_dt,
        "delivery_timestamp": delivery_dt,
        "stops": stops,
        "tag": tag,
    }

# ---------- Game-like UI State ----------
forwarded_count = 0
parsed_count = 0
last_bid_at: Optional[datetime] = None
last_bid_number: Optional[str] = None
last_tag: Optional[str] = None

def fmt_td(td: timedelta) -> str:
    s = int(max(0, td.total_seconds()))
    m, s = divmod(s, 60)
    return f"{m:02d}:{s:02d}"

async def ui_loop():
    while True:
        os.system("clear")
        now = datetime.now(timezone.utc)
        if last_bid_at:
            since_human = humanize.naturaldelta(now - last_bid_at)
            since_clock = fmt_td(now - last_bid_at)
            countdown   = fmt_td(timedelta(minutes=30) - (now - last_bid_at))
        else:
            since_human = "—"
            since_clock = "—"
            countdown   = "—"

        print("╭───────────────────────── NOVA • Telegram Forwarder ──────────────────────────╮")
        print(f"│ Status               {'CONNECTED':<56}│")
        print(f"│ Source          {SOURCE_CHANNEL_ID:<56}│")
        print(f"│ Target            {TARGET_GROUP_ID:<56}│")
        print(f"│ Forwarded                    {forwarded_count:<43}│")
        print(f"│ Parsed Bids                  {parsed_count:<43}│")
        print(f"│ Last Bid #                   {last_bid_number or '—':<43}│")
        print(f"│ Last Tag                     {last_tag or '—':<43}│")
        print(f"│ Since Last Bid               {since_human} ({since_clock}){'':<21}│")
        print(f"│ 30-min Countdown             {countdown:<43}│")
        print("╰──────────────────────────────────────────────────────────────────────────────╯")
        await asyncio.sleep(1)

# ---------- Telegram Handlers ----------
def _msg(update: Update) -> Optional[Message]:
    return update.effective_message

async def on_any_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global forwarded_count, parsed_count, last_bid_at, last_bid_number, last_tag

    msg = _msg(update)
    if not msg:
        return
    if msg.chat_id != SOURCE_CHANNEL_ID:
        return

    # Forward/copy
    try:
        await context.bot.copy_message(
            chat_id=TARGET_GROUP_ID,
            from_chat_id=msg.chat_id,
            message_id=msg.message_id,
        )
        forwarded_count += 1
        log.info("Forwarded %s from %s -> %s", msg.message_id, SOURCE_CHANNEL_ID, TARGET_GROUP_ID)
    except Exception as e:
        log.warning("Forward failed: %s", e)

    # Parse + upsert
    text = (msg.text or msg.caption or "").strip()
    parsed = parse_bid(text)
    if not parsed:
        log.info("Message didn’t match bid pattern; forwarded only.")
        return

    parsed_count += 1
    last_bid_at = datetime.now(timezone.utc)
    last_bid_number = parsed.get("bid_number")
    last_tag = parsed.get("tag")

    parsed["source_channel"] = str(SOURCE_CHANNEL_ID)
    parsed["forwarded_to"]   = str(TARGET_GROUP_ID)
    parsed["received_at"]    = last_bid_at
    parsed["expires_at"]     = last_bid_at + timedelta(minutes=30)

    if not DATABASE_URL:
        log.info("No DATABASE_URL; skipping upsert for bid %s", parsed["bid_number"])
        return

    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            await db_upsert_bid(conn, parsed)
            await conn.commit()
        log.info("Upserted bid %s", parsed["bid_number"])
    except Exception as e:
        log.error("DB upsert failed: %s", e)

def build_app() -> Application:
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    # One wide handler: we filter by chat_id inside
    app.add_handler(MessageHandler(filters.ALL, on_any_message))
    return app

async def run_bot():
    app = build_app()
    await app.run_polling(
        allowed_updates=["message", "edited_message", "channel_post", "edited_channel_post"],
        close_loop=False,
        drop_pending_updates=True,
    )

def main():
    log.info("Starting bot… listening %s → %s", SOURCE_CHANNEL_ID, TARGET_GROUP_ID)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    stop_event = asyncio.Event()

    def _graceful(*_):
        if not stop_event.is_set():
            log.info("Shutting down…")
            stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _graceful)
        except NotImplementedError:
            pass

    async def supervisor():
        bot_task = asyncio.create_task(run_bot())
        ui_task  = asyncio.create_task(ui_loop())
        await stop_event.wait()
        for t in (bot_task, ui_task):
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass

    loop.run_until_complete(supervisor())
    try:
        loop.close()
    except RuntimeError:
        pass

if __name__ == "__main__":
    main()

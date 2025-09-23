# scripts/telegram_bot_forwarder.py
# NOVA Telegram forwarder + parser + Postgres upsert + Rich UI
# Works with python-telegram-bot v22.x
import os
import re
import time
import signal
import logging
import threading
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, List, Any

from dotenv import load_dotenv
import humanize
import psycopg
from psycopg.rows import dict_row

from telegram import Update, Message
from telegram.ext import (
    ApplicationBuilder,
    ContextTypes,
    MessageHandler,
    filters,
)

# ----- UI (rich) -----
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.live import Live
from rich.text import Text
from rich.align import Align

# ---------- ENV ----------
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("BOT_TOKEN")
SRC_CHAT = os.getenv("TELEGRAM_SOURCE_CHAT_ID") or os.getenv("SOURCE_CHANNEL_ID")
DST_CHAT = os.getenv("TELEGRAM_TARGET_GROUP_ID") or os.getenv("TARGET_GROUP_ID")
DATABASE_URL = os.getenv("DATABASE_URL", "")

if not BOT_TOKEN or not SRC_CHAT or not DST_CHAT:
    raise SystemExit(
        "Missing TELEGRAM_BOT_TOKEN (or BOT_TOKEN) / TELEGRAM_SOURCE_CHAT_ID / TELEGRAM_TARGET_GROUP_ID in .env"
    )

SOURCE_CHAT_ID = int(SRC_CHAT)
TARGET_CHAT_ID = int(DST_CHAT)
POSTGRES_ENABLED = bool(DATABASE_URL)

# ---------- LOGGING ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("nova.tele.forwarder")
console = Console()
if POSTGRES_ENABLED:
    log.info("Postgres enabled.")

# ---------- STATE FOR UI ----------
STATE = {
    "connected": False,
    "last_error": "",
    "forwarded_count": 0,
    "parsed_count": 0,
    "last_bid_seen": None,     # type: Optional[int]
    "last_tag": None,          # type: Optional[str]
    "last_bid_at": None,       # type: Optional[datetime]
    "last_src_msg_id": None,
    "events": deque(maxlen=12),
}
STOP_EVENT = threading.Event()
COUNTDOWN_MINUTES = 30

def push_event(txt: str):
    ts = datetime.now().strftime("%H:%M:%S")
    STATE["events"].appendleft(f"[{ts}] {txt}")

# ---------- DB ----------
async def db_upsert_bid(d: Dict[str, Any]) -> None:
    if not POSTGRES_ENABLED:
        return
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
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
                      distance_miles     = excluded.distance_miles,
                      pickup_timestamp   = excluded.pickup_timestamp,
                      delivery_timestamp = excluded.delivery_timestamp,
                      stops              = excluded.stops,
                      tag                = excluded.tag,
                      source_channel     = excluded.source_channel,
                      forwarded_to       = excluded.forwarded_to,
                      received_at        = excluded.received_at,
                      expires_at         = excluded.expires_at
                    """,
                    d,
                )
            await conn.commit()
        push_event(f"[OK] Upserted bid {d.get('bid_number')}")
        log.info("Upserted bid %s", d.get("bid_number"))
    except Exception as e:
        STATE["last_error"] = f"DB upsert failed: {e}"
        push_event(f"[ERR] DB upsert failed: {e}")
        log.exception("DB upsert failed")

# ---------- PARSER (same tolerant pattern you shared) ----------
BID_RX = re.compile(
    r"""
    New\ Load\ Bid:\s*(?P<bid>\d+)\s*
    (?:\n+Distance:\s*(?P<miles>[\d\.]+)\s*miles?)?\s*
    (?:\n+Pickup:\s*(?P<pickup_dt>.+?))?\s*
    (?:\n+Delivery:\s*(?P<delivery_dt>.+?))?\s*
    (?:\n+(?:🚛)?\s*Stops:\s*(?P<stops>[\s\S]*?))?
    (?:\n+\#(?P<tag>[A-Za-z0-9_-]+))?
    (?:\n+\s*USPS\ LOADS.*)?
    \s*\Z
    """,
    re.IGNORECASE | re.VERBOSE,
)

def _parse_stops(stops_block: Optional[str]) -> List[str]:
    if not stops_block:
        return []
    lines = [ln.strip() for ln in stops_block.strip().splitlines() if ln.strip()]
    cleaned: List[str] = []
    for ln in lines:
        if ":" in ln:
            parts = ln.split(":", 1)
            cleaned.append(parts[1].strip() if len(parts) > 1 else ln.strip())
        else:
            cleaned.append(ln)
    return cleaned

def parse_bid(text: str) -> Optional[Dict]:
    m = BID_RX.search((text or "").strip())
    if not m:
        return None
    gd = {k: (v.strip() if isinstance(v, str) else v) for k, v in m.groupdict().items()}
    try:
        bid_num = int(gd["bid"]) if gd.get("bid") else None
    except Exception:
        return None
    try:
        miles = float(gd["miles"]) if gd.get("miles") else None
    except Exception:
        miles = None
    tag = (gd.get("tag") or "").upper() or None
    stops = _parse_stops(gd.get("stops"))
    return {
        "bid": bid_num,
        "miles": miles,
        "pickup_dt": gd.get("pickup_dt") or None,
        "delivery_dt": gd.get("delivery_dt") or None,
        "stops": stops,
        "tag": tag,  # may be None
    }

# ---------- UI ----------
def render_ui() -> Panel:
    now = datetime.now(timezone.utc)
    connected = STATE["connected"]
    last_err = STATE["last_error"]
    fwd = STATE["forwarded_count"]
    parsed = STATE["parsed_count"]
    last_bid = STATE["last_bid_seen"]
    last_tag = STATE["last_tag"]
    last_bid_at = STATE["last_bid_at"]

    title = Text("NOVA • Telegram Forwarder", style="bold cyan")
    status = Text("CONNECTED" if connected else "DISCONNECTED", style="bold green" if connected else "bold red")

    tbl = Table.grid(expand=True)
    tbl.add_column(justify="left")
    tbl.add_column(justify="right")
    tbl.add_row(Text("Status:", style="bold"), status)
    tbl.add_row("Source", Text(str(SOURCE_CHAT_ID)))
    tbl.add_row("Target", Text(str(TARGET_CHAT_ID)))
    tbl.add_row("—", Text("—"))
    tbl.add_row("Forwarded", Text(str(fwd)))
    tbl.add_row("Parsed Bids", Text(str(parsed)))
    tbl.add_row("Last Bid #", Text(str(last_bid) if last_bid else "—"))
    tbl.add_row("Last Tag", Text(last_tag or "—"))

    if last_bid_at:
        since = now - last_bid_at
        since_human = humanize.naturaldelta(since) if since.total_seconds() >= 1 else "just now"
        since_clock = f"{int(since.total_seconds()//60):02d}:{int(since.total_seconds()%60):02d}"
        end_at = last_bid_at + timedelta(minutes=COUNTDOWN_MINUTES)
        remain = max(0, int((end_at - now).total_seconds()))
        c_min = remain // 60
        c_sec = remain % 60
        countdown_txt = f"{c_min:02d}:{c_sec:02d}"
        tbl.add_row("Since Last Bid", Text(f"{since_human} ({since_clock})"))
        tbl.add_row("30-min Countdown", Text(countdown_txt))
    else:
        tbl.add_row("Since Last Bid", Text("—"))
        tbl.add_row("30-min Countdown", Text("—"))

    if last_err:
        tbl.add_row("", Text(f"Last error: {last_err}", style="yellow"))

    # recent events
    ev = Table.grid()
    ev.add_column()
    if STATE["events"]:
        for e in list(STATE["events"]):
            ev.add_row(Text(e))
    else:
        ev.add_row(Text("No events yet. Waiting for next post…", style="dim"))

    outer = Table.grid(padding=(0, 2))
    outer.add_column()
    outer.add_row(Align.center(tbl))
    outer.add_row(Panel(ev, title="Recent Events", border_style="cyan"))

    return Panel(outer, title=title, border_style="cyan")

def ui_thread():
    console.clear()
    with Live(render_ui(), refresh_per_second=8, console=console, transient=False) as live:
        while not STOP_EVENT.is_set():
            live.update(render_ui())
            time.sleep(0.25)

# ---------- HANDLER (permissive; filter inside) ----------
async def on_source_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        msg: Optional[Message] = update.effective_message or update.channel_post or update.edited_channel_post
        chat = update.effective_chat
        if not msg or not chat:
            return

        # Only process messages from the configured source channel
        if chat.id != SOURCE_CHAT_ID:
            # show us if we see unexpected channel posts (helps diagnose)
            if chat.type == "channel":
                push_event(f"[dbg] Ignored channel id {chat.id} (expect {SOURCE_CHAT_ID})")
            return

        text = msg.text or msg.caption or ""

        # 1) Copy original post to target group
        try:
            await context.bot.copy_message(
                chat_id=TARGET_CHAT_ID,
                from_chat_id=SOURCE_CHAT_ID,
                message_id=msg.message_id,
            )
            STATE["forwarded_count"] += 1
            STATE["last_src_msg_id"] = msg.message_id
            push_event(f"Forwarded post {msg.message_id}")
            log.info("Forwarded message %s from %s → %s", msg.message_id, SOURCE_CHAT_ID, TARGET_CHAT_ID)
        except Exception as e:
            STATE["last_error"] = f"Forward failed: {e}"
            push_event(f"[ERR] Forward failed: {e}")
            log.warning("Forward failed: %s", e)

        # 2) Parse potential bid
        parsed = parse_bid(text)
        if parsed:
            STATE["parsed_count"] += 1
            STATE["last_bid_seen"] = parsed["bid"]
            STATE["last_tag"] = parsed.get("tag")
            STATE["last_bid_at"] = datetime.now(timezone.utc)
            push_event(f"[OK] Parsed bid {parsed['bid']} {('#'+parsed['tag']) if parsed.get('tag') else ''}")
            log.info("Parsed bid: %s", parsed)

            # DB upsert
            now = datetime.now(timezone.utc)
            record = {
                "bid_number": str(parsed["bid"]),
                "distance_miles": parsed.get("miles"),
                "pickup_timestamp": None,     # keep simple; your earlier regex didn’t normalize DT
                "delivery_timestamp": None,
                "stops": parsed.get("stops") or [],
                "tag": parsed.get("tag"),
                "source_channel": str(SOURCE_CHAT_ID),
                "forwarded_to": str(TARGET_CHAT_ID),
                "received_at": now,
                "expires_at": now + timedelta(minutes=30),
            }
            await db_upsert_bid(record)
        else:
            push_event("Post did not match bid pattern; forwarded only.")
            log.info("Message did not match bid pattern; forwarded only.")
    except Exception as e:
        STATE["last_error"] = str(e)
        push_event(f"[ERR] Handler error: {e}")
        log.exception("Handler error")

# ---------- MAIN ----------
def main():
    # graceful shutdown
    def _sig_handler(sig, frame):
        STOP_EVENT.set()
    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)

    # start UI
    t = threading.Thread(target=ui_thread, daemon=True)
    t.start()

    # build app & handlers — IMPORTANT: permissive handler that gets ALL channel posts
    application = ApplicationBuilder().token(BOT_TOKEN).build()

    application.add_handler(MessageHandler(filters.ChatType.CHANNEL, on_source_message))
    application.add_handler(MessageHandler(filters.ChatType.CHANNEL & filters.UpdateType.EDITED_CHANNEL_POST, on_source_message))

    # hook connection state
    async def _post_init(app): STATE["connected"] = True; push_event("Polling started.")
    async def _post_stop(app): STATE["connected"] = False
    application.post_init = _post_init
    application.post_stop = _post_stop

    # This call is synchronous & manages the event loop internally
    try:
        application.run_polling(
            allowed_updates=Update.ALL_TYPES,       # <- keeps channel_post flowing
            drop_pending_updates=True,
            close_loop=True,
        )
    finally:
        STOP_EVENT.set()
        t.join(timeout=1.0)
        console.print("\n[bold yellow]Shutting down…[/bold yellow]")

if __name__ == "__main__":
    main()

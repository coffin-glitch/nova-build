# scripts/telegram_bot_forwarder.py
# NOVA Telegram forwarder + parser + Postgres upsert + Stable Rich UI
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
from psycopg.types.json import Json  # <- ensure JSON parameters are sent as JSON
import httpx  # For HTTP calls to trigger notifications

from telegram import Update, Message
from telegram.ext import (
    ApplicationBuilder,
    ContextTypes,
    MessageHandler,
    filters,
)

# ----- UI (rich) -----
from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.live import Live
from rich.text import Text
from rich.align import Align
from rich.rule import Rule

# ================== ENV ==================
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("BOT_TOKEN")
SRC_CHAT = os.getenv("TELEGRAM_SOURCE_CHAT_ID") or os.getenv("SOURCE_CHANNEL_ID")
DST_CHAT = os.getenv("TELEGRAM_TARGET_GROUP_ID") or os.getenv("TARGET_GROUP_ID")
DATABASE_URL = os.getenv("DATABASE_URL", "")
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")  # URL to trigger notifications (e.g., https://your-app.railway.app/api/webhooks/new-bid)
WEBHOOK_API_KEY = os.getenv("WEBHOOK_API_KEY", "")  # Optional API key for webhook security

# ================== PREFLIGHT CHECKS ==================
import sys
import socket
from urllib.parse import urlparse

def parse_database_url(url: str) -> dict:
    """Parse DATABASE_URL and extract components for logging."""
    try:
        parsed = urlparse(url)
        return {
            'host': parsed.hostname or 'unknown',
            'port': parsed.port or 5432,
            'database': parsed.path.lstrip('/') or 'unknown',
            'user': parsed.username or 'unknown',
            'has_ssl': 'sslmode=require' in url or 'sslmode=require' in (parsed.query or ''),
            'full_url': url
        }
    except Exception as e:
        return {'error': str(e), 'full_url': url}

def preflight_database_check():
    """Blocking preflight check for database connectivity."""
    if not DATABASE_URL:
        logging.error("DATABASE_URL is missing; ensure .env is exported in run_telegram_forwarder.sh")
        sys.exit(1)
    
    # Parse and log database info
    db_info = parse_database_url(DATABASE_URL)
    if 'error' in db_info:
        logging.error(f"Failed to parse DATABASE_URL: {db_info['error']}")
        sys.exit(1)
    
    # Log database connection details
    logging.info(f"DB host: {db_info['host']}, db: {db_info['database']}, sslmode=require: {'yes' if db_info['has_ssl'] else 'no'}")
    
    # Check if running in tmux
    if os.getenv('TMUX'):
        logging.info("Running inside tmux session")
    
    # Test DNS resolution
    try:
        socket.getaddrinfo(db_info['host'], db_info['port'])
        logging.info(f"DNS resolution OK for {db_info['host']}:{db_info['port']}")
    except socket.gaierror as e:
        logging.error(f"DNS resolution failed for {db_info['host']}:{db_info['port']} - {e}")
        sys.exit(1)
    
    # Test database connection
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 as ok")
                result = cur.fetchone()
                if result and result[0] == 1:
                    logging.info("DB preflight OK - connection successful")
                else:
                    logging.error("DB preflight failed - unexpected query result")
                    sys.exit(1)
    except Exception as e:
        logging.error(f"DB preflight failed - connection error: {e}")
        sys.exit(1)

# Run preflight checks before starting the bot
preflight_database_check()

if not BOT_TOKEN or not SRC_CHAT or not DST_CHAT:
    raise SystemExit(
        "Missing TELEGRAM_BOT_TOKEN (or BOT_TOKEN) / TELEGRAM_SOURCE_CHAT_ID / TELEGRAM_TARGET_GROUP_ID in .env"
    )

SOURCE_CHAT_ID = int(SRC_CHAT)
TARGET_CHAT_ID = int(DST_CHAT)
POSTGRES_ENABLED = bool(DATABASE_URL)

# ================= LOGGING =================
LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "telegram_bot.log")
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        # logging.StreamHandler(),  # keep off to avoid terminal jitter
    ]
)
log = logging.getLogger("nova.tele.forwarder")
console = Console(force_terminal=True, soft_wrap=False)

if POSTGRES_ENABLED:
    log.info("Postgres enabled.")

# ================= STATE =================
COUNTDOWN_MINUTES = 30
WINDOW_SECONDS = COUNTDOWN_MINUTES * 60
EVENT_ROWS = 10  # fixed height for recent events panel

STATE = {
    "connected": False,
    "last_error": "",
    "forwarded_count": 0,
    "parsed_count": 0,
    "last_bid_seen": None,     # type: Optional[int]
    "last_tag": None,          # type: Optional[str]
    "last_bid_at": None,       # type: Optional[datetime]
    "last_src_msg_id": None,
    "events": deque(maxlen=100),
}
STOP_EVENT = threading.Event()

def push_event(txt: str, style: str = "cyan"):
    ts = datetime.now().strftime("%H:%M:%S")
    STATE["events"].appendleft((f"[{ts}] {txt}", style))

# ============== PARSER (robust & tolerant) ==============
RX_BID     = re.compile(r"^\s*New\s+Load\s+Bid:\s*(?P<bid>\d+)\s*$", re.I | re.M)
RX_DIST    = re.compile(r"^\s*Distance:\s*(?P<miles>[\d,\.]+)\s*(?:mi|miles)?\s*$", re.I | re.M)
RX_PICKUP  = re.compile(r"^\s*Pickup:\s*(?P<pickup>.+?)\s*$", re.I | re.M)
RX_DELIV   = re.compile(r"^\s*Delivery:\s*(?P<deliv>.+?)\s*$", re.I | re.M)
RX_TAG     = re.compile(r"^\s*#(?P<tag>[A-Za-z0-9_-]+)\s*$", re.I | re.M)
RX_STOP    = re.compile(r"^\s*Stop\s*\d+:\s*(?P<place>.+?)\s*$", re.I | re.M)

def parse_datetime_string(dt_str: str) -> Optional[datetime]:
    """Parse datetime string in various formats and return in CST timezone."""
    if not dt_str:
        return None
    
    # Common datetime formats to try
    formats = [
        "%m/%d/%Y %I:%M %p",      # 09/30/2025 02:00 AM
        "%m/%d/%Y %H:%M",         # 09/30/2025 14:00
        "%m-%d-%Y %I:%M %p",      # 09-30-2025 02:00 AM
        "%m-%d-%Y %H:%M",         # 09-30-2025 14:00
        "%Y-%m-%d %H:%M",         # 2025-09-30 14:00
        "%Y-%m-%d %I:%M %p",      # 2025-09-30 02:00 PM
        "%m/%d/%Y",               # 09/30/2025 (date only)
        "%m-%d-%Y",               # 09-30-2025 (date only)
        "%Y-%m-%d",               # 2025-09-30 (date only)
    ]
    
    for fmt in formats:
        try:
            # Parse the datetime string
            parsed_dt = datetime.strptime(dt_str.strip(), fmt)
            
            # If no time component, assume 9:00 AM
            if fmt.endswith("%Y") and not any(x in fmt for x in ["%H", "%I"]):
                parsed_dt = parsed_dt.replace(hour=9, minute=0, second=0)
            
            # Set timezone to CDT since telegram messages are in local time
            from datetime import timezone, timedelta
            cdt_tz = timezone(timedelta(hours=-5))  # CDT is UTC-5
            return parsed_dt.replace(tzinfo=cdt_tz)
            
        except ValueError:
            continue
    
    # If no format matched, try to extract date and time components manually
    try:
        # Look for patterns like "09/30/2025 02:00 AM"
        import re
        date_time_match = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?', dt_str, re.IGNORECASE)
        if date_time_match:
            month, day, year, hour, minute, ampm = date_time_match.groups()
            
            # Convert to integers
            month, day, year = int(month), int(day), int(year)
            hour, minute = int(hour), int(minute)
            
            # Handle AM/PM
            if ampm and ampm.upper() == 'PM' and hour != 12:
                hour += 12
            elif ampm and ampm.upper() == 'AM' and hour == 12:
                hour = 0
            
            # Create datetime with CDT timezone since telegram messages are in local time
            from datetime import timezone, timedelta
            cdt_tz = timezone(timedelta(hours=-5))  # CDT is UTC-5
            dt = datetime(year, month, day, hour, minute, 0, tzinfo=cdt_tz)
            return dt
    except Exception:
        pass
    
    # If all parsing attempts failed, return None
    return None

def parse_bid(text: str) -> Optional[Dict]:
    if not text:
        return None
    s = text.strip()

    # Required: Bid #
    m_bid = RX_BID.search(s)
    if not m_bid:
        return None
    try:
        bid_num = int(m_bid.group("bid"))
    except Exception:
        return None

    # Optional: distance (allow commas)
    miles: Optional[float] = None
    m_dist = RX_DIST.search(s)
    if m_dist:
        raw = m_dist.group("miles").replace(",", "")
        try:
            miles = float(raw)
        except Exception:
            miles = None

    # Optional: pickup / delivery strings (parse to timestamps)
    pickup_str = RX_PICKUP.search(s).group("pickup").strip() if RX_PICKUP.search(s) else None
    delivery_str = RX_DELIV.search(s).group("deliv").strip() if RX_DELIV.search(s) else None
    
    # Parse pickup and delivery timestamps
    pickup_timestamp = None
    delivery_timestamp = None
    
    if pickup_str:
        pickup_timestamp = parse_datetime_string(pickup_str)
    
    if delivery_str:
        delivery_timestamp = parse_datetime_string(delivery_str)

    # Stops: collect all Stop N: lines anywhere
    stops: List[str] = []
    for sm in RX_STOP.finditer(s):
        place = sm.group("place").strip()
        if place:
            stops.append(place)

    # Tag: optional single hash line (#GA, #NC, etc.)
    tag = None
    m_tag = RX_TAG.search(s)
    if m_tag:
        tag = m_tag.group("tag").upper()

    return {
        "bid": bid_num,
        "miles": miles,
        "pickup_dt": pickup_str,
        "delivery_dt": delivery_str,
        "pickup_timestamp": pickup_timestamp,
        "delivery_timestamp": delivery_timestamp,
        "stops": stops,
        "tag": tag,
    }

# ================= DB =================
async def db_upsert_bid(d: Dict[str, Any]) -> None:
    """Upsert into public.telegram_bids, ensuring JSON is sent as JSON."""
    if not POSTGRES_ENABLED:
        return
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                payload = {
                    "bid_number": d.get("bid_number"),
                    "distance_miles": d.get("distance_miles"),
                    "pickup_timestamp": d.get("pickup_timestamp"),
                    "delivery_timestamp": d.get("delivery_timestamp"),
                    "stops": Json(d.get("stops") or []),  # <- wrap as JSON explicitly
                    "tag": d.get("tag"),
                    "source_channel": d.get("source_channel"),
                    "forwarded_to": d.get("forwarded_to"),
                    "received_at": d.get("received_at"),
                    "expires_at": d.get("expires_at"),
                }
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
                    payload,
                )
            await conn.commit()
        push_event(f"Upserted bid {d.get('bid_number')}", "green")
        log.info("Upserted bid %s", d.get("bid_number"))
        
        # Trigger notification processing after successful bid insertion
        if WEBHOOK_URL:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    headers = {"Content-Type": "application/json"}
                    if WEBHOOK_API_KEY:
                        headers["x-webhook-key"] = WEBHOOK_API_KEY
                    
                    payload = {"bidNumber": str(d.get("bid_number"))}
                    response = await client.post(WEBHOOK_URL, json=payload, headers=headers)
                    
                    if response.status_code == 200:
                        push_event(f"Triggered notifications for bid {d.get('bid_number')}", "cyan")
                        log.info("Triggered notifications for bid %s", d.get("bid_number"))
                    else:
                        push_event(f"Notification trigger failed: {response.status_code}", "yellow")
                        log.warning("Notification trigger failed for bid %s: %s", d.get("bid_number"), response.status_code)
            except Exception as webhook_error:
                # Don't fail bid insertion if webhook fails
                push_event(f"Webhook error (non-fatal): {str(webhook_error)[:50]}", "yellow")
                log.warning("Webhook error for bid %s (non-fatal): %s", d.get("bid_number"), webhook_error)
    except Exception as e:
        db_info = parse_database_url(DATABASE_URL)
        hostname = db_info.get('host', 'unknown')
        STATE["last_error"] = f"DB upsert failed (host: {hostname}): {e}"
        push_event(f"DB upsert failed (host: {hostname}): {e}", "red")
        log.exception("DB upsert failed - host: %s", hostname)

# ============== UI (fixed-height, stable) ==============
def _stat_row(label: str, value: str, value_style: str = "bold") -> Text:
    t = Text.assemble((f"{label}: ", "dim"), (value, value_style))
    return t

def _events_panel() -> Panel:
    rows = list(STATE["events"])[:10]
    rows += [(" ", "dim")] * max(0, 10 - len(rows))
    tbl = Table.grid(expand=True)
    tbl.add_column()
    for msg, style in rows:
        tbl.add_row(Text(msg, style=style))
    return Panel(tbl, title="Recent Events", border_style="blue")

def _window_panel() -> Panel:
    now = datetime.now(timezone.utc)
    last_at = STATE["last_bid_at"]
    width = 48
    if not last_at:
        bar = "░" * width
        text = Text.assemble(("Window ", "dim"), (bar, "grey50"), (f"  0/{WINDOW_SECONDS}s  30:00", "dim"))
        return Panel(Align.center(text), title="30-min Window", border_style="blue")

    elapsed = int(max(0, min(WINDOW_SECONDS, (now - last_at).total_seconds())))
    remain = WINDOW_SECONDS - elapsed
    filled = int(width * (elapsed / WINDOW_SECONDS))
    bar = "█" * filled + "░" * (width - filled)
    clock = f"{remain//60:02.0f}:{remain%60:02.0f}"
    text = Text.assemble(("Window ", "dim"), (bar, "cyan"), (f"  {elapsed}/{WINDOW_SECONDS}s  {clock}", "dim"))
    return Panel(Align.center(text), title="30-min Window", border_style="blue")

def render_ui() -> Panel:
    connected = STATE["connected"]
    title = Text("NOVA • Telegram Forwarder", style="bold cyan")

    top = Table.grid(expand=True)
    top.add_column(ratio=1)
    top.add_column(ratio=1, justify="right")

    left = Table.grid()
    left.add_row(_stat_row("Status", "CONNECTED" if connected else "DISCONNECTED",
                           "bold green" if connected else "bold red"))
    left.add_row(_stat_row("Source", f"{SOURCE_CHAT_ID}"))
    left.add_row(_stat_row("Target", f"{TARGET_CHAT_ID}"))

    right = Table.grid()
    right.add_row(_stat_row("Forwarded", str(STATE["forwarded_count"])))
    right.add_row(_stat_row("Parsed Bids", str(STATE["parsed_count"])))
    last_bid = str(STATE["last_bid_seen"]) if STATE["last_bid_seen"] else "—"
    last_tag = STATE["last_tag"] or "—"
    right.add_row(_stat_row("Last Bid #", last_bid))
    right.add_row(_stat_row("Last Tag", last_tag))
    top.add_row(left, right)

    if STATE["last_bid_at"]:
        now = datetime.now(timezone.utc)
        since = now - STATE["last_bid_at"]
        since_human = humanize.naturaldelta(since) if since.total_seconds() >= 1 else "just now"
        since_clock = f"{int(since.total_seconds()//60):02d}:{int(since.total_seconds()%60):02d}"
        timers = _stat_row("Since Last Bid", f"{since_human} ({since_clock})")
    else:
        timers = _stat_row("Since Last Bid", "—")

    group = Group(
        Align.center(title),
        Rule(style="cyan"),
        top,
        Rule(style="blue"),
        timers,
        _window_panel(),
        _events_panel(),
    )
    return Panel(group, border_style="cyan")

def ui_thread():
    # Stable full-screen render (no scroll)
    with Live(render_ui(), refresh_per_second=5, console=console, transient=False, screen=True) as live:
        while not STOP_EVENT.is_set():
            live.update(render_ui(), refresh=True)
            time.sleep(0.2)

# ============== HANDLER (permissive; filter inside) ==============
async def on_source_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        msg: Optional[Message] = update.effective_message or update.channel_post or update.edited_channel_post
        chat = update.effective_chat
        if not msg or not chat:
            return

        # Only process messages from the configured source channel
        if chat.id != SOURCE_CHAT_ID:
            if chat.type == "channel":
                push_event(f"Ignored channel id {chat.id} (expect {SOURCE_CHAT_ID})", "yellow")
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
            push_event(f"Forwarded post {msg.message_id}", "green")
            log.info("Forwarded message %s from %s → %s", msg.message_id, SOURCE_CHAT_ID, TARGET_CHAT_ID)
        except Exception as e:
            STATE["last_error"] = f"Forward failed: {e}"
            push_event(f"Forward failed: {e}", "red")
            log.warning("Forward failed: %s", e)

        # 2) Parse potential bid (tolerant)
        parsed = parse_bid(text)
        if parsed:
            STATE["parsed_count"] += 1
            STATE["last_bid_seen"] = parsed["bid"]
            STATE["last_tag"] = parsed.get("tag")
            STATE["last_bid_at"] = datetime.now(timezone.utc)
            tag_note = f" #{parsed['tag']}" if parsed.get("tag") else ""
            push_event(f"Parsed bid {parsed['bid']}{tag_note}", "cyan")
            log.info("Parsed bid: %s", parsed)

            # DB upsert
            if POSTGRES_ENABLED:
                now = datetime.now(timezone.utc)
                record = {
                    "bid_number": str(parsed["bid"]),
                    "distance_miles": parsed.get("miles"),
                    "pickup_timestamp": parsed.get("pickup_timestamp"),
                    "delivery_timestamp": parsed.get("delivery_timestamp"),
                    "stops": parsed.get("stops") or [],
                    "tag": parsed.get("tag"),
                    "source_channel": str(SOURCE_CHAT_ID),
                    "forwarded_to": str(TARGET_CHAT_ID),
                    "received_at": now,
                    "expires_at": now + timedelta(minutes=COUNTDOWN_MINUTES),
                }
                await db_upsert_bid(record)
        else:
            push_event("Post didn’t match bid pattern; forwarded only.", "dim")
            log.info("Message did not match bid pattern; forwarded only.")
    except Exception as e:
        STATE["last_error"] = str(e)
        push_event(f"Handler error: {e}", "red")
        log.exception("Handler error")

# ============== MAIN ==============
def main():
    # graceful shutdown
    def _sig_handler(sig, frame):
        STOP_EVENT.set()
    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)

    # start UI thread first (stable full-screen live)
    t = threading.Thread(target=ui_thread, daemon=True)
    t.start()

    # build app & handlers
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    application.add_handler(MessageHandler(filters.ChatType.CHANNEL, on_source_message))
    application.add_handler(MessageHandler(filters.ChatType.CHANNEL & filters.UpdateType.EDITED_CHANNEL_POST, on_source_message))

    async def _post_init(app): STATE["connected"] = True; push_event("Polling started.", "green")
    async def _post_stop(app): STATE["connected"] = False
    application.post_init = _post_init
    application.post_stop = _post_stop

    try:
        application.run_polling(
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=True,
            close_loop=True,
        )
    finally:
        STOP_EVENT.set()
        t.join(timeout=1.0)

if __name__ == "__main__":
    main()

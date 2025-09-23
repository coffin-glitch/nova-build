# scripts/telegram_bot_forwarder.py
# NOVA Telegram forwarder + parser + Postgres upsert + Rich UI
# Works with python-telegram-bot v22.x
import os
import re
import asyncio
import logging
import signal
from collections import deque
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

# ---- Pretty terminal UI (Rich) ----
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.layout import Layout
from rich.live import Live
from rich.progress import (
    Progress, BarColumn, TimeElapsedColumn, TextColumn
)
from rich.theme import Theme
from rich.console import Console

# ---------- Config & Logging ----------
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("nova.tele.forwarder")

BOT_TOKEN         = os.environ.get("BOT_TOKEN", "").strip() or os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
SOURCE_CHANNEL_ID = int(os.environ.get("SOURCE_CHANNEL_ID", os.environ.get("TELEGRAM_SOURCE_CHAT_ID", "0")))
TARGET_GROUP_ID   = int(os.environ.get("TARGET_GROUP_ID",   os.environ.get("TELEGRAM_TARGET_GROUP_ID", "0")))
DATABASE_URL      = os.environ.get("DATABASE_URL", "").strip()

if not BOT_TOKEN or not SOURCE_CHANNEL_ID or not TARGET_GROUP_ID:
    raise SystemExit("Missing BOT_TOKEN / SOURCE_CHANNEL_ID / TARGET_GROUP_ID in .env")

POSTGRES_ENABLED = bool(DATABASE_URL)
if POSTGRES_ENABLED:
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

# Non-VERBOSE, DOTALL+IGNORECASE
BID_RX = re.compile(
    r"(?si)"
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

# ---------- State ----------
forwarded_count = 0
parsed_count = 0
last_bid_at: Optional[datetime] = None
last_bid_number: Optional[str] = None
last_tag: Optional[str] = None
events = deque(maxlen=10)
state_lock = asyncio.Lock()

def fmt_td(td: timedelta) -> str:
    s = int(max(0, td.total_seconds()))
    m, s = divmod(s, 60)
    return f"{m:02d}:{s:02d}"

def human_td(td: timedelta) -> str:
    if td.total_seconds() < 1:
        return "just now"
    return humanize.naturaldelta(td)

def push_event(text: str):
    ts = datetime.now().strftime("%H:%M:%S")
    events.appendleft(f"[{ts}] {text}")

# ---------- Rich UI ----------
theme = Theme({
    "accent": "bold cyan",
    "good": "bold green",
    "warn": "bold yellow",
    "bad": "bold red",
    "muted": "grey62",
})
console = Console(theme=theme)

def render_dashboard() -> Panel:
    hdr = Table.grid(padding=(0, 2))
    hdr.add_column(justify="left")
    hdr.add_column(justify="right")

    since_txt = "—"
    since_clock = "—"
    cd_clock = "—"
    if last_bid_at:
        now = datetime.now(timezone.utc)
        since = now - last_bid_at
        since_txt = human_td(since)
        since_clock = fmt_td(since)
        cd_clock = fmt_td(timedelta(minutes=30) - since)

    hdr.add_row(Text("Status", style="muted"), Text("CONNECTED", style="good"))
    hdr.add_row(Text("Source", style="muted"), Text(str(SOURCE_CHANNEL_ID), style="accent"))
    hdr.add_row(Text("Target", style="muted"), Text(str(TARGET_GROUP_ID), style="accent"))
    hdr.add_row(Text("—", style="muted"), Text("—", style="muted"))
    hdr.add_row(Text("Forwarded", style="muted"), Text(str(forwarded_count), style="accent"))
    hdr.add_row(Text("Parsed Bids", style="muted"), Text(str(parsed_count), style="accent"))
    hdr.add_row(Text("Last Bid #", style="muted"), Text(last_bid_number or "—", style="accent"))
    hdr.add_row(Text("Last Tag", style="muted"), Text(last_tag or "—", style="accent"))
    hdr.add_row(Text("Since Last Bid", style="muted"), Text(f"{since_txt} ({since_clock})", style="accent"))
    hdr.add_row(Text("30-min Countdown", style="muted"), Text(cd_clock, style="accent"))

    prog = Progress(
        TextColumn("[muted]Window[/muted]"),
        BarColumn(bar_width=None),
        TextColumn("[accent]{task.completed:.0f}[/accent]/[muted]{task.total:.0f}[/muted]s"),
        TimeElapsedColumn(),
        expand=True,
        transient=False,
    )
    task_id = prog.add_task("bid_window", total=1800)
    if last_bid_at:
        elapsed = int((datetime.now(timezone.utc) - last_bid_at).total_seconds())
        prog.update(task_id, completed=max(0, min(1800, elapsed)))
    else:
        prog.update(task_id, completed=0)

    ev_table = Table.grid(padding=(0, 1))
    ev_table.add_column()
    if events:
        for e in list(events):
            ev_table.add_row(Text(e, style="muted"))
    else:
        ev_table.add_row(Text("No events yet. Waiting for next post…", style="muted"))

    layout = Layout()
    layout.split_column(
        Layout(Panel(hdr, title="[bold]NOVA • Telegram Forwarder[/bold]", border_style="cyan"), size=14),
        Layout(Panel(prog, title="30-min Window", border_style="cyan"), size=4),
        Layout(Panel(ev_table, title="Recent Events", border_style="cyan")),
    )
    return Panel(layout, border_style="cyan")

async def ui_loop(stop_event: asyncio.Event):
    push_event("UI started.")
    with Live(render_dashboard(), console=console, refresh_per_second=8, screen=True):
        while not stop_event.is_set():
            await asyncio.sleep(0.2)
            console.print(render_dashboard(), overflow="ignore", crop=False, end="")

# ---------- Telegram Handlers ----------
def _msg(update: Update) -> Optional[Message]:
    # channel_post, edited_channel_post, message, edited_message → pick the present one
    return update.channel_post or update.edited_channel_post or update.effective_message

async def on_channel_post(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global forwarded_count, parsed_count, last_bid_at, last_bid_number, last_tag

    msg = _msg(update)
    if not msg:
        return
    # Only react to the configured source channel
    if msg.chat_id != SOURCE_CHANNEL_ID:
        return

    # Forward/copy
    try:
        await context.bot.copy_message(
            chat_id=TARGET_GROUP_ID,
            from_chat_id=msg.chat_id,
            message_id=msg.message_id,
        )
        async with state_lock:
            forwarded_count += 1
        push_event(f"Forwarded channel post {msg.message_id}.")
        log.info("Forwarded %s from %s -> %s", msg.message_id, SOURCE_CHANNEL_ID, TARGET_GROUP_ID)
    except Exception as e:
        push_event(f"[bad]Forward failed: {e}[/bad]")
        log.warning("Forward failed: %s", e)

    # Parse + upsert
    text = (msg.text or msg.caption or "").strip()
    parsed = parse_bid(text)
    if not parsed:
        push_event("Post did not match bid pattern; forwarded only.")
        log.info("Post didn’t match bid pattern; forwarded only.")
        return

    now = datetime.now(timezone.utc)
    async with state_lock:
        parsed_count += 1
        last_bid_at = now
        last_bid_number = parsed.get("bid_number")
        last_tag = parsed.get("tag")

    parsed["source_channel"] = str(SOURCE_CHANNEL_ID)
    parsed["forwarded_to"]   = str(TARGET_GROUP_ID)
    parsed["received_at"]    = now
    parsed["expires_at"]     = now + timedelta(minutes=30)

    if not POSTGRES_ENABLED:
        push_event(f"Parsed bid {parsed['bid_number']} (DB disabled)")
        return

    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            await db_upsert_bid(conn, parsed)
            await conn.commit()
        push_event(f"[good]Upserted bid {parsed['bid_number']}[/good]")
        log.info("Upserted bid %s", parsed["bid_number"])
    except Exception as e:
        push_event(f"[bad]DB upsert failed: {e}[/bad]")
        log.error("DB upsert failed: %s", e)

# Fallback debug (will not forward; just logs unseen updates)
async def on_any(update: Update, _context: ContextTypes.DEFAULT_TYPE):
    # This helps diagnose if Telegram is sending a different update type than expected
    if update.channel_post:
        t = "channel_post"
    elif update.edited_channel_post:
        t = "edited_channel_post"
    elif update.message:
        t = "message"
    elif update.edited_message:
        t = "edited_message"
    else:
        t = "other"
    push_event(f"[warn]Debug update seen: {t} (chat {getattr(update.effective_chat,'id',None)})[/warn]")

def build_app() -> Application:
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    # Explicitly process CHANNEL posts from our source:
    channel_filter = filters.Chat(SOURCE_CHANNEL_ID) & filters.ChatType.CHANNEL
    app.add_handler(MessageHandler(channel_filter, on_channel_post), group=0)

    # Also catch edited channel posts:
    edited_channel_filter = filters.Chat(SOURCE_CHANNEL_ID) & filters.ChatType.CHANNEL
    app.add_handler(MessageHandler(edited_channel_filter, on_channel_post), group=1)

    # Fallback debug (lowest priority):
    app.add_handler(MessageHandler(filters.ALL, on_any), group=99)

    return app

async def run_bot(stop_event: asyncio.Event):
    app = build_app()
    push_event("Polling started.")
    await app.run_polling(
        allowed_updates=["message", "edited_message", "channel_post", "edited_channel_post"],
        close_loop=False,
        drop_pending_updates=True,
    )
    stop_event.set()

def main():
    log.info("Starting bot… listening %s → %s", SOURCE_CHANNEL_ID, TARGET_GROUP_ID)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    stop_event = asyncio.Event()

    def _graceful(*_):
        if not stop_event.is_set():
            push_event("[warn]Shutting down…[/warn]")
            stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _graceful)
        except NotImplementedError:
            pass

    async def supervisor():
        bot_task = asyncio.create_task(run_bot(stop_event))
        ui_task  = asyncio.create_task(ui_loop(stop_event))
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

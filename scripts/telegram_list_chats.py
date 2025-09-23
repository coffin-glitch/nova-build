import os
from dotenv import load_dotenv
from telethon import TelegramClient

load_dotenv(os.path.expanduser("~/.nova_telegram.env"))
API_ID = int(os.getenv("TELEGRAM_API_ID", "0"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "")

async def main():
    client = TelegramClient("storage/telethon_session", API_ID, API_HASH)
    await client.start()
    print("Your dialogs (copy ids for TARGET_GROUP_ID):")
    async for d in client.iter_dialogs():
        print(f"- title={d.name!r} id={d.id} entity={type(d.entity).__name__}")
    await client.disconnect()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

#!/usr/bin/env python3
"""
Debug script to test bid parsing with the exact text provided
"""

import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List

# Copy the regex patterns from the forwarder
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
            
            # Return the datetime in CST timezone
            # Assume the input time is already in CST and store it as such
            return parsed_dt.replace(tzinfo=timezone(timedelta(hours=-6)))  # CST is UTC-6
            
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
            
            # Create datetime in CST timezone
            dt = datetime(year, month, day, hour, minute, 0)
            return dt.replace(tzinfo=timezone(timedelta(hours=-6)))  # CST is UTC-6
    except Exception:
        pass
    
    # If all parsing attempts failed, return None
    return None

def parse_bid(text: str) -> Optional[Dict]:
    if not text:
        return None
    s = text.strip()

    print(f"Parsing text: {repr(s)}")
    print("=" * 50)

    # Required: Bid #
    m_bid = RX_BID.search(s)
    if not m_bid:
        print("❌ No bid number found")
        return None
    try:
        bid_num = int(m_bid.group("bid"))
        print(f"✅ Bid number: {bid_num}")
    except Exception as e:
        print(f"❌ Error parsing bid number: {e}")
        return None

    # Optional: distance (allow commas)
    miles: Optional[float] = None
    m_dist = RX_DIST.search(s)
    if m_dist:
        raw = m_dist.group("miles").replace(",", "")
        try:
            miles = float(raw)
            print(f"✅ Distance: {miles} miles")
        except Exception as e:
            print(f"❌ Error parsing distance: {e}")
            miles = None
    else:
        print("❌ No distance found")

    # Optional: pickup / delivery strings (parse to timestamps)
    pickup_match = RX_PICKUP.search(s)
    delivery_match = RX_DELIV.search(s)
    
    pickup_str = pickup_match.group("pickup").strip() if pickup_match else None
    delivery_str = delivery_match.group("deliv").strip() if delivery_match else None
    
    print(f"✅ Pickup string: {repr(pickup_str)}")
    print(f"✅ Delivery string: {repr(delivery_str)}")
    
    # Parse pickup and delivery timestamps
    pickup_timestamp = None
    delivery_timestamp = None
    
    if pickup_str:
        pickup_timestamp = parse_datetime_string(pickup_str)
        print(f"✅ Pickup timestamp: {pickup_timestamp}")
    
    if delivery_str:
        delivery_timestamp = parse_datetime_string(delivery_str)
        print(f"✅ Delivery timestamp: {delivery_timestamp}")

    # Stops: collect all Stop N: lines anywhere
    stops: List[str] = []
    for sm in RX_STOP.finditer(s):
        place = sm.group("place").strip()
        if place:
            stops.append(place)
    print(f"✅ Stops: {stops}")

    # Tag: optional single hash line (#GA, #NC, etc.)
    tag = None
    m_tag = RX_TAG.search(s)
    if m_tag:
        tag = m_tag.group("tag").strip()
        print(f"✅ Tag: {tag}")
    else:
        print("❌ No tag found")

    result = {
        "bid_number": str(bid_num),
        "distance_miles": miles,
        "pickup_timestamp": pickup_timestamp,
        "delivery_timestamp": delivery_timestamp,
        "stops": stops,
        "tag": tag,
    }
    
    print("=" * 50)
    print(f"Final result: {result}")
    return result

# Test with the exact bid text provided
test_bid = """New Load Bid: 87642971

Distance: 426.0 miles

Pickup: 10/13/2025 04:00 AM
Delivery: 10/13/2025 04:14 PM

🚛Stops:
  Stop 1: WARRENDALE, PA
  Stop 2: WHITE PLAINS, NY
  Stop 3: STAMFORD, CT

#PA

USPS LOADS"""

if __name__ == "__main__":
    print("Testing bid parsing...")
    result = parse_bid(test_bid)
    if result:
        print("\n✅ Parsing successful!")
    else:
        print("\n❌ Parsing failed!")

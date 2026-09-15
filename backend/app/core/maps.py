"""Google Maps link generation, local medical business structuring, and follow-up query context handling."""
import re
import urllib.parse
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("healix.maps")

# Common indicators that a query is asking for Google Maps links for previous items
_MAPS_FOLLOWUP_PATTERNS = [
    r"\b(their|these|the|those)\b.{0,40}\b(google\s*maps?|map\s*links?|maps?|directions?|location)\b",
    r"\b(google\s*maps?|map\s*links?|maps?|directions?)\b.{0,40}\b(for\s+them|for\s+these|for\s+each|for\s+their|to\s+them|to\s+these)\b",
    r"\b(directions?|maps?|links?|locations?)\s+(to|for)\s+(them|these|those|the\s+shops?|the\s+pharmaci?e?s?)\b",
    r"\bwhere\s+(are|is)\s+(these|those|them|the\s+shops?|the\s+pharmaci?e?s?)\b",
    r"\bshow\s+(these|them|those)\s+(on\s+)?(google\s*maps?|maps?)\b",
    r"\bgive\s+(me\s+)?(their\s+)?(google\s*)?map\s*links?\b",
    r"\bgive\s+(me\s+)?directions?\b",
    r"\balso\s+(their\s+)?(google\s*)?maps?\b",
    r"\blink\s+for\s+(each|them|these)\b",
]

_MAPS_FOLLOWUP_RE = re.compile("|".join(f"(?:{p})" for p in _MAPS_FOLLOWUP_PATTERNS), re.IGNORECASE)


def detect_maps_followup_intent(query: str) -> bool:
    """Returns True if the user query appears to be a follow-up asking for map links of previously discussed businesses."""
    if not query:
        return False
    q = query.strip().lower()
    return bool(_MAPS_FOLLOWUP_RE.search(q))


def generate_google_maps_url(
    name: str,
    location: Optional[str] = None,
    verified_url: Optional[str] = None
) -> str:
    """Generates a safe Google Maps URL for a business or healthcare facility.
    
    Rules:
    1. If a verified Google Maps place URL (e.g. google.com/maps/... or goo.gl/maps/...) is available, prefer it.
    2. Otherwise, prefer Google Maps Search URL format:
       https://www.google.com/maps/search/?api=1&query=<URL_ENCODED_QUERY>
    3. Safely URL encode using urllib.parse.quote.
    4. Do not invent fake street addresses; combine available name + location.
    """
    clean_name = (name or "").strip()
    clean_loc = (location or "").strip()

    if verified_url and ("google.com/maps" in verified_url or "goo.gl/maps" in verified_url):
        return verified_url

    parts = []
    if clean_name:
        parts.append(clean_name)
    if clean_loc:
        parts.append(clean_loc)

    full_query = " ".join(parts).strip() or "Medical Shop"
    encoded_query = urllib.parse.quote(full_query)
    return f"https://www.google.com/maps/search/?api=1&query={encoded_query}"


def extract_businesses_from_text(text: str) -> List[Dict[str, str]]:
    """Extracts business names and locations from previous assistant message text (tables, numbered lists, or bullet points)."""
    if not text:
        return []

    businesses: List[Dict[str, str]] = []
    seen_names = set()

    lines = [line.strip() for line in text.split("\n") if line.strip()]

    # Pattern A: Table rows (| 1 | Apollo Pharmacy | Ellis Nagar, Madurai | ...)
    for line in lines:
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if len(cells) >= 2:
                # Check if it's a separator or header row
                if all(re.match(r"^:?-+:?$", c) for c in cells if c) or "---" in cells[0]:
                    continue
                first_clean = re.sub(r"[*_`]", "", cells[0]).strip().lower()
                second_clean = re.sub(r"[*_`]", "", cells[1]).strip().lower()
                if first_clean in ("#", "sl", "s.no", "no", "item") and any(h in second_clean for h in ["medical", "pharmacy", "shop", "facility", "name"]):
                    continue
                if first_clean in ("medical shop", "pharmacy", "medical shop / facility", "facility", "shop name", "business name", "name"):
                    continue

                # Cell 0 might be '#' and Cell 1 is Name, or Cell 0 is Name
                name = ""
                loc = ""
                if re.match(r"^\d+$", cells[0]):
                    name = cells[1]
                    if len(cells) > 2:
                        loc = cells[2]
                else:
                    name = cells[0]
                    if len(cells) > 1:
                        loc = cells[1]

                # Strip markdown bold or link markers
                name = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", name)
                name = re.sub(r"[*_`]", "", name).strip()
                loc = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", loc)
                loc = re.sub(r"[*_`]", "", loc).strip()

                if name and len(name) > 2 and name.lower() not in seen_names:
                    seen_names.add(name.lower())
                    businesses.append({
                        "name": name,
                        "location": loc,
                        "googleMapsUrl": generate_google_maps_url(name, loc)
                    })

    if businesses:
        return businesses

    # Pattern B: Numbered list (1. **Apollo Pharmacy** - Ellis Nagar...)
    num_list_re = re.compile(
        r"^(?:\d+[\.\)]|\*|-)\s+\*?\*?([A-Za-z0-9\s&'\.,\-]+?)\*?\*?\s*(?:[-:–—|]\s*(.+))?$",
        re.MULTILINE
    )

    for line in lines:
        match = num_list_re.match(line)
        if match:
            raw_name = match.group(1).strip()
            raw_loc = (match.group(2) or "").strip()

            # Clean name
            clean_name = re.sub(r"[*_`]", "", raw_name).strip()
            clean_loc = re.sub(r"[*_`]", "", raw_loc).strip()

            # Skip common non-business headers
            if clean_name.lower() in ("medical shop", "pharmacy", "name", "location", "address", "source"):
                continue

            if clean_name and len(clean_name) > 2 and clean_name.lower() not in seen_names:
                # If loc contains additional sentence or link, shorten to location phrase
                clean_loc = clean_loc.split(".")[0].strip()
                seen_names.add(clean_name.lower())
                businesses.append({
                    "name": clean_name,
                    "location": clean_loc,
                    "googleMapsUrl": generate_google_maps_url(clean_name, clean_loc)
                })

    return businesses


def extract_local_businesses_from_search(
    query: str,
    search_results: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Extracts structured local business entities from search result snippets without hallucinating addresses."""
    extracted = []
    seen = set()

    # Extract area/city hints from user query (e.g. "Ellis Nagar, Madurai - 625016")
    area_hint = ""
    city_match = re.search(r"(?:near|in|at)\s+([A-Za-z0-9\s,\-]+(?:\d{6})?)", query, re.IGNORECASE)
    if city_match:
        area_hint = city_match.group(1).strip()

    # Known business name patterns in healthcare / retail pharmacy
    shop_keyword_pattern = re.compile(
        r"\b([A-Z][A-Za-z0-9'&.\s]{2,40}?\s+(?:Pharmacy|Medicals|Medical\s+Hall|Medical\s+Shop|Drug\s+Store|Chemist|Hospital|Clinic|Ayurveda|Ayurved))\b",
        re.IGNORECASE
    )

    for item in search_results:
        title = item.get("title", "")
        content = item.get("content", "")
        url = item.get("url", "")
        combined = f"{title}\n{content}"

        # 1. Look for verified direct Google Maps URLs in the source
        verified_map_url = None
        if "google.com/maps" in url or "goo.gl/maps" in url:
            verified_map_url = url

        # 2. Match shop names in title and content
        matches = shop_keyword_pattern.findall(combined)
        for m in matches:
            shop_name = m.strip()
            # Clean punctuation from ends
            shop_name = re.sub(r"^[\s,.\-:]+|[\s,.\-:]+$", "", shop_name)
            norm_key = shop_name.lower()
            if norm_key in seen or len(shop_name) < 4:
                continue

            # Check if there is an address or location near this mention in snippet
            address_extracted = ""
            # Search for pincode or road/street in snippet
            pincode_match = re.search(r"(?:No[:.]?\s*\d+[^,\n]+,\s*)?([A-Za-z0-9\s,.\-']*(?:Nagar|Road|Street|Bazaar|Colony|Main\s+Road|Cross)[A-Za-z0-9\s,.\-']*(?:\d{6})?)", content, re.IGNORECASE)
            if pincode_match:
                candidate = pincode_match.group(0).strip()
                if len(candidate) > 5 and len(candidate) < 120:
                    address_extracted = candidate

            if not address_extracted and area_hint:
                address_extracted = area_hint

            seen.add(norm_key)
            maps_link = generate_google_maps_url(
                name=shop_name,
                location=address_extracted,
                verified_url=verified_map_url
            )

            extracted.append({
                "name": shop_name,
                "address": address_extracted,
                "source": url,
                "googleMapsUrl": maps_link
            })

    return extracted

"""Healthcare safety utilities and keyword detection."""
import re

EMERGENCY_KEYWORDS = [
    r"\bchest\s*pain\b",
    r"\bheart\s*attack\b",
    r"\bstroke\b",
    r"\bcan\'?t\s*breathe\b",
    r"\bshortness\s*of\s*breath\b",
    r"\bsevere\s*bleeding\b",
    r"\bsuicid(e|al)\b",
    r"\bkill\s*myself\b",
    r"\banaphyla(xis|ctic)\b",
    r"\bseizure\b",
    r"\bunconscious\b",
    r"\bchoking\b",
    r"\bpoison(ing|ed)?\b",
]

EMERGENCY_REGEX = re.compile("|".join(EMERGENCY_KEYWORDS), re.IGNORECASE)

EMERGENCY_BANNER = (
    "> [!CAUTION]\n"
    "> **EMERGENCY WARNING**: If you or someone around you is experiencing severe, sudden, or life-threatening symptoms "
    "(such as acute chest pain, shortness of breath, sudden numbness, or severe injury), "
    "please call your local emergency services (911 / 112 / local emergency) or go to the nearest emergency department immediately.\n\n"
)

MEDICAL_DISCLAIMER_SUFFIX = (
    "\n\n---\n*Disclaimer: Healix is an AI healthcare assistant providing informational guidance. "
    "It is not a substitute for professional medical advice, diagnosis, or treatment. "
    "Always consult with a qualified healthcare provider for medical concerns.*"
)

def check_emergency_indicators(text: str) -> bool:
    """Checks if the user message contains indicators of a medical emergency."""
    return bool(EMERGENCY_REGEX.search(text))

import re

# Basic regex for common secrets
PATTERNS = [
    r'(?i)(api[_-]?key[\s=:]+)(["\']?[a-zA-Z0-9_\-]{16,}["\']?)',
    r'(?i)(password[\s=:]+)(["\']?[^"\'\s]+["\']?)',
    r'(?i)(secret[\s=:]+)(["\']?[^"\'\s]+["\']?)',
    r'(?i)(token[\s=:]+)(["\']?[a-zA-Z0-9_\-\.]{20,}["\']?)',
]

def redact_text(text: str) -> str:
    if not text:
        return text
    redacted = text
    for pattern in PATTERNS:
        # We replace group 2 with [REDACTED]
        def repl(m):
            return m.group(1) + '"[REDACTED]"'
        redacted = re.sub(pattern, repl, redacted)
    return redacted

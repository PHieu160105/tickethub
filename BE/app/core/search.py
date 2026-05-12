"""Shared helpers for safe search query handling."""


def sanitize_search_query(search: str | None, max_length: int = 120) -> str | None:
    """Normalize search input and reject oversized payloads."""

    if search is None:
        return None

    normalized = " ".join(search.split()).strip()
    if not normalized:
        return None
    if len(normalized) > max_length:
        raise ValueError("Search query too long")
    return normalized


def build_ilike_pattern(search: str | None, max_length: int = 120) -> str | None:
    """Escape wildcard characters for literal ILIKE matching."""

    normalized = sanitize_search_query(search, max_length=max_length)
    if normalized is None:
        return None

    escaped = normalized.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"

"""Schema gợi ý tìm kiếm hợp nhất."""

from pydantic import BaseModel


class SearchSuggestionItem(BaseModel):
    label: str
    value: str
    item_type: str
    meta: dict[str, str | int | float | None] = {}

"""Cung cấp các hàm hỗ trợ chuẩn hóa và bảo vệ truy vấn tìm kiếm."""


def sanitize_search_query(search: str | None, max_length: int = 120) -> str | None:
    """Chuẩn hóa chuỗi tìm kiếm và chặn payload quá dài.

    Input:
    - `search`: chuỗi tìm kiếm người dùng nhập.
    - `max_length`: độ dài tối đa cho phép.

    Output:
    - Chuỗi đã được làm sạch hoặc `None` nếu chuỗi rỗng.

    Cách hoạt động:
    - Gộp nhiều khoảng trắng liên tiếp thành một khoảng trắng.
    - Cắt khoảng trắng đầu/cuối.
    - Chặn chuỗi quá dài để tránh query nặng và payload bất thường.
    """

    if search is None:
        # Không có từ khóa thì caller không cần thêm điều kiện tìm kiếm vào SQL.
        return None

    # `split()` bỏ mọi loại khoảng trắng lặp; `"  rock   show "` thành `"rock show"`.
    normalized = " ".join(search.split()).strip()
    if not normalized:
        # Chuỗi toàn khoảng trắng được coi như không tìm kiếm.
        return None
    if len(normalized) > max_length:
        # Chặn sớm payload quá dài để tránh câu SQL ILIKE tốn tài nguyên.
        raise ValueError("Từ khóa tìm kiếm quá dài")
    return normalized


def build_ilike_pattern(search: str | None, max_length: int = 120) -> str | None:
    """Tạo pattern an toàn cho truy vấn `ILIKE` theo nghĩa literal.

    Input:
    - Chuỗi tìm kiếm thô của người dùng.

    Output:
    - Pattern dạng `%...%` đã escape ký tự wildcard.

    Cách hoạt động:
    - Gọi `sanitize_search_query` để làm sạch đầu vào.
    - Escape `\\`, `%`, `_` để người dùng không vô tình/ác ý điều khiển wildcard SQL.
    """

    normalized = sanitize_search_query(search, max_length=max_length)
    if normalized is None:
        return None

    # Escape wildcard SQL để ký tự người dùng nhập được hiểu là chữ thường, không phải toán tử tìm kiếm.
    escaped = normalized.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    # Thêm `%` hai đầu để tìm chuỗi con, ví dụ nhập "rock" sẽ khớp "Rock Night".
    return f"%{escaped}%"

"""Xử lý SVG/ảnh nền để trích xuất tọa độ ghế."""

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status


ALLOWED_SVG_ELEMENTS = {"svg", "g", "circle", "rect", "path", "polygon", "line", "text", "ellipse", "defs", "use", "title", "desc"}
MAX_SVG_DEPTH = 20
MIN_VIEWBOX_SIZE = 100
MAX_SVG_SIZE_BYTES = 10 * 1024 * 1024


@dataclass
class ExtractedSeat:
    """Một ghế đã trích xuất từ file SVG."""

    seat_id: str  # Lấy từ ID của phần tử SVG.
    label: str
    x: float  # Tọa độ X đã chuẩn hóa về phần trăm 0-100.
    y: float  # Tọa độ Y đã chuẩn hóa về phần trăm 0-100.
    rotation: float  # Góc xoay tính theo độ.
    section: str | None  # Tên khu vực lấy từ nhóm SVG chứa ghế.


@dataclass
class ProcessingResult:
    """Kết quả sau khi xử lý sơ đồ SVG."""

    seats: list[ExtractedSeat]
    sections: list[dict[str, Any]]  # Danh sách khu vực phát hiện được.
    width: int
    height: int
    svg_processed: str  # SVG đã được gắn thêm metadata nhận diện ghế.


class MapProcessor:
    """Xử lý file SVG để lấy tọa độ ghế và metadata khu vực."""

    def _sanitize_svg(self, svg_content: str) -> str:
        """Loại bỏ thành phần nguy hiểm khỏi SVG để giảm rủi ro XSS."""
        # Xóa thẻ script vì có thể chạy mã JavaScript khi render SVG.
        svg_content = re.sub(r"<script[^>]*>.*?</script>", "", svg_content, flags=re.DOTALL | re.IGNORECASE)
        # Xóa các handler dạng onclick/onload để SVG không tự thực thi hành vi.
        svg_content = re.sub(r"\s+on\w+\s*=\s*\"[^\"]*\"", "", svg_content, flags=re.IGNORECASE)
        svg_content = re.sub(r"\s+on\w+\s*=\s*'[^']*'", "", svg_content, flags=re.IGNORECASE)
        # Xóa tham chiếu ngoài để tránh tải tài nguyên không kiểm soát.
        svg_content = re.sub(r"xlink:href\s*=\s*\"[^\"]*\"", "", svg_content, flags=re.IGNORECASE)
        svg_content = re.sub(r"href\s*=\s*\"[^\"]*\"", "", svg_content, flags=re.IGNORECASE)
        return svg_content

    def _validate_svg(self, svg_content: str) -> None:
        """Kiểm tra SVG trước khi phân tích để chặn file quá lớn hoặc cấu trúc không hợp lệ."""
        if len(svg_content.encode("utf-8")) > MAX_SVG_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File SVG vượt quá dung lượng tối đa 10MB",
            )

        try:
            root = ET.fromstring(svg_content)
        except ET.ParseError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Định dạng SVG không hợp lệ: {str(e)}",
            )

        # Kiểm tra danh sách phần tử được phép và độ sâu lồng nhau.
        depth = 0
        for elem in root.iter():
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            if tag not in ALLOWED_SVG_ELEMENTS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"SVG chứa phần tử không được phép: {tag}",
                )
            # Ước lượng độ sâu bằng cách lần ngược cây cha.
            d = 0
            parent = elem
            while parent is not None:
                parent = self._get_parent(root, parent)
                d += 1
            depth = max(depth, d)

        if depth > MAX_SVG_DEPTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Độ sâu lồng nhau của SVG vượt quá {MAX_SVG_DEPTH}",
            )

        # SVG phải có viewBox hoặc cặp width/height để quy đổi tọa độ.
        viewbox = root.get("viewBox", "").split()
        width_attr = root.get("width")
        height_attr = root.get("height")
        if len(viewbox) != 4 and (not width_attr or not height_attr):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SVG phải có thuộc tính viewBox hoặc width/height",
            )

    def _get_parent(self, root: ET.Element, child: ET.Element) -> ET.Element | None:
        """Tìm phần tử cha trực tiếp của một phần tử SVG."""
        for parent in root.iter():
            for c in parent:
                if c is child:
                    return parent
        return None

    def _get_dimensions(self, root: ET.Element) -> tuple[int, int]:
        """Trích xuất chiều rộng và chiều cao làm hệ quy chiếu tọa độ SVG."""
        viewbox = root.get("viewBox", "").split()
        if len(viewbox) == 4:
            width = int(float(viewbox[2]))
            height = int(float(viewbox[3]))
        else:
            width = int(float(root.get("width", 1000)))
            height = int(float(root.get("height", 600)))

        if width < MIN_VIEWBOX_SIZE or height < MIN_VIEWBOX_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kích thước SVG phải tối thiểu {MIN_VIEWBOX_SIZE}x{MIN_VIEWBOX_SIZE}",
            )

        return width, height

    def process_svg(self, svg_content: str) -> ProcessingResult:
        """
        Phân tích SVG và trích xuất vị trí ghế.

        Input:
        - SVG có ghế biểu diễn bằng circle, rect hoặc ellipse.
        - Mỗi ghế có `id` hoặc `data-seat-id`.
        - Nhóm `g` hoặc thuộc tính `data-section` được dùng để nhận diện khu vực.

        Output:
        - `ProcessingResult` gồm danh sách ghế, khu vực, kích thước và SVG đã làm sạch.
        """
        svg_content = self._sanitize_svg(svg_content)
        self._validate_svg(svg_content)

        root = ET.fromstring(svg_content)
        width, height = self._get_dimensions(root)

        # Chuẩn bị danh sách ghế và khu vực được phát hiện trong SVG.
        seats: list[ExtractedSeat] = []
        sections: dict[str, dict[str, Any]] = {}

        # Tạo bản đồ cha-con để xác định ghế thuộc nhóm/khu vực nào mà không phải duyệt lại nhiều lần.
        parent_map: dict[ET.Element, ET.Element] = {}
        for parent in root.iter():
            for child in parent:
                parent_map[child] = parent

        # Tìm mọi phần tử có thể đại diện cho ghế.
        for elem in root.iter():
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            seat_id = elem.get("id") or elem.get("data-seat-id")

            # Nếu thiếu data-seat-id, vẫn nhận diện phần tử theo mẫu nhãn ghế như A1 hoặc B12.
            if not seat_id and tag in ("circle", "rect", "ellipse"):
                elem_id = elem.get("id", "")
                if elem_id and re.match(r"^[A-Z]\d+$", elem_id):
                    seat_id = elem_id

            if not seat_id:
                continue

            # Lấy tọa độ từ cx/cy hoặc x/y tùy loại phần tử SVG.
            cx = elem.get("cx")
            cy = elem.get("cy")
            if cx is None or cy is None:
                cx = elem.get("x")
                cy = elem.get("y")
            if cx is None or cy is None:
                continue

            # Quy đổi tọa độ tuyệt đối sang phần trăm để frontend render độc lập kích thước.
            try:
                x_norm = (float(cx) / width) * 100
                y_norm = (float(cy) / height) * 100
            except ValueError:
                continue

            # Lấy góc xoay từ thuộc tính transform nếu có.
            transform = elem.get("transform", "")
            rotation = self._extract_rotation(transform)

            # Xác định khu vực từ nhóm cha gần nhất.
            section_name = None
            parent = parent_map.get(elem)
            while parent is not None:
                parent_tag = parent.tag.split("}")[-1] if "}" in parent.tag else parent.tag
                if parent_tag == "g":
                    group_id = parent.get("id")
                    if group_id:
                        section_name = group_id
                        break
                parent = parent_map.get(parent)

            # Thuộc tính data-section có độ ưu tiên cao hơn nhóm cha.
            data_section = elem.get("data-section")
            if data_section:
                section_name = data_section

            seats.append(
                ExtractedSeat(
                    seat_id=seat_id,
                    label=seat_id,
                    x=round(x_norm, 2),
                    y=round(y_norm, 2),
                    rotation=rotation,
                    section=section_name,
                )
            )

            # Ghi nhận khu vực mới để frontend tạo danh sách section gợi ý.
            if section_name and section_name not in sections:
                sections[section_name] = {
                    "name": section_name,
                    "code": section_name.upper()[:10],
                    "color": "#024ddf",
                }

        if not seats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không tìm thấy phần tử ghế trong SVG",
            )

        # Sinh SVG đã gắn metadata ghế để có thể kiểm tra/hiển thị lại.
        svg_processed = self._add_seat_markers(root, seats)

        return ProcessingResult(
            seats=seats,
            sections=list(sections.values()),
            width=width,
            height=height,
            svg_processed=svg_processed,
        )

    def _extract_rotation(self, transform: str) -> float:
        """Trích xuất góc xoay từ thuộc tính transform của SVG."""
        if not transform:
            return 0.0
        match = re.search(r"rotate\((-?\d+(?:\.\d+)?)", transform)
        return float(match.group(1)) if match else 0.0

    def _add_seat_markers(self, root: ET.Element, seats: list[ExtractedSeat]) -> str:
        """Gắn thêm data attribute để SVG sau xử lý nhận diện được từng ghế."""
        seat_map = {s.seat_id: s for s in seats}
        for elem in root.iter():
            elem_id = elem.get("id") or elem.get("data-seat-id")
            if elem_id and elem_id in seat_map:
                seat = seat_map[elem_id]
                elem.set("data-x", str(seat.x))
                elem.set("data-y", str(seat.y))
                elem.set("data-label", seat.label)
                if seat.section:
                    elem.set("data-section", seat.section)
        return ET.tostring(root, encoding="unicode")


async def process_venue_svg(venue_id: int, svg_content: str) -> ProcessingResult:
    """Điểm vào chính khi API cần xử lý SVG của một địa điểm."""
    processor = MapProcessor()
    return processor.process_svg(svg_content)

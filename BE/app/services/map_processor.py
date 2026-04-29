"""SVG/Image processing to extract seat coordinates."""

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
    """One extracted seat from SVG."""

    seat_id: str  # From SVG element ID
    label: str
    x: float  # Normalized 0-100%
    y: float  # Normalized 0-100%
    rotation: float  # degrees
    section: str | None  # Section name from group


@dataclass
class ProcessingResult:
    """Result from map processing."""

    seats: list[ExtractedSeat]
    sections: list[dict[str, Any]]  # Detected sections
    width: int
    height: int
    svg_processed: str  # SVG with seat markers added


class MapProcessor:
    """Process SVG files to extract seat coordinates."""

    def _sanitize_svg(self, svg_content: str) -> str:
        """Remove dangerous elements from SVG to prevent XSS."""
        # Remove script tags
        svg_content = re.sub(r"<script[^>]*>.*?</script>", "", svg_content, flags=re.DOTALL | re.IGNORECASE)
        # Remove event handlers
        svg_content = re.sub(r"\s+on\w+\s*=\s*\"[^\"]*\"", "", svg_content, flags=re.IGNORECASE)
        svg_content = re.sub(r"\s+on\w+\s*=\s*'[^']*'", "", svg_content, flags=re.IGNORECASE)
        # Remove external references
        svg_content = re.sub(r"xlink:href\s*=\s*\"[^\"]*\"", "", svg_content, flags=re.IGNORECASE)
        svg_content = re.sub(r"href\s*=\s*\"[^\"]*\"", "", svg_content, flags=re.IGNORECASE)
        return svg_content

    def _validate_svg(self, svg_content: str) -> None:
        """Validate SVG before processing."""
        if len(svg_content.encode("utf-8")) > MAX_SVG_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SVG file exceeds maximum size of 10MB",
            )

        try:
            root = ET.fromstring(svg_content)
        except ET.ParseError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid SVG format: {str(e)}",
            )

        # Check allowed elements and depth
        depth = 0
        for elem in root.iter():
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            if tag not in ALLOWED_SVG_ELEMENTS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"SVG contains disallowed element: {tag}",
                )
            # Estimate depth via parent traversal
            d = 0
            parent = elem
            while parent is not None:
                parent = self._get_parent(root, parent)
                d += 1
            depth = max(depth, d)

        if depth > MAX_SVG_DEPTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SVG nesting depth exceeds {MAX_SVG_DEPTH}",
            )

        # Check viewBox or width/height
        viewbox = root.get("viewBox", "").split()
        width_attr = root.get("width")
        height_attr = root.get("height")
        if len(viewbox) != 4 and (not width_attr or not height_attr):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SVG must have viewBox or width/height attributes",
            )

    def _get_parent(self, root: ET.Element, child: ET.Element) -> ET.Element | None:
        """Find parent of an element."""
        for parent in root.iter():
            for c in parent:
                if c is child:
                    return parent
        return None

    def _get_dimensions(self, root: ET.Element) -> tuple[int, int]:
        """Extract width and height from SVG."""
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
                detail=f"SVG dimensions must be at least {MIN_VIEWBOX_SIZE}x{MIN_VIEWBOX_SIZE}",
            )

        return width, height

    def process_svg(self, svg_content: str) -> ProcessingResult:
        """
        Parse SVG and extract seat positions.

        Expected SVG format:
        - Seats represented as <circle> or <rect> elements
        - Groups <g> with id="section_name" to identify zones
        - Each seat element has id="seat_label" or data-seat-id

        Returns:
            ProcessingResult with extracted seats and metadata
        """
        svg_content = self._sanitize_svg(svg_content)
        self._validate_svg(svg_content)

        root = ET.fromstring(svg_content)
        width, height = self._get_dimensions(root)

        # Extract seats from SVG elements
        seats: list[ExtractedSeat] = []
        sections: dict[str, dict[str, Any]] = {}

        # Build parent map for efficient lookup
        parent_map: dict[ET.Element, ET.Element] = {}
        for parent in root.iter():
            for child in parent:
                parent_map[child] = parent

        # Find all seat elements (circles, rects with data-seat attribute or id pattern)
        for elem in root.iter():
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            seat_id = elem.get("id") or elem.get("data-seat-id")

            # Also treat circle/rect/ellipse with id matching seat pattern as seats
            if not seat_id and tag in ("circle", "rect", "ellipse"):
                elem_id = elem.get("id", "")
                if elem_id and re.match(r"^[A-Z]\d+$", elem_id):
                    seat_id = elem_id

            if not seat_id:
                continue

            # Get position from cx/cy or x/y
            cx = elem.get("cx")
            cy = elem.get("cy")
            if cx is None or cy is None:
                cx = elem.get("x")
                cy = elem.get("y")
            if cx is None or cy is None:
                continue

            # Calculate normalized coordinates
            try:
                x_norm = (float(cx) / width) * 100
                y_norm = (float(cy) / height) * 100
            except ValueError:
                continue

            # Get rotation from transform
            transform = elem.get("transform", "")
            rotation = self._extract_rotation(transform)

            # Determine section from parent group
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

            # Override section from data-section attribute
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

            # Track sections
            if section_name and section_name not in sections:
                sections[section_name] = {
                    "name": section_name,
                    "code": section_name.upper()[:10],
                    "color": "#024ddf",
                }

        if not seats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No seat elements found in SVG",
            )

        # Generate processed SVG with markers
        svg_processed = self._add_seat_markers(root, seats)

        return ProcessingResult(
            seats=seats,
            sections=list(sections.values()),
            width=width,
            height=height,
            svg_processed=svg_processed,
        )

    def _extract_rotation(self, transform: str) -> float:
        """Extract rotation angle from SVG transform attribute."""
        if not transform:
            return 0.0
        match = re.search(r"rotate\((-?\d+(?:\.\d+)?)", transform)
        return float(match.group(1)) if match else 0.0

    def _add_seat_markers(self, root: ET.Element, seats: list[ExtractedSeat]) -> str:
        """Add data attributes to SVG for seat identification."""
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
    """Main entry point for SVG processing."""
    processor = MapProcessor()
    return processor.process_svg(svg_content)

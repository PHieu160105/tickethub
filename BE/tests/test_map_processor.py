"""Tests for SVG map processor."""

import pytest
from fastapi import HTTPException

from app.services.map_processor import MapProcessor, process_venue_svg


class TestMapProcessor:
    """Unit tests for MapProcessor."""

    def test_process_simple_svg(self):
        """Test processing SVG with basic seat elements."""
        svg = """
        <svg viewBox="0 0 1000 600">
          <circle id="A1" cx="100" cy="100" r="10" />
          <circle id="A2" cx="150" cy="100" r="10" />
        </svg>
        """
        processor = MapProcessor()
        result = processor.process_svg(svg)

        assert len(result.seats) == 2
        assert result.seats[0].label == "A1"
        assert result.seats[0].x == 10.0  # 100/1000 * 100
        assert result.seats[0].y == 16.67  # 100/600 * 100
        assert result.width == 1000
        assert result.height == 600

    def test_process_svg_with_sections(self):
        """Test processing SVG with section groups."""
        svg = """
        <svg viewBox="0 0 1000 600">
          <g id="VIP">
            <circle id="A1" cx="100" cy="100" r="10" />
          </g>
          <g id="Standard">
            <circle id="B1" cx="100" cy="300" r="10" />
          </g>
        </svg>
        """
        processor = MapProcessor()
        result = processor.process_svg(svg)

        assert len(result.sections) == 2
        assert result.seats[0].section == "VIP"
        assert result.seats[1].section == "Standard"

    def test_rotation_extraction(self):
        """Test rotation extraction from transform attribute."""
        processor = MapProcessor()
        rotation = processor._extract_rotation("rotate(45 100 100)")
        assert rotation == 45.0

        rotation = processor._extract_rotation("")
        assert rotation == 0.0

        rotation = processor._extract_rotation("rotate(-15)")
        assert rotation == -15.0

    def test_process_svg_with_data_attributes(self):
        """Test processing SVG with data-seat-id and data-section."""
        svg = """
        <svg viewBox="0 0 1000 600">
          <circle data-seat-id="A1" cx="100" cy="100" data-section="VIP" />
          <rect data-seat-id="B1" x="200" y="200" width="20" height="20" data-section="Standard" />
        </svg>
        """
        processor = MapProcessor()
        result = processor.process_svg(svg)

        assert len(result.seats) == 2
        assert result.seats[0].label == "A1"
        assert result.seats[0].section == "VIP"
        assert result.seats[1].label == "B1"
        assert result.seats[1].section == "Standard"

    def test_invalid_svg(self):
        """Test error handling for invalid SVG."""
        processor = MapProcessor()
        with pytest.raises(HTTPException) as exc_info:
            processor.process_svg("<not-svg>")
        assert exc_info.value.status_code == 400

    def test_no_seats_found(self):
        """Test error when no seats are found."""
        svg = """
        <svg viewBox="0 0 1000 600">
          <circle cx="100" cy="100" r="10" />
        </svg>
        """
        processor = MapProcessor()
        with pytest.raises(HTTPException) as exc_info:
            processor.process_svg(svg)
        assert exc_info.value.status_code == 400
        assert "No seat elements found" in exc_info.value.detail

    def test_svg_sanitization(self):
        """Test that dangerous elements are removed."""
        svg = """
        <svg viewBox="0 0 1000 600">
          <script>alert('xss')</script>
          <circle id="A1" cx="100" cy="100" r="10" onclick="alert('xss')" />
        </svg>
        """
        processor = MapProcessor()
        result = processor.process_svg(svg)
        assert len(result.seats) == 1
        assert "script" not in result.svg_processed.lower()
        assert "onclick" not in result.svg_processed.lower()

    def test_dimensions_from_width_height(self):
        """Test extracting dimensions from width/height attributes."""
        svg = """
        <svg width="800" height="400">
          <circle id="A1" cx="100" cy="100" r="10" />
        </svg>
        """
        processor = MapProcessor()
        result = processor.process_svg(svg)
        assert result.width == 800
        assert result.height == 400
        assert result.seats[0].x == 12.5  # 100/800 * 100

    @pytest.mark.asyncio
    async def test_process_venue_svg_async(self):
        """Test async entry point."""
        svg = """
        <svg viewBox="0 0 1000 600">
          <circle id="A1" cx="100" cy="100" r="10" />
        </svg>
        """
        result = await process_venue_svg(1, svg)
        assert len(result.seats) == 1
        assert result.seats[0].label == "A1"

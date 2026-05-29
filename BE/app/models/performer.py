"""Khai báo các model ORM cho nghệ sĩ và lineup gắn với show."""

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import PerformerRole, sa_enum


class Performer(TimestampMixin, Base):

    __tablename__ = "performers"
    __table_args__ = (
        UniqueConstraint("stage_name_normalized", name="uq_performers_stage_name_normalized"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    stage_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stage_name_normalized: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    artist_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    show_links = relationship("ShowPerformer", back_populates="performer", cascade="all,delete-orphan")


class ShowPerformer(TimestampMixin, Base):
    __tablename__ = "show_performers"
    __table_args__ = (
        UniqueConstraint("show_id", "performer_id", name="uq_show_performers_show_id_performer_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    performer_id: Mapped[int] = mapped_column(ForeignKey("performers.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[PerformerRole] = mapped_column(
        sa_enum(PerformerRole),
        default=PerformerRole.BACKUP,
        nullable=False,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    show = relationship("Show", back_populates="show_performers")
    performer = relationship("Performer", back_populates="show_links")

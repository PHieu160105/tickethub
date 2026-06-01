"""Post-payment ticket delivery via email, with SMS extension points for later."""

from __future__ import annotations

import html
import json
import logging
from dataclasses import dataclass
from decimal import Decimal

import aiosmtplib
from email_validator import EmailNotValidError, validate_email
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from fastapi_mail.connection import Connection
from fastapi_mail.errors import ConnectionErrors, PydanticClassRequired
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.enums import OrderStatus
from app.models.order import Order, TransactionLog
from app.schemas.booking import CheckoutItemResponse

EMAIL_SENT_ACTION = "TICKET_DELIVERY_EMAIL_SENT"
EMAIL_FAILED_ACTION = "TICKET_DELIVERY_EMAIL_FAILED"
EMAIL_SKIPPED_ACTION = "TICKET_DELIVERY_EMAIL_SKIPPED"

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class TicketDeliveryOrderPayload:
    order_id: int
    order_code: str
    buyer_name: str
    buyer_email: str
    buyer_phone: str
    total_amount: Decimal
    payment_provider: str
    paid_at_iso: str
    items: list[CheckoutItemResponse]


class EmailTicketDeliveryProvider:
    async def send(self, payload: TicketDeliveryOrderPayload) -> None:  # pragma: no cover - interface
        raise NotImplementedError


class SmsTicketDeliveryProvider:
    async def send(self, payload: TicketDeliveryOrderPayload) -> None:  # pragma: no cover - interface
        raise NotImplementedError


class NoopSmsTicketDeliveryProvider(SmsTicketDeliveryProvider):
    async def send(self, payload: TicketDeliveryOrderPayload) -> None:
        _ = payload


class TicketDeliveryConnectionConfig(ConnectionConfig):
    MAIL_LOCAL_HOSTNAME: str = "localhost.localdomain"


class TicketDeliveryConnection(Connection):
    def __init__(self, settings: TicketDeliveryConnectionConfig) -> None:
        super().__init__(settings)

    async def _configure_connection(self) -> None:
        try:
            self.session = aiosmtplib.SMTP(
                hostname=self.settings.MAIL_SERVER,
                timeout=self.settings.TIMEOUT,
                port=self.settings.MAIL_PORT,
                use_tls=self.settings.MAIL_SSL_TLS,
                start_tls=self.settings.MAIL_STARTTLS,
                validate_certs=self.settings.VALIDATE_CERTS,
                local_hostname=self.settings.MAIL_LOCAL_HOSTNAME,
            )
            if not self.settings.SUPPRESS_SEND:
                await self.session.connect()
                if self.settings.USE_CREDENTIALS:
                    await self.session.login(self.settings.MAIL_USERNAME, self.settings.MAIL_PASSWORD)
        except Exception as error:
            raise ConnectionErrors(
                f"Exception raised {error}, check your credentials or email service configuration"
            ) from error


class TicketDeliveryFastMail(FastMail):
    def __init__(self, config: TicketDeliveryConnectionConfig) -> None:
        super().__init__(config)

    async def send_message(self, message: MessageSchema, template_name: str | None = None) -> None:
        if not isinstance(message, MessageSchema):
            raise PydanticClassRequired("Message schema should be provided from MessageSchema class")

        if self.config.TEMPLATE_FOLDER and template_name:
            template = await self.get_mail_template(self.config.template_engine(), template_name)
            msg = await self._FastMail__prepare_message(message, template)
        else:
            msg = await self._FastMail__prepare_message(message)

        async with TicketDeliveryConnection(self.config) as session:
            if not self.config.SUPPRESS_SEND:
                await session.session.send_message(msg)


class SMTPEmailTicketDeliveryProvider(EmailTicketDeliveryProvider):
    async def send(self, payload: TicketDeliveryOrderPayload) -> None:
        settings = get_settings()
        missing_fields = [
            field_name
            for field_name, field_value in {
                "SMTP_HOST": settings.smtp_host_clean,
                "SMTP_FROM_EMAIL": settings.smtp_from_email_clean,
                "SMTP_USERNAME": settings.smtp_username_clean,
                "SMTP_PASSWORD": settings.smtp_password_clean,
            }.items()
            if not field_value
        ]
        if missing_fields:
            raise RuntimeError(f"SMTP delivery is not configured: missing {', '.join(missing_fields)}")

        logger.info(
            "Sending ticket email for order %s to %s via %s:%s using EHLO hostname %s",
            payload.order_code,
            payload.buyer_email,
            settings.smtp_host_clean,
            settings.smtp_port,
            settings.smtp_local_hostname_clean,
        )
        connection_config = TicketDeliveryConnectionConfig(
            MAIL_USERNAME=settings.smtp_username_clean,
            MAIL_PASSWORD=settings.smtp_password_clean,
            MAIL_FROM=settings.smtp_from_email_clean,
            MAIL_SERVER=settings.smtp_host_clean,
            MAIL_PORT=settings.smtp_port,
            MAIL_FROM_NAME=settings.smtp_from_name_clean,
            MAIL_LOCAL_HOSTNAME=settings.smtp_local_hostname_clean,
            MAIL_STARTTLS=settings.smtp_use_tls,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True,
        )
        message = MessageSchema(
            subject=f"Ve dien tu cho don hang {payload.order_code}",
            recipients=[payload.buyer_email],
            body=_render_email_html(payload),
            subtype=MessageType.html,
        )
        await TicketDeliveryFastMail(connection_config).send_message(message)


def get_email_ticket_delivery_provider() -> EmailTicketDeliveryProvider:
    return SMTPEmailTicketDeliveryProvider()


def get_sms_ticket_delivery_provider() -> SmsTicketDeliveryProvider:
    return NoopSmsTicketDeliveryProvider()


def _format_currency(amount: Decimal) -> str:
    return f"{int(amount):,}".replace(",", ".") + " VND"


def _render_email_text(payload: TicketDeliveryOrderPayload) -> str:
    lines = [
        f"Xin chao {payload.buyer_name or 'ban'},",
        "",
        f"Don hang {payload.order_code} da thanh toan thanh cong qua {payload.payment_provider}.",
        f"Thoi gian thanh toan: {payload.paid_at_iso}",
        f"Tong thanh toan: {_format_currency(payload.total_amount)}",
        "",
        "Danh sach ve:",
    ]
    for item in payload.items:
        lines.extend(
            [
                f"- {item.seat_label} | {item.zone_name} | {_format_currency(item.price)}",
                f"  Ma ve: {item.ticket_code}",
                f"  QR payload: {item.qr_payload}",
            ]
        )
    lines.extend(["", "Ban co the xem lai ve trong muc My Tickets tren he thong."])
    return "\n".join(lines)


def _render_email_html(payload: TicketDeliveryOrderPayload) -> str:
    rows = "".join(
        (
            "<tr>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb'>{html.escape(item.seat_label)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb'>{html.escape(item.zone_name)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb'>{html.escape(_format_currency(item.price))}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb'><strong>{html.escape(item.ticket_code)}</strong><br><span style='font-size:12px;color:#4b5563'>{html.escape(item.qr_payload)}</span></td>"
            "</tr>"
        )
        for item in payload.items
    )
    return (
        "<html><body style='font-family:Arial,sans-serif;background:#f8fafc;color:#111827;padding:24px'>"
        "<div style='max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:24px'>"
        f"<h2 style='margin-top:0'>Ve dien tu cho don hang {html.escape(payload.order_code)}</h2>"
        f"<p>Xin chao <strong>{html.escape(payload.buyer_name or 'ban')}</strong>, don hang cua ban da thanh toan thanh cong.</p>"
        "<div style='margin:16px 0;padding:16px;background:#f3f4f6;border-radius:12px'>"
        f"<div>Thanh toan qua: <strong>{html.escape(payload.payment_provider)}</strong></div>"
        f"<div>Thoi gian thanh toan: <strong>{html.escape(payload.paid_at_iso)}</strong></div>"
        f"<div>Tong thanh toan: <strong>{html.escape(_format_currency(payload.total_amount))}</strong></div>"
        "</div>"
        "<table style='width:100%;border-collapse:collapse'>"
        "<thead><tr>"
        "<th align='left' style='padding:8px;border-bottom:1px solid #d1d5db'>Cho ngoi</th>"
        "<th align='left' style='padding:8px;border-bottom:1px solid #d1d5db'>Hang ve</th>"
        "<th align='left' style='padding:8px;border-bottom:1px solid #d1d5db'>Gia</th>"
        "<th align='left' style='padding:8px;border-bottom:1px solid #d1d5db'>Ma ve</th>"
        "</tr></thead>"
        f"<tbody>{rows}</tbody>"
        "</table>"
        "<p style='margin-bottom:0;margin-top:24px'>Ban co the xem lai ve trong muc My Tickets tren he thong.</p>"
        "</div></body></html>"
    )


async def _has_successful_delivery_log(session: AsyncSession, order_id: int) -> bool:
    existing = await session.scalar(
        select(TransactionLog.id).where(
            TransactionLog.order_id == order_id,
            TransactionLog.action == EMAIL_SENT_ACTION,
        )
    )
    return existing is not None


async def _write_delivery_log(
    session: AsyncSession,
    *,
    order: Order,
    action: str,
    message: str,
    raw_payload: dict | None = None,
) -> None:
    logger.info("Ticket delivery log %s for order %s: %s", action, order.id, message)
    session.add(
        TransactionLog(
            order_id=order.id,
            action=action,
            status=order.status.value if isinstance(order.status, OrderStatus) else str(order.status),
            payment_method=order.payment_provider,
            gateway_transaction_id=order.gateway_transaction_id,
            amount=float(order.total_amount),
            message=message[:255],
            raw_payload=json.dumps(raw_payload) if raw_payload is not None else None,
        )
    )
    await session.commit()


def _normalize_recipient_email(email: str | None) -> str:
    value = str(email or "").strip()
    if not value:
        raise ValueError("Missing buyer email")
    try:
        result = validate_email(value, check_deliverability=False)
    except EmailNotValidError as exc:
        raise ValueError(str(exc)) from exc
    return result.normalized


async def dispatch_paid_order_tickets(
    session: AsyncSession,
    *,
    order: Order,
    items: list[CheckoutItemResponse],
) -> None:
    settings = get_settings()
    if not settings.ticket_delivery_enabled:
        logger.info("Ticket delivery disabled for order %s", order.id)
        return
    if await _has_successful_delivery_log(session, order.id):
        logger.info("Ticket delivery already sent for order %s; skipping duplicate dispatch", order.id)
        return

    try:
        recipient_email = _normalize_recipient_email(order.buyer_email)
    except ValueError as exc:
        logger.warning("Skipping ticket email for order %s: %s", order.id, exc)
        await _write_delivery_log(session, order=order, action=EMAIL_SKIPPED_ACTION, message=str(exc))
        return

    payload = TicketDeliveryOrderPayload(
        order_id=order.id,
        order_code=order.order_code or f"ORDER-{order.id}",
        buyer_name=(order.buyer_name or "").strip() or "ban",
        buyer_email=recipient_email,
        buyer_phone=(order.buyer_phone or "").strip(),
        total_amount=Decimal(str(order.total_amount)),
        payment_provider=(order.payment_provider or "").strip() or "UNKNOWN",
        paid_at_iso=order.paid_at.isoformat() if order.paid_at else "",
        items=items,
    )

    try:
        await get_email_ticket_delivery_provider().send(payload)
    except Exception as exc:
        logger.exception("Ticket delivery failed for order %s", order.id)
        await _write_delivery_log(
            session,
            order=order,
            action=EMAIL_FAILED_ACTION,
            message=str(exc),
            raw_payload={"order_id": order.id, "recipient_email": recipient_email},
        )
        return

    logger.info("Ticket delivery succeeded for order %s", order.id)
    await _write_delivery_log(
        session,
        order=order,
        action=EMAIL_SENT_ACTION,
        message=f"Sent {len(items)} ticket(s) to {recipient_email}",
        raw_payload={"order_id": order.id, "recipient_email": recipient_email, "ticket_count": len(items)},
    )

"""VNPay gateway adapter for signed redirects and transaction queries."""

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from uuid import uuid4
from urllib.parse import quote_plus

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings


VIETNAM_TZ = timezone(timedelta(hours=7))


@dataclass(slots=True)
class VNPayCreatePaymentResult:
    payment_url: str
    raw_payload: dict[str, str | int]


@dataclass(slots=True)
class VNPayTransactionStatusResult:
    status: str
    transaction_no: str | None
    response_code: str | None
    transaction_status: str | None
    paid_at: datetime | None
    raw_payload: dict


class VNPayService:
    def __init__(self) -> None:
        settings = get_settings()
        self.tmn_code = settings.vnpay_tmn_code
        self.hash_secret = settings.vnpay_hash_secret
        self.payment_url = settings.vnpay_payment_url
        self.querydr_url = settings.vnpay_querydr_url
        self.bank_code = settings.vnpay_bank_code
        self.return_url = settings.vnpay_return_url or f"{settings.public_backend_base_url.rstrip('/')}/api/payments/vnpay/return"

    def _ensure_credentials(self) -> None:
        if self.tmn_code and self.hash_secret and self.payment_url and self.return_url:
            return
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VNPay credentials are not configured",
        )

    @staticmethod
    def _format_gateway_datetime(value: datetime) -> str:
        return value.astimezone(VIETNAM_TZ).strftime("%Y%m%d%H%M%S")

    @staticmethod
    def _parse_gateway_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            parsed = datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=VIETNAM_TZ)
        except ValueError:
            return None
        return parsed.astimezone(UTC)

    @staticmethod
    def _build_query(params: dict[str, str | int]) -> str:
        ordered = [(key, params[key]) for key in sorted(params.keys()) if params[key] not in (None, "")]
        return "&".join(f"{quote_plus(str(key))}={quote_plus(str(value))}" for key, value in ordered)

    def sign(self, params: dict[str, str | int]) -> str:
        return hmac.new(
            self.hash_secret.encode("utf-8"),
            self._build_query(params).encode("utf-8"),
            hashlib.sha512,
        ).hexdigest()

    def verify_return_params(self, params: dict[str, str]) -> dict[str, str]:
        self._ensure_credentials()
        provided_hash = (params.get("vnp_SecureHash") or "").lower()
        signed_params = {key: value for key, value in params.items() if key not in {"vnp_SecureHash", "vnp_SecureHashType"}}
        if not provided_hash or not hmac.compare_digest(self.sign(signed_params).lower(), provided_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid VNPay checksum")
        return signed_params

    def create_payment(
        self,
        *,
        txn_ref: str,
        amount: int,
        order_info: str,
        ip_addr: str,
        create_at: datetime,
        expire_at: datetime | None,
    ) -> VNPayCreatePaymentResult:
        self._ensure_credentials()
        params: dict[str, str | int] = {
            "vnp_Version": "2.1.0",
            "vnp_Command": "pay",
            "vnp_TmnCode": self.tmn_code,
            "vnp_Amount": amount * 100,
            "vnp_CurrCode": "VND",
            "vnp_TxnRef": txn_ref,
            "vnp_OrderInfo": order_info,
            "vnp_OrderType": "other",
            "vnp_Locale": "vn",
            "vnp_ReturnUrl": self.return_url,
            "vnp_IpAddr": ip_addr,
            "vnp_CreateDate": self._format_gateway_datetime(create_at),
        }
        if expire_at is not None:
            params["vnp_ExpireDate"] = self._format_gateway_datetime(expire_at)
        if self.bank_code:
            params["vnp_BankCode"] = self.bank_code
        query = self._build_query(params)
        payment_url = f"{self.payment_url}?{query}&vnp_SecureHashType=SHA512&vnp_SecureHash={self.sign(params)}"
        return VNPayCreatePaymentResult(payment_url=payment_url, raw_payload=params)

    def build_request_id(self) -> str:
        return uuid4().hex[:16].upper()

    async def query_transaction(
        self,
        *,
        txn_ref: str,
        transaction_date: datetime,
        ip_addr: str = "127.0.0.1",
        transaction_no: str | None = None,
    ) -> VNPayTransactionStatusResult:
        self._ensure_credentials()
        request_time = datetime.now(UTC)
        request_id = self.build_request_id()
        payload: dict[str, str] = {
            "vnp_RequestId": request_id,
            "vnp_Version": "2.1.0",
            "vnp_Command": "querydr",
            "vnp_TmnCode": self.tmn_code,
            "vnp_TxnRef": txn_ref,
            "vnp_OrderInfo": f"Query order {txn_ref}",
            "vnp_TransactionDate": self._format_gateway_datetime(transaction_date),
            "vnp_CreateDate": self._format_gateway_datetime(request_time),
            "vnp_IpAddr": ip_addr,
        }
        if transaction_no:
            payload["vnp_TransactionNo"] = transaction_no
        checksum_data = "|".join(
            [
                payload["vnp_RequestId"],
                payload["vnp_Version"],
                payload["vnp_Command"],
                payload["vnp_TmnCode"],
                payload["vnp_TxnRef"],
                payload["vnp_TransactionDate"],
                payload["vnp_CreateDate"],
                payload["vnp_IpAddr"],
                payload["vnp_OrderInfo"],
            ]
        )
        payload["vnp_SecureHash"] = hmac.new(
            self.hash_secret.encode("utf-8"),
            checksum_data.encode("utf-8"),
            hashlib.sha512,
        ).hexdigest()

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(self.querydr_url, json=payload)
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="VNPay querydr returned an invalid response")

        response_code = str(data.get("vnp_ResponseCode") or "")
        transaction_status = str(data.get("vnp_TransactionStatus") or "")
        if response_code == "00" and transaction_status == "00":
            state = "PAID"
        elif response_code == "00" and transaction_status in {"01", "05", "06"}:
            state = "PENDING"
        elif response_code == "91":
            state = "FAILED"
        elif transaction_status in {"02", "04", "07", "09"}:
            state = "FAILED"
        else:
            state = "PENDING"

        return VNPayTransactionStatusResult(
            status=state,
            transaction_no=str(data.get("vnp_TransactionNo") or "") or None,
            response_code=response_code or None,
            transaction_status=transaction_status or None,
            paid_at=self._parse_gateway_datetime(str(data.get("vnp_PayDate") or "")),
            raw_payload=data,
        )


_vnpay_service = VNPayService()


def get_vnpay_service() -> VNPayService:
    return _vnpay_service

"""Kiểm thử trạng thái chưa đọc và đánh dấu đã xem của trung tâm hỗ trợ."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.help import (
    admin_list_threads,
    admin_mark_threads_seen,
    admin_send_message,
    mark_my_thread_seen,
    send_my_message,
)
from app.models.help import HelpMessage, HelpThread
from app.schemas.help import HelpMessageCreateRequest


@pytest.mark.asyncio
async def test_customer_message_increments_admin_unread_and_bulk_mark_seen(
    db_session: AsyncSession,
    admin_user,
    customer_users,
):
    """Tin nhắn của khách phải tăng số chưa đọc phía admin và được xóa khi admin đánh dấu đã xem hàng loạt."""

    customer, _ = customer_users

    await send_my_message(
        payload=HelpMessageCreateRequest(content="Em can ho tro dat ve"),
        session=db_session,
        current_user=customer,
    )

    thread = await db_session.scalar(select(HelpThread).where(HelpThread.customer_id == customer.id))
    assert thread is not None
    assert thread.unread_admin == 1
    assert thread.unread_customer == 0
    assert thread.last_message_preview == "Em can ho tro dat ve"

    await admin_mark_threads_seen(session=db_session, _=admin_user)

    refreshed_thread = await db_session.scalar(select(HelpThread).where(HelpThread.id == thread.id))
    customer_message = await db_session.scalar(
        select(HelpMessage).where(HelpMessage.thread_id == thread.id, HelpMessage.sender_id == customer.id)
    )

    assert refreshed_thread is not None
    assert refreshed_thread.unread_admin == 0
    assert customer_message is not None
    assert customer_message.read_at is not None


@pytest.mark.asyncio
async def test_admin_reply_increments_customer_unread_and_customer_mark_seen(
    db_session: AsyncSession,
    admin_user,
    customer_users,
):
    """Phản hồi của admin phải tăng số chưa đọc phía khách và được xóa khi khách đánh dấu đã xem."""

    customer, _ = customer_users

    await send_my_message(
        payload=HelpMessageCreateRequest(content="Cho minh hoi ve seat map"),
        session=db_session,
        current_user=customer,
    )
    thread = await db_session.scalar(select(HelpThread).where(HelpThread.customer_id == customer.id))
    assert thread is not None

    await admin_send_message(
        thread_id=thread.id,
        payload=HelpMessageCreateRequest(content="Ben minh da kiem tra va phan hoi"),
        session=db_session,
        admin_user=admin_user,
    )

    refreshed_thread = await db_session.scalar(select(HelpThread).where(HelpThread.id == thread.id))
    assert refreshed_thread is not None
    assert refreshed_thread.unread_admin == 0
    assert refreshed_thread.unread_customer == 1
    assert refreshed_thread.last_message_preview == "Ben minh da kiem tra va phan hoi"

    await mark_my_thread_seen(session=db_session, current_user=customer)

    customer_seen_thread = await db_session.scalar(select(HelpThread).where(HelpThread.id == thread.id))
    admin_message = await db_session.scalar(
        select(HelpMessage).where(HelpMessage.thread_id == thread.id, HelpMessage.sender_id == admin_user.id)
    )

    assert customer_seen_thread is not None
    assert customer_seen_thread.unread_customer == 0
    assert admin_message is not None
    assert admin_message.read_at is not None


@pytest.mark.asyncio
async def test_admin_thread_list_keeps_latest_thread_per_customer_with_latest_preview(
    db_session: AsyncSession,
    admin_user,
    customer_users,
):
    """Danh sách hội thoại admin phải gộp theo từng khách và giữ đoạn xem trước mới nhất."""

    customer_one, customer_two = customer_users

    await send_my_message(
        payload=HelpMessageCreateRequest(content="Tin nhan dau tien"),
        session=db_session,
        current_user=customer_one,
    )
    await send_my_message(
        payload=HelpMessageCreateRequest(content="Tin nhan moi nhat cua khach 1"),
        session=db_session,
        current_user=customer_one,
    )
    await send_my_message(
        payload=HelpMessageCreateRequest(content="Tin nhan cua khach 2"),
        session=db_session,
        current_user=customer_two,
    )

    threads = await admin_list_threads(session=db_session, _=admin_user)

    assert len(threads) == 2

    threads_by_customer = {thread.customer_id: thread for thread in threads}
    assert threads_by_customer[customer_one.id].unread_admin == 2
    assert threads_by_customer[customer_one.id].last_message_preview == "Tin nhan moi nhat cua khach 1"
    assert threads_by_customer[customer_two.id].unread_admin == 1

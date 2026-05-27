import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { InfoSectionNav } from '@/components/customer/InfoSectionNav'
import { Container } from '@/components/layout/Container'

type InfoLink = {
  label: string
  href: string
}

type InfoStep = {
  title: string
  description: string
}

type BrowserShot = {
  label: string
  route: string
  title: string
  details: string[]
}

type InfoSection = {
  id: string
  label: string
  summary: string
  paragraphs?: string[]
  bullets?: string[]
  steps?: InfoStep[]
  browserShots?: BrowserShot[]
  note?: string
  links?: InfoLink[]
}

const INFO_SECTIONS: InfoSection[] = [
  {
    id: 'dieu-khoan',
    label: 'Điều khoản',
    summary: 'Những nguyên tắc cơ bản khi sử dụng nền tảng mua vé và quản lý vé điện tử trên TicketHub.',
    bullets: [
      'Người dùng chịu trách nhiệm về tính chính xác của email, số điện thoại và thông tin đăng nhập dùng cho việc nhận vé, nhận thông báo và khôi phục tài khoản.',
      'Một đơn hàng chỉ được xác nhận khi hệ thống hoàn tất bước checkout và phát hành vé điện tử; việc chọn ghế hoặc thêm vé vào giỏ chưa đồng nghĩa với giữ chỗ thành công.',
      'Trong các đợt mở bán tải cao, quyền truy cập seat map có thể được điều phối bằng hàng chờ ảo để giảm nghẽn và hạn chế bot.',
      'Mỗi vé gắn với một sự kiện, buổi diễn, khu vực ghế và mã định danh riêng; người dùng cần kiểm tra kỹ trước khi xác nhận thanh toán.',
    ],
    note: 'TicketHub ưu tiên trải nghiệm công bằng khi mở bán: khóa ghế tạm thời theo phiên đặt vé, tự nhả ghế khi hết thời gian giữ chỗ và cập nhật trạng thái ghế gần thời gian thực.',
  },
  {
    id: 'huong-dan-su-dung',
    label: 'Hướng dẫn sử dụng',
    summary: 'Luồng mua vé ngắn gọn, bám theo cách các nền tảng bán vé thực tế xử lý sale time, queue, seat map và vé điện tử.',
    steps: [
      {
        title: '1. Tìm sự kiện và chọn đúng buổi diễn',
        description:
          'Vào trang sự kiện, kiểm tra ngày diễn, địa điểm, khung giờ và phân loại ghế trước khi bấm đặt vé.',
      },
      {
        title: '2. Nếu có hàng chờ, hãy đứng yên trong queue',
        description:
          'Giữ nguyên một thiết bị, một trình duyệt và không tự làm mới trang. Khi đến lượt, hệ thống sẽ cho bạn vào sơ đồ ghế.',
      },
      {
        title: '3. Chọn ghế và hoàn tất trong thời gian giữ chỗ',
        description:
          'Ghế được giữ tạm trong một khoảng thời gian ngắn. Nếu hết giờ hoặc rời phiên checkout, ghế sẽ được trả lại cho hệ thống.',
      },
      {
        title: '4. Kiểm tra vé trong mục Vé của bạn',
        description:
          'Sau khi thanh toán thành công, mã vé và thông tin QR sẽ xuất hiện trong tài khoản để dùng khi check-in hoặc đối chiếu hỗ trợ.',
      },
    ],
    browserShots: [
      {
        label: 'Bước 1',
        route: '/event/:eventKey',
        title: 'Trang sự kiện',
        details: ['Xem mô tả, lịch diễn', 'Chọn đúng show', 'Kiểm tra hạng vé'],
      },
      {
        label: 'Bước 2',
        route: '/queue?showId=...',
        title: 'Virtual queue',
        details: ['Giữ nguyên tab', 'Không tự refresh', 'Chờ hệ thống chuyển lượt'],
      },
      {
        label: 'Bước 3',
        route: '/shows/:showId/seats',
        title: 'Seat map & checkout',
        details: ['Chọn ghế còn trống', 'Theo dõi đồng hồ giữ chỗ', 'Mở lại vé sau khi mua'],
      },
    ],
    bullets: [
      'Nên đăng nhập và chuẩn bị phương thức thanh toán trước giờ mở bán vài phút để giảm thao tác ở bước checkout.',
      'Khi mua trên điện thoại, giữ màn hình sáng nếu đang ở queue để tránh phiên chờ bị gián đoạn.',
      'Nếu ghế vừa bị người khác giữ trước, hãy chọn nhanh phương án thay thế thay vì cố bấm lại cùng một ghế.',
    ],
    note: 'Một số hệ thống vé di động ngoài thị trường dùng QR động; vì vậy ảnh chụp màn hình có thể không được chấp nhận ở cổng vào. Với TicketHub, cách an toàn nhất vẫn là mở vé trực tiếp trong tài khoản của bạn.',
  },
  {
    id: 'chinh-sach',
    label: 'Chính sách',
    summary: 'Các nguyên tắc vận hành phổ biến trong ngành ticketing, được điều chỉnh cho phù hợp với TicketHub.',
    bullets: [
      'Thanh toán: hiện tại TicketHub đang mô phỏng thanh toán nội bộ để hoàn tất quy trình đặt vé; hệ thống chỉ ghi nhận đơn khi checkout thành công.',
      'Hoàn tiền và hủy vé: trong thực tế, đa số đơn hàng hoàn tất thường không thể đổi ghế hoặc đổi sự kiện. Trường hợp hủy hoặc hoàn phụ thuộc trạng thái sự kiện và điều kiện của ban tổ chức.',
      'Sự kiện dời lịch: thông lệ phổ biến là vé vẫn giữ hiệu lực cho lịch mới; nếu không thể tham dự, người dùng cần theo thông báo chính thức hoặc liên hệ hỗ trợ.',
      'Vé điện tử: người dùng nên kiểm tra kỹ email, tài khoản và mã vé trước ngày diễn; không chia sẻ ảnh vé cho bên thứ ba nếu sự kiện dùng cơ chế quét mã động.',
      'Hỗ trợ: nếu có lỗi thanh toán, thiếu vé, sai thông tin show hoặc cần xác minh đơn hàng, hãy gửi yêu cầu trong Trung tâm hỗ trợ để admin tra cứu theo tài khoản.',
    ],
    links: [
      {
        label: 'Ticketmaster Help: queue và waiting room',
        href: 'https://help.ticketmaster.com/hc/en-us/articles/9781366115985-What-is-the-queue-and-how-do-I-join',
      },
      {
        label: 'Eventbrite Help: truy cập vé trong app/web',
        href: 'https://www.eventbrite.com/help/en-us/articles/319355/where-are-my-tickets/',
      },
      {
        label: 'AXS Help: vé di động, QR động và không dùng screenshot',
        href: 'https://support.axs.com/hc/en-us/articles/201086794-Do-I-need-the-AXS-App-to-use-my-AXS-Mobile-ID',
      },
      {
        label: 'SeatGeek Help: chính sách hủy, đổi, hoàn sau khi đặt',
        href: 'https://support.seatgeek.com/hc/en-us/articles/360007200094-Can-I-change-cancel-or-get-a-refund-for-my-tickets-after-an-order-is-placed',
      },
    ],
  },
  {
    id: 've-chung-toi',
    label: 'Về chúng tôi',
    summary: 'Thông tin ngắn gọn về sản phẩm và nhóm thực hiện.',
    paragraphs: [
      'TicketHub là sản phẩm của môn Phát triển ứng dụng Web tại Trường Đại học Công nghệ, được xây dựng như một mẫu hệ thống bán vé theo thời gian thực với các bài toán thực tế: queue, seat locking, vé điện tử và thống kê vận hành.',
      'Hướng phát triển của sản phẩm là tiệm cận luồng nghiệp vụ của các nền tảng ticketing hiện đại nhưng vẫn giữ giao diện gọn, dễ dùng và phù hợp cho demo học thuật.',
    ],
    bullets: [
      'Nguyễn Hữu Hải Đăng - 23020524',
      'Phạm Khánh Duy - 23020522',
      'Phạm Việt Hưng - 23020542',
    ],
  },
]

function BrowserShotCard({ item }: { item: BrowserShot }) {
  return (
    <div className="rounded-2xl border customer-border bg-black/10 p-3 shadow-sm dark:bg-white/5">
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] tracking-wide customer-text-muted">
          {item.route}
        </span>
      </div>
      <div className="space-y-3 p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{item.label}</p>
          <h3 className="mt-1 font-headline text-lg font-bold text-on-background">{item.title}</h3>
        </div>
        <div className="grid gap-2">
          {item.details.map((detail) => (
            <div
              key={detail}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm customer-text-body"
            >
              {detail}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function InfoPage() {
  const location = useLocation()
  const [activeId, setActiveId] = useState(() => location.hash.replace('#', '') || INFO_SECTIONS[0].id)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const sectionIds = useMemo(() => INFO_SECTIONS.map((section) => section.id), [])

  useEffect(() => {
    const sections = sectionIds
      .map((id) => sectionRefs.current[id])
      .filter((section): section is HTMLElement => Boolean(section))

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)

        if (visibleEntries.length === 0) return

        setActiveId(visibleEntries[0].target.id)
      },
      {
        rootMargin: '-160px 0px -55% 0px',
        threshold: [0.15, 0.35, 0.6],
      },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [sectionIds])

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (!hash) return

    const target = sectionRefs.current[hash]
    if (!target) return

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(hash)
    })
  }, [location.hash])

  function handleSelect(sectionId: string) {
    const target = sectionRefs.current[sectionId]
    if (!target) return

    window.history.replaceState(null, '', `/info#${sectionId}`)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(sectionId)
  }

  return (
    <div className="app-theme-page min-h-screen text-on-background">
      <Container className="px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl space-y-8">
          <header className="space-y-3">
            <p className="font-headline text-3xl font-black tracking-tighter text-on-background sm:text-5xl">
              TicketHub - Thông tin
            </p>
            <p className="max-w-2xl customer-text-muted">
              Trang tổng hợp dành cho người dùng cuối: cách mua vé, những lưu ý thường gặp và một số nguyên tắc vận hành thực tế của nền tảng bán vé điện tử.
            </p>
          </header>

          <InfoSectionNav items={INFO_SECTIONS} activeId={activeId} onSelect={handleSelect} />

          <div className="space-y-8">
            {INFO_SECTIONS.map((section) => (
              <section
                key={section.id}
                id={section.id}
                ref={(element) => {
                  sectionRefs.current[section.id] = element
                }}
                className="scroll-mt-32 rounded-3xl border customer-border customer-bg-surface p-6 shadow-lg backdrop-blur sm:p-8"
              >
                <div className="space-y-4">
                  <h2 className="font-headline text-2xl font-bold text-on-background">{section.label}</h2>

                  <div className="rounded-2xl bg-black/5 p-4 text-sm leading-7 customer-text-body dark:bg-white/5">
                    {section.summary}
                  </div>

                  {section.paragraphs?.map((paragraph) => (
                    <div key={paragraph} className="rounded-2xl bg-black/5 p-4 text-sm leading-7 customer-text-body dark:bg-white/5">
                      {paragraph}
                    </div>
                  ))}

                  {section.steps ? (
                    <div className="grid gap-3">
                      {section.steps.map((step) => (
                        <div key={step.title} className="rounded-2xl border customer-border bg-white/5 p-4">
                          <h3 className="font-semibold text-on-background">{step.title}</h3>
                          <p className="mt-2 text-sm leading-7 customer-text-body">{step.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {section.browserShots ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      {section.browserShots.map((item) => (
                        <BrowserShotCard key={`${item.route}-${item.label}`} item={item} />
                      ))}
                    </div>
                  ) : null}

                  {section.bullets ? (
                    <div className="rounded-2xl border customer-border bg-white/5 p-4">
                      <ul className="space-y-3 text-sm leading-7 customer-text-body">
                        {section.bullets.map((item) => (
                          <li key={item} className="flex gap-3">
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {section.note ? (
                    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm leading-7 text-on-background">
                      {section.note}
                    </div>
                  ) : null}

                  {section.links ? (
                    <div className="rounded-2xl border customer-border bg-white/5 p-4">
                      <p className="mb-3 text-sm font-semibold text-on-background">Tham khảo thực tiễn</p>
                      <div className="flex flex-col gap-3">
                        {section.links.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </div>
  )
}

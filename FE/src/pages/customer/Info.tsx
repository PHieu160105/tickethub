import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { InfoSectionNav } from '@/components/customer/InfoSectionNav'
import { Container } from '@/components/layout/Container'

const INFO_SECTIONS = [
  {
    id: 'dieu-khoan',
    label: 'Điều khoản',
    paragraphs: [
      'Đây là phần nội dung mẫu cho điều khoản sử dụng của TicketRush. Bạn có thể thay bằng các quy định áp dụng cho việc tạo tài khoản, mua vé và sử dụng nền tảng.',
      'Phần này nên mô tả rõ quyền và trách nhiệm của người dùng, đơn vị tổ chức và nền tảng khi phát sinh giao dịch hoặc yêu cầu hỗ trợ.',
    ],
  },
  {
    id: 'huong-dan-su-dung',
    label: 'Hướng dẫn sử dụng',
    paragraphs: [
      'Đây là phần nội dung mẫu để mô tả quy trình tìm kiếm sự kiện, chọn buổi diễn, tham gia hàng chờ, chọn ghế và thanh toán trên hệ thống.',
      'Bạn có thể bổ sung ảnh minh họa, hướng dẫn theo từng bước hoặc các lưu ý khi người dùng đổi vé, hủy vé và kiểm tra vé điện tử.',
    ],
  },
  {
    id: 'chinh-sach',
    label: 'Chính sách',
    paragraphs: [
      'Đây là phần nội dung mẫu cho các chính sách vận hành như chính sách thanh toán, hoàn tiền, bảo mật thông tin và xử lý khiếu nại.',
      'Nội dung nên được trình bày theo từng nhóm chính sách để người dùng dễ theo dõi và đối chiếu khi cần hỗ trợ.',
    ],
  },
  {
    id: 've-chung-toi',
    label: 'Về chúng tôi',
    paragraphs: [
      'Đây là phần nội dung mẫu giới thiệu TicketRush, định hướng phát triển và giá trị cốt lõi mà nền tảng muốn mang lại cho khán giả lẫn đơn vị tổ chức.',
      'Bạn có thể bổ sung câu chuyện thương hiệu, đội ngũ vận hành hoặc các cột mốc phát triển quan trọng tại đây.',
    ],
  },
]

export default function InfoPage() {
  const location = useLocation()
  const [activeId, setActiveId] = useState(INFO_SECTIONS[0].id)
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
    if (!hash) {
      setActiveId(INFO_SECTIONS[0].id)
      return
    }

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
              TicketRush - Thông tin
            </p>
            <p className="max-w-2xl customer-text-muted">
              Trang thông tin tổng hợp dành cho người dùng. Nội dung bên dưới đang ở dạng mẫu để bạn bổ sung sau.
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
                  {section.paragraphs.map((paragraph) => (
                    <div key={paragraph} className="rounded-2xl bg-black/5 p-4 text-sm leading-7 customer-text-body dark:bg-white/5">
                      {paragraph}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </div>
  )
}

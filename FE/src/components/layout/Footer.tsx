import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube } from 'react-icons/si'

import { siteSettingsApi } from '@/lib/api'
import { DEFAULT_SITE_SETTINGS } from '@/lib/siteSettings'
import type { SiteSettings } from '@/types'

import { Container } from './Container'

const infoLinks = [
  { label: 'Điều khoản', to: '/info#dieu-khoan' },
  { label: 'Hướng dẫn sử dụng', to: '/info#huong-dan-su-dung' },
  { label: 'Chính sách', to: '/info#chinh-sach' },
  { label: 'Về chúng tôi', to: '/info#ve-chung-toi' },
]

const socialLinks = [
  { label: 'YouTube', icon: SiYoutube },
  { label: 'Facebook', icon: SiFacebook },
  { label: 'TikTok', icon: SiTiktok },
  { label: 'Instagram', icon: SiInstagram },
]

export function Footer() {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS)

  useEffect(() => {
    let isMounted = true

    const loadSiteSettings = async () => {
      try {
        const data = await siteSettingsApi.public()
        if (isMounted) {
          setSiteSettings(data)
        }
      } catch {
        if (isMounted) {
          setSiteSettings(DEFAULT_SITE_SETTINGS)
        }
      }
    }

    void loadSiteSettings()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <footer className="customer-footer-bg mt-auto border-t customer-border">
      <Container className="py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-3">
            <p className="font-headline text-2xl font-black tracking-tight">
              <span className="text-brand-red">Ticket</span>
              <span className="text-brand-yellow">Rush</span>
            </p>
            <p className="text-sm leading-7 customer-text-muted">
              TicketRush là nền tảng hỗ trợ khám phá sự kiện, chọn buổi diễn và đặt vé trực tuyến theo trải nghiệm đơn giản, rõ ràng và thuận tiện.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold customer-text-header">Thông tin</h4>
            <div className="space-y-2">
              {infoLinks.map((item) => (
                <Link key={item.to} to={item.to} className="block text-sm transition-colors customer-text-muted hover:text-primary">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold customer-text-header">Liên hệ</h4>
            <div className="space-y-2 text-sm customer-text-muted">
              <p>{siteSettings.contact_email}</p>
              <p>{siteSettings.contact_phone}</p>
              <p>{siteSettings.website}</p>
              <p>{siteSettings.address}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold customer-text-header">Phương tiện</h4>
            <div className="flex flex-wrap gap-2">
              {socialLinks.map(({ label, icon: Icon }) => (
                <Link
                  key={label}
                  to="/error"
                  aria-label={label}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border bg-black/5 text-lg transition-colors customer-border customer-text-muted hover:text-primary dark:bg-white/5"
                >
                  <Icon />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 customer-border">
          <p className="text-sm customer-text-muted">© 2026 TicketRush. Bảo lưu mọi quyền.</p>
        </div>
      </Container>
    </footer>
  )
}

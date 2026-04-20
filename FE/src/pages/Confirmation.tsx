import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CheckCircle, Download, Share2, QrCode, Calendar, MapPin, Users } from 'lucide-react'

export default function Confirmation() {
  // Mock order data - in real app this would come from props/state
  const orderData = {
    orderNumber: 'TR-2024-001234',
    event: {
      name: 'Nebula Sound-Waves Festival 2024',
      category: 'Electronic Voyage',
      date: 'October 24, 2024',
      venue: 'Orion Zenith Arena',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvrllkXL8XtBTf2Wd2tomI2iiaGXTItQbaQCgwK1efF-cQQAFXAdrk2pZTbjZXNpa26F3MMRKyd-k2wsMNmrEcUMEoSO-J-4l9Ms2KQBSXt-npd9EzKoIX0BLxLREGCMqwB4ikJt2_mWbQGy2rbHdnpmIz_ZYDMhS46yJXjxxQqzjj9PjsDFQkri1yZKmJ6Oj_dUHSTv3IvnuawIKjO0hZMwJ6-iJKFfCrEjiE_SuDfmkcUswKOOWKpopCJj0KKk0_k11GUl921Vw'
    },
    tickets: [
      { type: 'GA Floor', quantity: 2, price: 625000 }
    ],
    total: 1250000,
    customer: {
      name: 'Johnathan Doe',
      email: 'john@nebula.com'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white font-body">
      <Navbar />

      <main className="max-w-screen-2xl mx-auto px-6 py-12">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-headline font-black tracking-tight mb-4">
            Purchase Confirmed!
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Your tickets have been successfully purchased. Check your email for confirmation details and digital tickets.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="flex items-center justify-center mb-16 space-x-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-headline font-bold">01</div>
            <span className="text-xs font-headline uppercase tracking-widest text-slate-500">Selection</span>
          </div>
          <div className="w-16 h-px bg-white/10"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-headline font-bold">02</div>
            <span className="text-xs font-headline uppercase tracking-widest text-slate-500">Checkout</span>
          </div>
          <div className="w-16 h-px bg-white/10"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-headline font-bold shadow-[0_0_15px_rgba(255,178,183,0.4)]">03</div>
            <span className="text-xs font-headline uppercase tracking-widest text-primary font-bold">Confirmation</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Order Details */}
          <div className="lg:col-span-7 space-y-8">
            {/* Order Info */}
            <div className="backdrop-blur-xl bg-slate-900/80 p-8 rounded-3xl border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-headline font-bold">Order #{orderData.orderNumber}</h2>
                <span className="text-sm text-slate-400">Purchased on {new Date().toLocaleDateString()}</span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer</span>
                  <span className="text-white">{orderData.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email</span>
                  <span className="text-white">{orderData.customer.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Method</span>
                  <span className="text-white">Credit Card **** 0000</span>
                </div>
              </div>
            </div>

            {/* Event Details */}
            <div className="backdrop-blur-xl bg-slate-900/80 p-8 rounded-3xl border border-white/10">
              <h3 className="text-xl font-headline font-bold mb-6">Event Details</h3>

              <div className="flex gap-6 mb-6">
                <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
                  <img
                    alt="Event"
                    className="w-full h-full object-cover"
                    src={orderData.event.image}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-secondary font-headline font-bold uppercase text-xs tracking-[0.2em] mb-1">
                    {orderData.event.category}
                  </p>
                  <h4 className="text-lg font-headline font-bold leading-tight mb-2">
                    {orderData.event.name}
                  </h4>
                  <div className="space-y-1 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{orderData.event.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{orderData.event.venue}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tickets */}
              <div className="space-y-4">
                <h4 className="font-headline font-bold text-lg">Your Tickets</h4>
                {orderData.tickets.map((ticket, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <Users className="w-5 h-5 text-slate-400" />
                      <div>
                        <span className="font-medium text-white">{ticket.type}</span>
                        <span className="text-slate-400 ml-2">× {ticket.quantity}</span>
                      </div>
                    </div>
                    <span className="text-white font-medium">
                      ₫{ticket.price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button className="flex-1" variant="primary">
                <Download className="w-4 h-4 mr-2" />
                Download Tickets
              </Button>
              <Button className="flex-1" variant="outline">
                <Share2 className="w-4 h-4 mr-2" />
                Share Event
              </Button>
              <Link to="/profile" className="flex-1">
                <Button className="w-full" variant="outline">
                  View in Profile
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Order Summary */}
          <aside className="lg:col-span-5 sticky top-28">
            <div className="backdrop-blur-xl bg-slate-900/80 p-8 rounded-3xl overflow-hidden relative border border-white/10">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 blur-[60px] rounded-full"></div>
              <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-secondary/10 blur-[60px] rounded-full"></div>

              <h3 className="text-xl font-headline font-bold uppercase tracking-widest mb-8 border-b border-white/5 pb-4">
                Order Summary
              </h3>

              <div className="space-y-4 mb-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Subtotal (2 Tickets)</span>
                  <span className="text-white">₫1,200,000</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Service Fee</span>
                  <span className="text-white">₫45,000</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Processing Tax</span>
                  <span className="text-white">₫5,000</span>
                </div>
                <div className="pt-4 border-t border-white/5 mt-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500">
                        Total Paid
                      </span>
                      <p className="text-4xl font-headline font-black text-white mt-1">
                        ₫{orderData.total.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white p-2 rounded-lg">
                      <div className="w-16 h-16 bg-slate-100 flex items-center justify-center">
                        <QrCode className="text-slate-900 text-3xl" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-4">
                <p className="text-sm text-slate-400">
                  A confirmation email has been sent to <strong className="text-white">{orderData.customer.email}</strong>
                </p>
                <p className="text-xs text-slate-500">
                  Keep this QR code handy for entry. Show it at the venue along with a valid ID.
                </p>
              </div>
            </div>

            {/* Help Section */}
            <div className="mt-6 backdrop-blur-xl bg-slate-900/80 p-6 rounded-2xl border border-white/10">
              <h4 className="font-headline font-bold text-lg mb-4">Need Help?</h4>
              <div className="space-y-3 text-sm">
                <p className="text-slate-400">
                  Questions about your order? Contact our support team.
                </p>
                <div className="flex gap-4">
                  <Link to="/help" className="text-primary hover:underline">
                    Help Center
                  </Link>
                  <span className="text-slate-600">•</span>
                  <a href="mailto:support@ticketrush.com" className="text-primary hover:underline">
                    Email Support
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
    event: {
      name: 'Nebula Sound-Waves Festival 2024',
      category: 'Electronic Voyage',
      date: 'October 24, 2024',
      venue: 'Orion Zenith Arena',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvrllkXL8XtBTf2Wd2tomI2iiaGXTItQbaQCgwK1efF-cQQAFXAdrk2pZTbjZXNpa26F3MMRKyd-k2wsMNmrEcUMEoSO-J-4l9Ms2KQBSXt-npd9EzKoIX0BLxLREGCMqwB4ikJt2_mWbQGy2rbHdnpmIz_ZYDMhS46yJXjxxQqzjj9PjsDFQkri1yZKmJ6Oj_dUHSTv3IvnuawIKjO0hZMwJ6-iJKFfCrEjiE_SuDfmkcUswKOOWKpopCJj0KKk0_k11GUl921Vw'
    },
    tickets: [
      { type: 'GA Floor', quantity: 2, price: 625000 }
    ],
    total: 1250000,
    customer: {
      name: 'Johnathan Doe',
      email: 'john@nebula.com'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white font-body">
      <Navbar />

      <main className="max-w-screen-2xl mx-auto px-6 py-12">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-headline font-black tracking-tight mb-4">
            Purchase Confirmed!
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Your tickets have been successfully purchased. Check your email for confirmation details and digital tickets.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="flex items-center justify-center mb-16 space-x-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-headline font-bold">01</div>
            <span className="text-xs font-headline uppercase tracking-widest text-slate-500">Selection</span>
          </div>
          <div className="w-16 h-px bg-white/10"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-headline font-bold">02</div>
            <span className="text-xs font-headline uppercase tracking-widest text-slate-500">Checkout</span>
          </div>
          <div className="w-16 h-px bg-white/10"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-headline font-bold shadow-[0_0_15px_rgba(255,178,183,0.4)]">03</div>
            <span className="text-xs font-headline uppercase tracking-widest text-primary font-bold">Confirmation</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Order Details */}
          <div className="lg:col-span-7 space-y-8">
            {/* Order Info */}
            <div className="backdrop-blur-xl bg-slate-900/80 p-8 rounded-3xl border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-headline font-bold">Order #{orderData.orderNumber}</h2>
                <span className="text-sm text-slate-400">Purchased on {new Date().toLocaleDateString()}</span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer</span>
                  <span className="text-white">{orderData.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email</span>
                  <span className="text-white">{orderData.customer.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Method</span>
                  <span className="text-white">Credit Card **** 0000</span>
                </div>
              </div>
            </div>

            {/* Event Details */}
            <div className="backdrop-blur-xl bg-slate-900/80 p-8 rounded-3xl border border-white/10">
              <h3 className="text-xl font-headline font-bold mb-6">Event Details</h3>

              <div className="flex gap-6 mb-6">
                <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
                  <img
                    alt="Event"
                    className="w-full h-full object-cover"
                    src={orderData.event.image}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-secondary font-headline font-bold uppercase text-xs tracking-[0.2em] mb-1">
                    {orderData.event.category}
                  </p>
                  <h4 className="text-lg font-headline font-bold leading-tight mb-2">
                    {orderData.event.name}
                  </h4>
                  <div className="space-y-1 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{orderData.event.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{orderData.event.venue}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tickets */}
              <div className="space-y-4">
                <h4 className="font-headline font-bold text-lg">Your Tickets</h4>
                {orderData.tickets.map((ticket, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <Users className="w-5 h-5 text-slate-400" />
                      <div>
                        <span className="font-medium text-white">{ticket.type}</span>
                        <span className="text-slate-400 ml-2">× {ticket.quantity}</span>
                      </div>
                    </div>
                    <span className="text-white font-medium">
                      ₫{ticket.price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button className="flex-1" variant="primary">
                <Download className="w-4 h-4 mr-2" />
                Download Tickets
              </Button>
              <Button className="flex-1" variant="outline">
                <Share2 className="w-4 h-4 mr-2" />
                Share Event
              </Button>
              <Link to="/profile" className="flex-1">
                <Button className="w-full" variant="outline">
                  View in Profile
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Order Summary */}
          <aside className="lg:col-span-5 sticky top-28">
            <div className="backdrop-blur-xl bg-slate-900/80 p-8 rounded-3xl overflow-hidden relative border border-white/10">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 blur-[60px] rounded-full"></div>
              <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-secondary/10 blur-[60px] rounded-full"></div>

              <h3 className="text-xl font-headline font-bold uppercase tracking-widest mb-8 border-b border-white/5 pb-4">
                Order Summary
              </h3>

              <div className="space-y-4 mb-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Subtotal (2 Tickets)</span>
                  <span className="text-white">₫1,200,000</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Service Fee</span>
                  <span className="text-white">₫45,000</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Processing Tax</span>
                  <span className="text-white">₫5,000</span>
                </div>
                <div className="pt-4 border-t border-white/5 mt-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500">
                        Total Paid
                      </span>
                      <p className="text-4xl font-headline font-black text-white mt-1">
                        ₫{orderData.total.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white p-2 rounded-lg">
                      <div className="w-16 h-16 bg-slate-100 flex items-center justify-center">
                        <QrCode className="text-slate-900 text-3xl" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-4">
                <p className="text-sm text-slate-400">
                  A confirmation email has been sent to <strong className="text-white">{orderData.customer.email}</strong>
                </p>
                <p className="text-xs text-slate-500">
                  Keep this QR code handy for entry. Show it at the venue along with a valid ID.
                </p>
              </div>
            </div>

            {/* Help Section */}
            <div className="mt-6 backdrop-blur-xl bg-slate-900/80 p-6 rounded-2xl border border-white/10">
              <h4 className="font-headline font-bold text-lg mb-4">Need Help?</h4>
              <div className="space-y-3 text-sm">
                <p className="text-slate-400">
                  Questions about your order? Contact our support team.
                </p>
                <div className="flex gap-4">
                  <Link to="/help" className="text-primary hover:underline">
                    Help Center
                  </Link>
                  <span className="text-slate-600">•</span>
                  <a href="mailto:support@ticketrush.com" className="text-primary hover:underline">
                    Email Support
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "secondary": "#f0c03e",
                    "surface-container-high": "#242842",
                    "primary-container": "#fc536d",
                    "on-secondary-fixed": "#251a00",
                    "surface-container-highest": "#2f334e",
                    "on-primary": "#67001c",
                    "on-primary-fixed-variant": "#91002b",
                    "surface-dim": "#0d112a",
                    "on-tertiary-fixed-variant": "#274774",
                    "background": "#0d112a",
                    "inverse-on-surface": "#2b2f49",
                    "on-error-container": "#ffdad6",
                    "surface-variant": "#2f334e",
                    "on-primary-container": "#5b0017",
                    "on-secondary": "#3e2e00",
                    "on-error": "#690005",
                    "tertiary-fixed-dim": "#a9c8fc",
                    "secondary-fixed-dim": "#f0c03e",
                    "on-tertiary-fixed": "#001b3c",
                    "on-surface": "#dee0ff",
                    "tertiary-fixed": "#d5e3ff",
                    "on-primary-fixed": "#40000e",
                    "on-tertiary": "#09305c",
                    "surface-container": "#1a1e37",
                    "inverse-surface": "#dee0ff",
                    "tertiary": "#a9c8fc",
                    "outline": "#a9898a",
                    "tertiary-container": "#7392c3",
                    "error": "#ffb4ab",
                    "primary-fixed-dim": "#ffb2b7",
                    "surface-tint": "#ffb2b7",
                    "inverse-primary": "#b71d3f",
                    "secondary-fixed": "#ffdf95",
                    "on-secondary-fixed-variant": "#594400",
                    "on-background": "#dee0ff",
                    "surface": "#0d112a",
                    "on-surface-variant": "#e2bebf",
                    "on-tertiary-container": "#002a55",
                    "secondary-container": "#ba9000",
                    "surface-container-lowest": "#080c25",
                    "outline-variant": "#5a4042",
                    "error-container": "#93000a",
                    "on-secondary-container": "#3c2c00",
                    "surface-container-low": "#161a33",
                    "surface-bright": "#343752",
                    "primary-fixed": "#ffdadb",
                    "primary": "#ffb2b7"
            },
            "borderRadius": {
                    "DEFAULT": "0.125rem",
                    "lg": "0.25rem",
                    "xl": "0.5rem",
                    "full": "0.75rem"
            },
            "fontFamily": {
                    "headline": ["Space Grotesk"],
                    "body": ["Be Vietnam Pro"],
                    "label": ["Space Grotesk"]
            }
          },
        },
      }
    </script>
<style>
        body {
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
            min-height: 100vh;
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .glass-panel {
            backdrop-filter: blur(12px) saturate(180%);
            background-color: rgba(26, 30, 55, 0.8);
            border-top: 1px solid rgba(255, 178, 183, 0.2);
        }
    </style>
</head>
<body class="font-body text-on-background selection:bg-primary-container selection:text-white">
<!-- TopNavBar -->
<header class="bg-slate-950/80 backdrop-blur-xl docked full-width top-0 sticky border-b border-white/10 shadow-[0_0_15px_rgba(233,69,96,0.2)] z-50">
<div class="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-black italic tracking-tighter text-red-500 uppercase font-headline">TicketRush</div>
<nav class="hidden md:flex items-center gap-8 font-headline font-bold tracking-tight">
<a class="text-slate-300 hover:text-white transition-colors" href="#">Events</a>
<a class="text-slate-300 hover:text-white transition-colors" href="#">Venues</a>
<a class="text-slate-300 hover:text-white transition-colors" href="#">Deals</a>
<a class="text-red-500 border-b-2 border-red-500 pb-1" href="#">My Tickets</a>
</nav>
<div class="flex items-center gap-6">
<div class="hidden lg:block relative group">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
<input class="bg-white/5 border-none rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:ring-1 focus:ring-red-500 transition-all" placeholder="Search events..." type="text"/>
</div>
<div class="flex items-center gap-4">
<button class="material-symbols-outlined text-slate-300 hover:text-white transition-colors">notifications</button>
<button class="material-symbols-outlined text-slate-300 hover:text-white transition-colors">shopping_cart</button>
<img alt="User profile" class="w-8 h-8 rounded-full border border-white/20" data-alt="Portrait of a modern user with neon lighting highlights on face, professional and high-tech profile aesthetic" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsmDCS0J_-kl9p_f5YGPN-24ik40HYCYuMVPtm-4kXTwOYQp91eZn3C72d_DBDVzCGnotcXt92BHm-BsWz1mpPMfeyaKAVFPvmH8Gsh-qqJ1KzRX16aPu2Kb5imPMGmX1QPTE0GAem0sJzoih6d5m0W_dB01KLwEdc4o8am_3JgxsmET-sLQ_Mra6qPgNMoZkF3m07CfptOclodOP_vFB38yuZlzN3FzC7G97l3ca4OB0LI_DMYoxrWWWzWQNf2f9UOJsPy1jGXlI"/>
</div>
</div>
</div>
</header>
<main class="max-w-screen-2xl mx-auto px-6 py-12">
<!-- Progress Stepper -->
<div class="flex items-center justify-center mb-16 space-x-4">
<div class="flex items-center gap-2">
<div class="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-slate-400 text-xs font-headline font-bold">01</div>
<span class="text-xs font-headline uppercase tracking-widest text-slate-500">Selection</span>
</div>
<div class="w-16 h-px bg-white/10"></div>
<div class="flex items-center gap-2">
<div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-headline font-bold shadow-[0_0_15px_rgba(255,178,183,0.4)]">02</div>
<span class="text-xs font-headline uppercase tracking-widest text-primary font-bold">Checkout</span>
</div>
<div class="w-16 h-px bg-white/10"></div>
<div class="flex items-center gap-2">
<div class="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-600 text-xs font-headline font-bold">03</div>
<span class="text-xs font-headline uppercase tracking-widest text-slate-600">Confirmation</span>
</div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
<!-- Left: Payment Details -->
<div class="lg:col-span-7 space-y-10">
<section>
<h2 class="text-3xl font-headline font-bold tracking-tight mb-8">Personal Information</h2>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<div class="space-y-2">
<label class="block text-[10px] font-headline uppercase tracking-[0.2em] text-on-surface-variant font-bold">Full Name</label>
<input class="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 text-on-surface focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600" placeholder="Johnathan Doe" type="text"/>
</div>
<div class="space-y-2">
<label class="block text-[10px] font-headline uppercase tracking-[0.2em] text-on-surface-variant font-bold">Email Address</label>
<input class="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 text-on-surface focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600" placeholder="john@nebula.com" type="email"/>
</div>
<div class="md:col-span-2 space-y-2">
<label class="block text-[10px] font-headline uppercase tracking-[0.2em] text-on-surface-variant font-bold">Phone Number</label>
<input class="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 text-on-surface focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600" placeholder="+84 900 000 000" type="tel"/>
</div>
</div>
</section>
<section>
<h2 class="text-3xl font-headline font-bold tracking-tight mb-8">Payment Method</h2>
<div class="grid grid-cols-3 gap-4 mb-8">
<button class="glass-panel p-4 rounded-xl flex flex-col items-center gap-3 border border-primary/40 bg-primary/5 transition-all">
<span class="material-symbols-outlined text-primary text-3xl">credit_card</span>
<span class="text-[10px] font-headline font-bold uppercase tracking-widest text-primary">Card</span>
</button>
<button class="glass-panel p-4 rounded-xl flex flex-col items-center gap-3 border border-white/5 hover:bg-white/5 transition-all grayscale hover:grayscale-0">
<span class="material-symbols-outlined text-slate-400 text-3xl">account_balance_wallet</span>
<span class="text-[10px] font-headline font-bold uppercase tracking-widest text-slate-400">MoMo</span>
</button>
<button class="glass-panel p-4 rounded-xl flex flex-col items-center gap-3 border border-white/5 hover:bg-white/5 transition-all grayscale hover:grayscale-0">
<span class="material-symbols-outlined text-slate-400 text-3xl">account_balance</span>
<span class="text-[10px] font-headline font-bold uppercase tracking-widest text-slate-400">Transfer</span>
</button>
</div>
<div class="glass-panel p-8 rounded-2xl space-y-6">
<div class="space-y-2">
<label class="block text-[10px] font-headline uppercase tracking-[0.2em] text-on-surface-variant font-bold">Card Number</label>
<div class="relative">
<input class="w-full bg-surface-container-highest/50 border-none rounded-xl py-4 px-5 text-on-surface focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600 tracking-widest" placeholder="0000 0000 0000 0000" type="text"/>
<span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">payments</span>
</div>
</div>
<div class="grid grid-cols-2 gap-6">
<div class="space-y-2">
<label class="block text-[10px] font-headline uppercase tracking-[0.2em] text-on-surface-variant font-bold">Expiry Date</label>
<input class="w-full bg-surface-container-highest/50 border-none rounded-xl py-4 px-5 text-on-surface focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600" placeholder="MM/YY" type="text"/>
</div>
<div class="space-y-2">
<label class="block text-[10px] font-headline uppercase tracking-[0.2em] text-on-surface-variant font-bold">CVV Code</label>
<input class="w-full bg-surface-container-highest/50 border-none rounded-xl py-4 px-5 text-on-surface focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-600" placeholder="***" type="password"/>
</div>
</div>
</div>
</section>
<div class="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
<div class="pt-1">
<input class="rounded bg-surface-container-highest border-white/10 text-primary focus:ring-primary-container focus:ring-offset-background" id="terms" type="checkbox"/>
</div>
<label class="text-sm text-slate-400 leading-relaxed" for="terms">
                        I agree to the <a class="text-primary hover:underline" href="#">Terms of Service</a> and <a class="text-primary hover:underline" href="#">Refund Policy</a>. I understand that tickets for this interstellar event are non-transferable 48 hours before launch.
                    </label>
</div>
</div>
<!-- Right: Order Summary -->
<aside class="lg:col-span-5 sticky top-28">
<div class="glass-panel p-8 rounded-3xl overflow-hidden relative">
<div class="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 blur-[60px] rounded-full"></div>
<div class="absolute -bottom-12 -left-12 w-48 h-48 bg-secondary/10 blur-[60px] rounded-full"></div>
<h3 class="text-xl font-headline font-bold uppercase tracking-widest mb-8 border-b border-white/5 pb-4">Order Summary</h3>
<!-- Ticket Micro-View -->
<div class="flex gap-6 mb-8 items-center">
<div class="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0">
<img alt="Event preview" class="w-full h-full object-cover" data-alt="Dazzling neon electronic dance music stage with laser lights, smoke, and a massive crowd at a futuristic music festival" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvrllkXL8XtBTf2Wd2tomI2iiaGXTItQbaQCgwK1efF-cQQAFXAdrk2pZTbjZXNpa26F3MMRKyd-k2wsMNmrEcUMEoSO-J-4l9Ms2KQBSXt-npd9EzKoIX0BLxLREGCMqwB4ikJt2_mWbQGy2rbHdnpmIz_ZYDMhS46yJXjxxQqzjj9PjsDFQkri1yZKmJ6Oj_dUHSTv3IvnuawIKjO0hZMwJ6-iJKFfCrEjiE_SuDfmkcUswKOOWKpopCJj0KKk0_k11GUl921Vw"/>
</div>
<div>
<p class="text-secondary font-headline font-bold uppercase text-[10px] tracking-[0.2em] mb-1">Electronic Voyage</p>
<h4 class="text-lg font-headline font-bold leading-tight">Nebula Sound-Waves Festival 2024</h4>
<p class="text-slate-400 text-sm mt-1">Section A, Row 12 • GA Floor</p>
</div>
</div>
<div class="space-y-4 mb-10">
<div class="flex justify-between items-center text-sm">
<span class="text-slate-500">Subtotal (2 Tickets)</span>
<span class="text-on-surface">₫1,200,000</span>
</div>
<div class="flex justify-between items-center text-sm">
<span class="text-slate-500">Service Fee</span>
<span class="text-on-surface">₫45,000</span>
</div>
<div class="flex justify-between items-center text-sm">
<span class="text-slate-500">Processing Tax</span>
<span class="text-on-surface">₫5,000</span>
</div>
<div class="pt-4 border-t border-white/5 mt-4">
<div class="flex justify-between items-end">
<div>
<span class="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500">Total Amount</span>
<p class="text-4xl font-headline font-black text-white mt-1">₫1,250,000</p>
</div>
<div class="bg-white p-2 rounded-lg">
<div class="w-16 h-16 bg-slate-100 flex items-center justify-center">
<span class="material-symbols-outlined text-slate-900 text-3xl">qr_code_2</span>
</div>
</div>
</div>
</div>
</div>
<button class="w-full py-6 rounded-2xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-black uppercase tracking-widest text-lg shadow-[0_0_30px_rgba(252,83,109,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                        Complete Purchase
                        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">rocket_launch</span>
</button>
<p class="text-center text-[10px] text-slate-500 font-headline uppercase tracking-[0.2em] mt-6">
                        Secure SSL Encrypted Checkout
                    </p>
</div>
<!-- Urgency Indicator -->
<div class="mt-6 flex items-center gap-4 bg-secondary/5 border border-secondary/20 p-4 rounded-2xl">
<span class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">timer</span>
<p class="text-xs text-secondary-fixed-dim font-medium">
                        These tickets are held for <span class="font-bold underline">08:44</span>. Complete payment before the session expires.
                    </p>
</div>
</aside>
</div>
</main>
<!-- Footer -->
<footer class="bg-slate-950 full-width py-12 border-t border-white/5 mt-24">
<div class="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 max-w-screen-2xl mx-auto">
<div class="col-span-2 md:col-span-1">
<div class="text-xl font-black text-red-500 font-headline uppercase italic tracking-tighter mb-4">TicketRush</div>
<p class="text-slate-500 text-xs leading-relaxed max-w-xs">
                    Elevating the live experience through interstellar logistics and celestial design. Join the rush.
                </p>
</div>
<div>
<h5 class="font-['Space_Grotesk'] tracking-wide uppercase text-xs font-semibold text-red-400 mb-6">Marketplace</h5>
<ul class="space-y-4">
<li><a class="text-slate-500 text-xs font-semibold uppercase tracking-wider hover:text-red-400 transition-colors" href="#">Sell Tickets</a></li>
<li><a class="text-slate-500 text-xs font-semibold uppercase tracking-wider hover:text-red-400 transition-colors" href="#">Artist Portal</a></li>
<li><a class="text-slate-500 text-xs font-semibold uppercase tracking-wider hover:text-red-400 transition-colors" href="#">Affiliates</a></li>
</ul>
</div>
<div>
<h5 class="font-['Space_Grotesk'] tracking-wide uppercase text-xs font-semibold text-red-400 mb-6">Support</h5>
<ul class="space-y-4">
<li><a class="text-slate-500 text-xs font-semibold uppercase tracking-wider hover:text-red-400 transition-colors" href="#">Help Center</a></li>
<li><a class="text-slate-500 text-xs font-semibold uppercase tracking-wider hover:text-red-400 transition-colors" href="#">Terms of Service</a></li>
<li><a class="text-slate-500 text-xs font-semibold uppercase tracking-wider hover:text-red-400 transition-colors" href="#">Privacy Policy</a></li>
</ul>
</div>
<div class="text-right">
<p class="text-slate-500 text-[10px] font-headline uppercase tracking-widest leading-loose">
                    © 2024 TicketRush.<br/>Powered by the Cosmic Voyager.
                </p>
</div>
</div>
</footer>
</body></html>
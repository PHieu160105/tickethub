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
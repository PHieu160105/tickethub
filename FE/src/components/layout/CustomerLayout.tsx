import { Outlet } from 'react-router-dom'

import { Footer } from './Footer'
import { Navbar } from './Navbar'

export function CustomerLayout() {
  return (
    <div className="app-theme-page min-h-screen flex flex-col text-on-background">
      <Navbar />
      <main className="flex-1 pt-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

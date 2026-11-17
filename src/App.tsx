import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RedirectIfAuthenticated, RequireAuth } from './auth/RequireAuth'
import { AppLayout, PublicLayout } from './components/Layouts'
import { AccountPage } from './pages/AccountPage'
import { DisputePage } from './pages/DisputePage'
import { DisputesPage } from './pages/DisputesPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OtpPage } from './pages/OtpPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { createQueryClient } from './lib/queryClient'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RedirectIfAuthenticated />}>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/otp" element={<OtpPage />} />
        </Route>
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<PortfolioPage />} />
          <Route path="/accounts/:accountNumber" element={<AccountPage />} />
          <Route
            path="/accounts/:accountNumber/transactions/:transactionId/dispute"
            element={<DisputePage />}
          />
          <Route path="/disputes" element={<DisputesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

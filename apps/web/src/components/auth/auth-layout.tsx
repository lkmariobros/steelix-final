"use client"

import { Building2 } from "lucide-react"

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="h-full w-full" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px'
            }} />
          </div>
          
          {/* Gradient Orbs */}
          <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute top-1/2 -right-20 h-60 w-60 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute bottom-20 left-1/4 h-40 w-40 rounded-full bg-orange-500/10 blur-2xl" />
          
          {/* Building Silhouettes */}
          <div className="absolute bottom-0 left-0 right-0 h-64">
            <svg viewBox="0 0 800 200" className="w-full h-full opacity-20" preserveAspectRatio="xMidYMax slice">
              <rect x="50" y="80" width="60" height="120" fill="currentColor" className="text-slate-600" />
              <rect x="120" y="40" width="80" height="160" fill="currentColor" className="text-slate-500" />
              <rect x="210" y="60" width="50" height="140" fill="currentColor" className="text-slate-600" />
              <rect x="270" y="20" width="100" height="180" fill="currentColor" className="text-slate-400" />
              <rect x="380" y="50" width="70" height="150" fill="currentColor" className="text-slate-500" />
              <rect x="460" y="70" width="90" height="130" fill="currentColor" className="text-slate-600" />
              <rect x="560" y="30" width="80" height="170" fill="currentColor" className="text-slate-500" />
              <rect x="650" y="60" width="60" height="140" fill="currentColor" className="text-slate-600" />
              <rect x="720" y="90" width="70" height="110" fill="currentColor" className="text-slate-500" />
            </svg>
          </div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">DevotsPortal</span>
          </div>
          
          {/* Main Text */}
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
              The Complete Platform for<br />
              <span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
                Real Estate Professionals
              </span>
            </h1>
            <p className="text-lg text-slate-300 max-w-md">
              Manage your deals, track commissions, and grow your property business with powerful tools built for agents and agencies.
            </p>
          </div>
          
          {/* Stats/Features */}
          <div className="flex gap-8 text-white/80">
            <div>
              <div className="text-2xl font-bold text-white">500+</div>
              <div className="text-sm text-slate-400">Active Agents</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">RM 2B+</div>
              <div className="text-sm text-slate-400">Transactions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">98%</div>
              <div className="text-sm text-slate-400">Satisfaction</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Form */}
      <div className="flex w-full flex-col justify-center px-4 py-12 lg:w-1/2 lg:px-8 bg-white dark:bg-slate-950">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Logo */}
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">DevotsPortal</span>
          </div>
          
          {/* Header */}
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white lg:text-3xl">{title}</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{subtitle}</p>
          </div>
          
          {/* Form Content */}
          {children}
        </div>
      </div>
    </div>
  )
}


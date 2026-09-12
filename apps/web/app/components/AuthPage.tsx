"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function AuthPage({ isSignin }: { isSignin: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Store local session and proceed to canvas
    localStorage.setItem("scribble3d_user", JSON.stringify({ email: email || "creator@scribble3d.local" }))
    setTimeout(() => {
      router.push("/canvas")
    }, 400)
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-black text-white px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <span className="text-3xl">🎨</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Scribble3D
            </span>
          </Link>
          <h2 className="text-xl font-semibold text-gray-200">
            {isSignin ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Transform your 2D sketches into 3D models
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-sm"
          >
            {loading ? "Opening Studio..." : (isSignin ? "Sign In & Launch Canvas" : "Create Account & Launch Canvas")}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10 flex flex-col items-center gap-3 text-xs text-gray-400">
          <Link
            href="/canvas"
            className="text-violet-400 hover:text-violet-300 transition-colors font-medium flex items-center gap-1"
          >
            Skip and continue as Guest →
          </Link>
          <div className="flex gap-1">
            <span>{isSignin ? "Don't have an account?" : "Already have an account?"}</span>
            <Link
              href={isSignin ? "/signup" : "/signin"}
              className="text-white hover:underline font-medium"
            >
              {isSignin ? "Sign up" : "Sign in"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
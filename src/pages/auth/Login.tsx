import { useState } from "react"
import { useAuth } from "@/components/auth/useAuth"
import { Navigate, useLocation } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Lock, Mail, AlertCircle } from "lucide-react"

export function Login() {
  const { user } = useAuth()
  const location = useLocation()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) {
    const from = (location.state as any)?.from?.pathname || "/"
    return <Navigate to={from} replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message || "Failed to login. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F2] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white border border-[#D9E0E8] shadow-xs mb-4">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt="7TIME Logo"
            className="w-12 h-12 object-contain"
          />
        </div>
        <h1 className="text-3xl font-extrabold text-[#172B4D] tracking-tight">
          7TIME MANAGER
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm font-semibold text-[#2563EB] uppercase tracking-wider">
          Your All-in-One Business Hub
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="rounded-2xl border border-[#D9E0E8] bg-white shadow-xl overflow-hidden">
          <CardHeader className="border-b border-[#D9E0E8] bg-[#F8F7F2] py-5 px-6">
            <CardTitle className="text-xl font-bold text-[#172B4D]">
              Sign In
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-[#52627A]">
              Enter your authorized credentials to access your business ledger.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-[#FDECEC] border border-[#FECDCA] text-[#B42318] text-xs sm:text-sm p-3.5 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#52627A] pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@7time.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-9 border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#66758A] rounded-xl h-10 focus-visible:ring-[#2563EB]/20 focus-visible:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#52627A] pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-9 border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#66758A] rounded-xl h-10 focus-visible:ring-[#2563EB]/20 focus-visible:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl font-semibold shadow-xs text-base bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-[#52627A]">
          Secure financial environment with end-to-end encrypted session management.
        </p>
      </div>
    </div>
  )
}
export default Login

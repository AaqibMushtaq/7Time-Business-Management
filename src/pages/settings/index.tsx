import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth/useAuth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Loader2, Users, ArrowRight } from "lucide-react"
import { RouteManagement } from "./RouteManagement"

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<any>({
    id: "",
    business_name: "7TIME",
    currency: "INR",
    timezone: "Asia/Kolkata",
    date_format: "DD-MMM-YYYY",
    low_stock_threshold: 2
  })

  useEffect(() => {
    let isMounted = true
    supabase.from("app_settings").select("*").limit(1).maybeSingle().then(({ data, error }) => {
      if (isMounted) {
        if (!error && data) {
          setSettings(data)
        }
        setLoading(false)
      }
    })
    return () => {
      isMounted = false
    }
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    // update app_settings table
    const { error } = await supabase
      .from("app_settings")
      .update({
        business_name: settings.business_name,
        currency: settings.currency,
        timezone: settings.timezone,
        date_format: settings.date_format,
        low_stock_threshold: settings.low_stock_threshold
      })
      .eq("id", settings.id)

    if (error) {
      alert("Save failed — no changes were made.")
    } else {
      alert("Saved successfully.")
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="pb-4 border-b border-[#D9E0E8]">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#172B4D]">Application Settings</h1>
        <p className="text-sm text-[#52627A] mt-1">Manage your business preferences, inventory thresholds, and system defaults.</p>
      </div>

      {/* Enterprise Multi-Account Console Banner (Admin Only) */}
      {isAdmin && (
        <Card className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 shadow-xs">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Account & Module Management
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wider">
                    Super Admin
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Create user accounts, individually grant or revoke modules, and activate or suspend access.
                </p>
              </div>
            </div>
            <Link to="/settings/accounts">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-9 px-4 shrink-0 shadow-xs flex items-center gap-1.5 cursor-pointer">
                <span>Manage Users & Modules</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-2xl border border-[#D9E0E8] bg-[#FFFFFF] shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#172B4D]">Business Settings</CardTitle>
            <CardDescription className="text-xs text-[#52627A]">Primary information about your business operation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#172B4D]">Business Name</label>
              <input 
                type="text" 
                className="flex h-10 w-full md:w-1/2 rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                value={settings.business_name}
                onChange={e => setSettings({...settings, business_name: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#172B4D]">Currency</label>
                <select 
                  className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  value={settings.currency}
                  onChange={e => setSettings({...settings, currency: e.target.value})}
                >
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#172B4D]">Timezone</label>
                <select 
                  className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  value={settings.timezone}
                  onChange={e => setSettings({...settings, timezone: e.target.value})}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#172B4D]">Date Format (Display Only)</label>
              <select 
                className="flex h-10 w-full md:w-1/2 rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                value={settings.date_format}
                onChange={e => setSettings({...settings, date_format: e.target.value})}
              >
                <option value="DD-MMM-YYYY">DD-MMM-YYYY (e.g. 15-Oct-2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-15)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-[#D9E0E8] bg-[#FFFFFF] shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#172B4D]">Inventory Thresholds</CardTitle>
            <CardDescription className="text-xs text-[#52627A]">Configure automated alerts for stock management.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#172B4D]">Low Stock Alert Threshold</label>
              <input 
                type="number" 
                className="flex h-10 w-full md:w-1/2 rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                value={settings.low_stock_threshold}
                onChange={e => setSettings({...settings, low_stock_threshold: parseInt(e.target.value) || 0})}
                min="0"
                required
              />
              <p className="text-xs text-[#52627A]">Products with quantity equal to or below this will trigger a low stock alert on the Dashboard.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={saving}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium px-5 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </form>

      {/* Route Management Section */}
      <div className="pt-6 border-t border-[#D9E0E8]">
        <RouteManagement />
      </div>
    </div>
  )
}

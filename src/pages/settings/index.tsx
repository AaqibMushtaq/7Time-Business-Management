import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Loader2 } from "lucide-react"
import { RouteManagement } from "./RouteManagement"

export default function SettingsPage() {
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
    supabase.from("app_settings").select("*").limit(1).single().then(({ data, error }) => {
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
                <option value="DD-MMM-YYYY">DD-MMM-YYYY (e.g. 07-Oct-2026)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-[#D9E0E8] bg-[#FFFFFF] shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#172B4D]">Inventory Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#172B4D]">Low Stock Threshold</label>
              <p className="text-xs text-[#52627A] mb-2">Products with stock at or below this number will be flagged as Low Stock.</p>
              <input 
                type="number" 
                min="0"
                className="flex h-10 w-32 rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                value={settings.low_stock_threshold}
                onChange={e => setSettings({...settings, low_stock_threshold: parseInt(e.target.value) || 0})}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-[#D9E0E8] bg-[#FFFFFF] shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#172B4D]">Payment Methods</CardTitle>
            <CardDescription className="text-xs text-[#52627A] leading-relaxed">Payment methods are globally defined: Cash, UPI, Bank Transfer, Other. These are manual ledger references and do not connect to external APIs.</CardDescription>
          </CardHeader>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold shadow-xs rounded-xl cursor-pointer">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </form>

      <RouteManagement />
    </div>
  )
}

"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState({ showEmail: false, showActivity: true, allowDirectMessages: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          if (data.privacySettings) setSettings(data.privacySettings);
        });
    }
  }, [session?.user?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (res.ok) setMessage("تم الحفظ");
    else setMessage("حدث خطأ");
    setSaving(false);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="card space-y-5">
        <h1 className="text-xl font-bold text-brand-800">إعدادات الخصوصية</h1>

        {message && (
          <div className={`text-sm rounded-lg p-3 text-center ${
            message.includes("خطأ") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-brand-700">إظهار البريد الإلكتروني للآخرين</span>
            <input
              type="checkbox"
              checked={settings.showEmail}
              onChange={(e) => setSettings({ ...settings, showEmail: e.target.checked })}
              className="w-5 h-5 accent-brand-600"
            />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-brand-700">إظهار نشاطي للآخرين</span>
            <input
              type="checkbox"
              checked={settings.showActivity}
              onChange={(e) => setSettings({ ...settings, showActivity: e.target.checked })}
              className="w-5 h-5 accent-brand-600"
            />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-brand-700">السماح بالرسائل المباشرة</span>
            <input
              type="checkbox"
              checked={settings.allowDirectMessages}
              onChange={(e) => setSettings({ ...settings, allowDirectMessages: e.target.checked })}
              className="w-5 h-5 accent-brand-600"
            />
          </label>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </form>
      </div>
    </div>
  );
}

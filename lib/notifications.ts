import type { WeeklyReport } from './weekly-report'
import { formatCurrency } from './format'

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | null {
  if (!isNotificationSupported()) return null
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!isNotificationSupported()) return null
  return Notification.requestPermission()
}

/** Bangun ringkasan singkat laporan mingguan untuk body notifikasi. */
function buildReportSummary(report: WeeklyReport): string {
  const lines: string[] = []

  lines.push(
    `Saldo ${report.balanceChange >= 0 ? '+' : '-'}${formatCurrency(Math.abs(report.balanceChange))}`
  )

  if (report.randomEvents.length > 0) lines.push(report.randomEvents[0])
  if (report.growth.length > 0) lines.push(`${report.growth.length} fighter berkembang`)
  if (report.healed.length > 0) lines.push(`${report.healed.length} fighter pulih dari cedera`)
  if (report.birthdays.length > 0) lines.push(`🎂 ${report.birthdays.join(', ')}`)
  if (report.contractWarnings.length > 0) lines.push(`${report.contractWarnings.length} kontrak akan habis`)
  if (report.retirements.length > 0) {
    lines.push(`${report.retirements.map((r) => r.name).join(', ')} pensiun`)
  }

  return lines.join(' • ')
}

/** Tampilkan notifikasi lokal berisi ringkasan laporan minggu yang baru selesai. */
export async function showWeeklyReportNotification(report: WeeklyReport) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  const title = `Laporan Minggu ke-${report.week}`
  const options: NotificationOptions = {
    body: buildReportSummary(report),
    icon: '/fighter-silhouette.png',
    tag: 'weekly-report',
  }

  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) {
    registration.showNotification(title, options)
  } else {
    new Notification(title, options)
  }
}

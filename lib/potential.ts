export function getPotentialLabel(potential: number): { label: string; colorClass: string } {
  if (potential >= 85) return { label: 'Sangat Tinggi', colorClass: 'text-octagon-teal' }
  if (potential >= 70) return { label: 'Tinggi', colorClass: 'text-octagon-amber' }
  if (potential >= 55) return { label: 'Sedang', colorClass: 'text-gray-300' }
  return { label: 'Terbatas', colorClass: 'text-gray-500' }
}

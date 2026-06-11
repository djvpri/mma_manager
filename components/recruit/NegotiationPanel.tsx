'use client'

import { useState } from 'react'
import type { RecruitCandidate } from '@/lib/generate-recruits'
import { formatCurrency } from '@/lib/format'
import {
  type ContractOffer,
  getInitialExpectation,
  getOpeningOffer,
  evaluateOffer,
  MIN_CONTRACT_LENGTH,
  MAX_CONTRACT_LENGTH,
  MAX_NEGOTIATION_ROUNDS,
} from '@/lib/negotiation'

interface NegotiationPanelProps {
  candidate: RecruitCandidate
  reputation: number
  balance: number
  signing: boolean
  onCancel: () => void
  onAccept: (offer: ContractOffer) => void
  onWalkAway: () => void
}

export default function NegotiationPanel({
  candidate,
  reputation,
  balance,
  signing,
  onCancel,
  onAccept,
  onWalkAway,
}: NegotiationPanelProps) {
  const [expectation, setExpectation] = useState<ContractOffer>(() => getInitialExpectation(candidate, reputation))
  const [offer, setOffer] = useState<ContractOffer>(() => getOpeningOffer(candidate))
  const [round, setRound] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [status, setStatus] = useState<'negotiating' | 'accepted' | 'rejected'>('negotiating')
  const [finalOffer, setFinalOffer] = useState<ContractOffer | null>(null)
  const [counterOffer, setCounterOffer] = useState<ContractOffer | null>(null)

  const salaryMin = Math.round((candidate.salary_monthly * 0.5) / 100_000) * 100_000
  const salaryMax = Math.round((candidate.salary_monthly * 1.8) / 100_000) * 100_000
  const winBonusMax = Math.round((candidate.salary_monthly * 2.5) / 100_000) * 100_000
  const bonusMax = Math.round((candidate.cost * 1.8) / 500_000) * 500_000
  const buyoutMin = Math.round((candidate.salary_monthly * 2) / 500_000) * 500_000
  const buyoutMax = Math.round((candidate.salary_monthly * 15) / 500_000) * 500_000

  function handleSubmit() {
    const nextRound = round + 1
    const result = evaluateOffer(candidate, expectation, offer, nextRound)
    setRound(nextRound)
    setLog((l) => [
      ...l,
      `Tawaranmu: ${formatCurrency(offer.salary)}/minggu, win bonus ${formatCurrency(offer.winBonus)}, bonus tanda tangan ${formatCurrency(offer.bonus)}, kontrak ${offer.contractLength}x${offer.titleShotClause ? ', dengan klausul Title Shot' : ''}.`,
      result.message,
    ])

    if (result.outcome === 'accept') {
      setStatus('accepted')
      setFinalOffer(offer)
      setCounterOffer(null)
    } else if (result.outcome === 'reject') {
      setStatus('rejected')
      setCounterOffer(null)
    } else {
      setExpectation(result.expectation)
      setCounterOffer(result.expectation)
    }
  }

  function handleAcceptCounter() {
    if (!counterOffer) return
    setStatus('accepted')
    setFinalOffer(counterOffer)
    setLog((l) => [...l, 'Kamu menerima tawaran balasan mereka.'])
  }

  const insufficientBalance = finalOffer ? balance < finalOffer.bonus : false

  return (
    <div className="mt-3 space-y-3 rounded-md border border-octagon-border bg-octagon-dark p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white">Negosiasi Kontrak</p>
        <span className="text-[10px] text-gray-500">
          Putaran {round}/{MAX_NEGOTIATION_ROUNDS}
        </span>
      </div>

      <div className="max-h-28 space-y-1 overflow-y-auto rounded bg-black/30 p-2 text-[11px] leading-relaxed text-gray-300">
        {log.length === 0 ? (
          <p className="text-gray-500">Atur tawaranmu lalu ajukan ke {candidate.name}.</p>
        ) : (
          log.map((msg, i) => <p key={i}>{msg}</p>)
        )}
      </div>

      {status === 'negotiating' && (
        <>
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
              <span>Base Purse (Gaji Mingguan)</span>
              <span className="font-semibold text-white">{formatCurrency(offer.salary)}</span>
            </div>
            <input
              type="range"
              min={salaryMin}
              max={salaryMax}
              step={100_000}
              value={offer.salary}
              onChange={(e) => setOffer((o) => ({ ...o, salary: Number(e.target.value) }))}
              className="w-full accent-octagon-red"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
              <span>Win Bonus (per kemenangan)</span>
              <span className="font-semibold text-white">{formatCurrency(offer.winBonus)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={winBonusMax}
              step={100_000}
              value={offer.winBonus}
              onChange={(e) => setOffer((o) => ({ ...o, winBonus: Number(e.target.value) }))}
              className="w-full accent-octagon-red"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
              <span>Bonus Tanda Tangan</span>
              <span className="font-semibold text-white">{formatCurrency(offer.bonus)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={bonusMax}
              step={500_000}
              value={offer.bonus}
              onChange={(e) => setOffer((o) => ({ ...o, bonus: Number(e.target.value) }))}
              className="w-full accent-octagon-red"
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] text-gray-400">Lama Kontrak</p>
            <div className="flex gap-1.5">
              {Array.from(
                { length: MAX_CONTRACT_LENGTH - MIN_CONTRACT_LENGTH + 1 },
                (_, i) => MIN_CONTRACT_LENGTH + i
              ).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOffer((o) => ({ ...o, contractLength: n }))}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                    offer.contractLength === n
                      ? 'border-octagon-teal bg-octagon-teal/15 text-octagon-teal'
                      : 'border-octagon-border text-gray-400 hover:border-octagon-teal hover:text-octagon-teal'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
              <span>Klausul Buyout</span>
              <span className="font-semibold text-white">{formatCurrency(offer.buyoutClause)}</span>
            </div>
            <input
              type="range"
              min={buyoutMin}
              max={buyoutMax}
              step={500_000}
              value={offer.buyoutClause}
              onChange={(e) => setOffer((o) => ({ ...o, buyoutClause: Number(e.target.value) }))}
              className="w-full accent-octagon-red"
            />
            <p className="mt-1 text-[10px] text-gray-500">
              Biaya yang harus dibayar gym jika memutus kontrak {candidate.name.split(' ')[0]} sebelum kontrak berakhir.
            </p>
          </div>

          <label className="flex items-center justify-between gap-2 rounded-md border border-octagon-border px-2.5 py-2 text-[10px] text-gray-300">
            <span>
              Klausul Title Shot
              <span className="block text-gray-500">Menang 3x beruntun → berhak menuntut laga juara.</span>
            </span>
            <input
              type="checkbox"
              checked={offer.titleShotClause}
              onChange={(e) => setOffer((o) => ({ ...o, titleShotClause: e.target.checked }))}
              className="h-4 w-4 shrink-0 accent-octagon-red"
            />
          </label>

          <div className="flex gap-2">
            {counterOffer && (
              <button
                type="button"
                onClick={handleAcceptCounter}
                className="flex-1 rounded-md border border-octagon-teal px-3 py-1.5 text-xs font-semibold text-octagon-teal transition-colors hover:bg-octagon-teal/10"
              >
                Terima Tawaran Mereka
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 rounded-md bg-octagon-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90"
            >
              Ajukan Tawaran
            </button>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-center text-[10px] text-gray-500 hover:text-gray-300"
          >
            Batalkan Negosiasi
          </button>
        </>
      )}

      {status === 'accepted' && finalOffer && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-octagon-teal">Kesepakatan tercapai!</p>
          <p className="text-[11px] text-gray-300">
            Base Purse {formatCurrency(finalOffer.salary)}/minggu · Win bonus {formatCurrency(finalOffer.winBonus)} ·
            Bonus tanda tangan {formatCurrency(finalOffer.bonus)} · Kontrak {finalOffer.contractLength}x pertarungan ·
            Buyout {formatCurrency(finalOffer.buyoutClause)}
            {finalOffer.titleShotClause ? ' · Klausul Title Shot' : ''}
          </p>
          {insufficientBalance && (
            <p className="text-[10px] text-octagon-red">Saldo tidak cukup untuk membayar bonus tanda tangan.</p>
          )}
          <button
            type="button"
            onClick={() => onAccept(finalOffer)}
            disabled={signing || insufficientBalance}
            className="w-full rounded-md bg-octagon-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signing ? 'Memproses...' : 'Tanda Tangan Kontrak'}
          </button>
        </div>
      )}

      {status === 'rejected' && (
        <button
          type="button"
          onClick={onWalkAway}
          className="w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-red hover:text-octagon-red"
        >
          Tutup
        </button>
      )}
    </div>
  )
}

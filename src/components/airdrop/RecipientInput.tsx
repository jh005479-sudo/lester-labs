'use client'

import { useState, useCallback } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { Upload, List, Equal } from 'lucide-react'
import type { Recipient } from './RecipientTable'

interface RecipientInputProps {
  onChange: (recipients: Recipient[]) => void
}

function parseManualText(text: string): Recipient[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Support: "address, amount" or "address amount" or "address\tamount"
      const parts = line.split(/[\s,\t]+/)
      return { address: parts[0] ?? '', amount: parts[1] ?? '' }
    })
}

function parseCSVText(text: string): Recipient[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  // Skip header row if first cell is not an address-like value
  const start =
    lines[0] && !lines[0].startsWith('0x') ? 1 : 0
  return lines.slice(start).map((line) => {
    const [address = '', amount = ''] = line.split(',').map((s) => s.trim())
    return { address, amount }
  })
}

export function RecipientInput({ onChange }: RecipientInputProps) {
  const [manualText, setManualText] = useState('')
  const [csvRowCount, setCsvRowCount] = useState<number | null>(null)
  const [csvFileName, setCsvFileName] = useState<string>('')
  const [equalTotal, setEqualTotal] = useState('')
  const [equalAddresses, setEqualAddresses] = useState('')
  const [activeTab, setActiveTab] = useState('manual')

  const handleManualChange = useCallback(
    (text: string) => {
      setManualText(text)
      onChange(parseManualText(text))
    },
    [onChange],
  )

  const handleCSVUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setCsvFileName(file.name)
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? ''
        const parsed = parseCSVText(text)
        setCsvRowCount(parsed.length)
        onChange(parsed)
      }
      reader.readAsText(file)
    },
    [onChange],
  )

  const handleEqualChange = useCallback(
    (total: string, addresses: string) => {
      const addrs = addresses
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean)
      const totalNum = parseFloat(total)

      if (addrs.length === 0 || isNaN(totalNum) || totalNum <= 0) {
        onChange([])
        return
      }

      const perAddress = (totalNum / addrs.length).toFixed(6).replace(/\.?0+$/, '')
      const recipients: Recipient[] = addrs.map((address) => ({
        address,
        amount: perAddress,
      }))
      onChange(recipients)
    },
    [onChange],
  )

  // Equal distribution preview
  const equalAddressList = equalAddresses
    .split('\n')
    .map((a) => a.trim())
    .filter(Boolean)
  const equalTotalNum = parseFloat(equalTotal)
  const equalPerAddr =
    equalAddressList.length > 0 && !isNaN(equalTotalNum) && equalTotalNum > 0
      ? (equalTotalNum / equalAddressList.length).toFixed(6).replace(/\.?0+$/, '')
      : null

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
      active
        ? 'bg-[var(--accent)] text-white'
        : 'text-white/50 hover:text-white hover:bg-white/10'
    }`

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(v) => {
        setActiveTab(v)
        // Reset recipients when switching tabs
        onChange([])
      }}
    >
      <Tabs.List className="mb-4 flex gap-1 rounded-lg bg-white/5 p-1 overflow-x-auto">
        <Tabs.Trigger value="manual" className={tabClass(activeTab === 'manual')}>
          <List size={14} />
          Manual Entry
        </Tabs.Trigger>
        <Tabs.Trigger value="csv" className={tabClass(activeTab === 'csv')}>
          <Upload size={14} />
          CSV Upload
        </Tabs.Trigger>
        <Tabs.Trigger value="equal" className={tabClass(activeTab === 'equal')}>
          <Equal size={14} />
          Equal Distribution
        </Tabs.Trigger>
      </Tabs.List>

      {/* Manual */}
      <Tabs.Content value="manual" className="space-y-2">
        <textarea
          value={manualText}
          onChange={(e) => handleManualChange(e.target.value)}
          placeholder={`0xAddress1, 100\n0xAddress2, 250\n0xAddress3, 100`}
          rows={8}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/20 focus:border-[var(--accent)]/50 focus:outline-none resize-y"
        />
        <p className="text-xs text-white/40">One entry per line: address, amount</p>
      </Tabs.Content>

      {/* CSV */}
      <Tabs.Content value="csv" className="space-y-3">
        <div className="relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-white/10 bg-white/5 px-6 py-10 hover:border-white/20 transition-colors cursor-pointer">
          <Upload size={24} className="text-white/30" />
          <div className="text-center">
            <p className="text-sm text-white/70">
              {csvFileName ? (
                <>
                  <span className="font-medium text-white">{csvFileName}</span>
                  {csvRowCount !== null && (
                    <span className="ml-2 text-white/40">— {csvRowCount} rows parsed</span>
                  )}
                </>
              ) : (
                'Drop a CSV file here or click to browse'
              )}
            </p>
            <p className="mt-1 text-xs text-white/30">Expected format: address,amount (header optional)</p>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleCSVUpload}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        {csvRowCount !== null && (
          <p className="text-xs text-green-400">
            ✓ Parsed {csvRowCount} {csvRowCount === 1 ? 'recipient' : 'recipients'}
          </p>
        )}
      </Tabs.Content>

      {/* Equal Distribution */}
      <Tabs.Content value="equal" className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">Total Amount to Distribute</label>
          <input
            type="number"
            value={equalTotal}
            onChange={(e) => {
              setEqualTotal(e.target.value)
              handleEqualChange(e.target.value, equalAddresses)
            }}
            placeholder="e.g. 10000"
            min="0"
            step="any"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">Recipient Addresses</label>
          <textarea
            value={equalAddresses}
            onChange={(e) => {
              setEqualAddresses(e.target.value)
              handleEqualChange(equalTotal, e.target.value)
            }}
            placeholder="One address per line"
            rows={6}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/20 focus:border-[var(--accent)]/50 focus:outline-none resize-y"
          />
        </div>
        {equalPerAddr !== null && equalAddressList.length > 0 && (
          <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-4 py-3">
            <p className="text-sm text-white/80">
              <span className="font-semibold text-white">{equalPerAddr}</span> tokens each to{' '}
              <span className="font-semibold text-white">{equalAddressList.length}</span>{' '}
              {equalAddressList.length === 1 ? 'address' : 'addresses'}
            </p>
          </div>
        )}
      </Tabs.Content>
    </Tabs.Root>
  )
}

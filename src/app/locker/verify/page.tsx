import Link from 'next/link'
import { createPublicClient, http, keccak256, formatUnits, erc20Abi } from 'viem'
import { LockKeyhole, CheckCircle2, ArrowUpRight } from 'lucide-react'
import { litvm } from '@/config/chains'
import { LIQUIDITY_LOCKER_ADDRESS, LIQUIDITY_LOCKER_RUNTIME_CODE_HASH, LITVM_LEGACY_LIQUIDITY_LOCKERS } from '@/config/contracts'
import { LIQUIDITY_LOCKER_ABI } from '@/lib/contracts/liquidityLocker'
import { lockVerificationLink, validAddress } from '@/lib/projectJourney'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Verify a liquidity lock | Lester Labs' }
const targets = [
  { address: LIQUIDITY_LOCKER_ADDRESS, runtimeCodeHash: LIQUIDITY_LOCKER_RUNTIME_CODE_HASH, label: 'Current locker' },
  ...LITVM_LEGACY_LIQUIDITY_LOCKERS.map((target) => ({ ...target, label: 'Legacy locker' })),
]
const client = createPublicClient({ chain: litvm, transport: http(litvm.rpcUrls.default.http[0], { timeout: 6_000, retryCount: 0 }) })

export default async function VerifyLockPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const id = typeof query.id === 'string' ? query.id : ''
  const contract = typeof query.contract === 'string' ? query.contract : LIQUIDITY_LOCKER_ADDRESS
  const target = targets.find((entry) => entry.address.toLowerCase() === contract.toLowerCase())
  let problem = ''
  let result: { token: `0x${string}`; amount: string; unlock: Date; withdrawer: string; withdrawn: boolean; block: string; timestamp: number } | undefined
  if (id) {
    try {
      if (query.chain !== undefined && query.chain !== '4441') throw new Error('Choose LitVM testnet to view this lock.')
      if (!target) throw new Error('This locker is not in the Lester Labs contract directory.')
      lockVerificationLink(contract, id)
      const block = await client.getBlock()
      const bytecode = await client.getBytecode({ address: target.address, blockNumber: block.number })
      if (!bytecode || keccak256(bytecode).toLowerCase() !== target.runtimeCodeHash.toLowerCase()) throw new Error('The locker could not be verified. Please try again later.')
      const lock = await client.readContract({ address: target.address, abi: LIQUIDITY_LOCKER_ABI, functionName: 'getLock', args: [BigInt(id)], blockNumber: block.number })
      if (!validAddress(lock[0]) || lock[1] === 0n) throw new Error('No lock was found with this ID. Check the ID and locker.')
      let amount = `${lock[1].toString()} base units`
      try {
        const decimals = await client.readContract({ address: lock[0], abi: erc20Abi, functionName: 'decimals', blockNumber: block.number })
        if (decimals <= 36) amount = `${formatUnits(lock[1], decimals)} LP tokens`
      } catch { /* The exact recorded amount remains available without metadata. */ }
      if (lock[2] > 8_640_000_000_000n) throw new Error('The recorded unlock date cannot be displayed.')
      result = { token: lock[0], amount, unlock: new Date(Number(lock[2]) * 1_000), withdrawer: lock[3], withdrawn: lock[4], block: block.number.toString(), timestamp: Number(block.timestamp) }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      problem = /Choose LitVM|not in the Lester|could not be verified|No lock was found|This lock link|recorded unlock date/.test(message) ? message : 'We couldn’t load this lock. Try again in a moment.'
    }
  }
  return <main className="workspace-page narrow">
    <header className="workspace-heading"><div><p className="workspace-eyebrow">Public verification</p><h1>Check a liquidity lock</h1><p>No wallet connection needed.</p></div><LockKeyhole size={28} className="hidden text-violet-300 sm:block" /></header>
    <form className="workspace-panel workspace-form" action="/locker/verify">
      <input type="hidden" name="chain" value="4441" />
      <label>Locker<select name="contract" defaultValue={target?.address ?? LIQUIDITY_LOCKER_ADDRESS}>{targets.map((entry) => <option key={entry.address} value={entry.address}>{entry.label} · {entry.address.slice(0, 8)}</option>)}</select></label>
      <label>Lock ID<input name="id" inputMode="numeric" pattern="[0-9]+" maxLength={78} required defaultValue={id} placeholder="For example, 1" /></label>
      <button className="workspace-button" type="submit">Check lock</button>
    </form>
    {problem && <div className="workspace-notice" role="alert">{problem}</div>}
    {result && <section className="workspace-panel mt-6">
      <div className="flex items-center gap-3"><CheckCircle2 size={24} className="text-emerald-300" /><div><p className="workspace-eyebrow">Lock #{id}</p><h2>{result.withdrawn ? 'Withdrawn' : result.unlock.getTime() <= result.timestamp * 1_000 ? 'Ready to withdraw' : 'Liquidity is locked'}</h2></div></div>
      <dl className="workspace-facts"><div><dt>Amount</dt><dd>{result.amount}</dd></div><div><dt>Unlocks</dt><dd>{result.unlock.toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</dd></div><div><dt>LP token</dt><dd><Link href={`/explorer/token/${result.token}`}>{result.token}</Link></dd></div><div><dt>Withdrawal wallet</dt><dd><Link href={`/portfolio?address=${result.withdrawer}`}>{result.withdrawer}</Link></dd></div></dl>
      <p className="workspace-note">This confirms the recorded lock. It does not assess the token or project.</p>
      <details className="workspace-details"><summary>Verification details</summary><p>LitVM testnet · Chain 4441 · Block {result.block}</p><p>Locker: {target?.address}</p><p>Contract code and lock state checked at the same block.</p></details>
      {!result.withdrawn && <Link className="workspace-button mt-4 mr-3" href={`/locker?tab=my-locks&contract=${contract}&id=${id}`}>Open withdrawal</Link>}
      <Link className="workspace-button secondary mt-4" href={`/explorer/address/${contract}`}>View contract <ArrowUpRight size={16} /></Link>
    </section>}
  </main>
}

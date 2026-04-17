'use client'

import { useEffect, useRef, useState } from 'react'
import { type Address, type Hex } from 'viem'
import { isValidContractAddress } from '@/config/contracts'
import { getLatestBlockNumber, getTransactionReceipt, rpc } from '@/lib/rpcClient'
import {
  compareLedgerMessages,
  decodeLedgerLog,
  LEDGER_HISTORY_BLOCK_WINDOW,
  LEDGER_MESSAGE_POSTED_TOPIC,
  LEDGER_PAGE_SIZE,
  LEDGER_POLL_INTERVAL_MS,
  LEDGER_RECONNECT_DELAY_MS,
  LEDGER_WS_URL,
  padAddressTopic,
  type LedgerMessage,
  type LedgerRpcLog,
} from '@/lib/contracts/ledger'

type ConnectionMode = 'connecting' | 'websocket' | 'polling'

interface UseLedgerFeedOptions {
  address: Address
  initializationReady?: boolean
  totalMessageCount?: bigint
  viewerAddress?: Address
}

function toBlockHex(blockNumber: number): Hex {
  return `0x${blockNumber.toString(16)}` as Hex
}

function normalizeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function useLedgerFeed({
  address,
  initializationReady = true,
  totalMessageCount,
  viewerAddress,
}: UseLedgerFeedOptions) {
  const [messages, setMessages] = useState<LedgerMessage[]>([])
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [userPostCount, setUserPostCount] = useState<number | null>(null)

  const initializedAddressRef = useRef<string | null>(null)
  const sessionRef = useRef(0)
  const totalMessageCountRef = useRef<bigint | undefined>(totalMessageCount)
  const viewerAddressRef = useRef<Address | undefined>(viewerAddress)
  const messageMapRef = useRef(new Map<string, LedgerMessage>())
  const historyBufferRef = useRef<LedgerMessage[]>([])
  const historyCursorRef = useRef<number | null>(null)
  const latestSeenBlockRef = useRef(0)
  const loadInFlightRef = useRef(false)
  const pollInFlightRef = useRef(false)
  const hasLoadedInitialRef = useRef(false)
  const highlightTimeoutsRef = useRef(new Set<number>())
  const userCountRef = useRef(0)

  totalMessageCountRef.current = totalMessageCount
  viewerAddressRef.current = viewerAddress

  function clearHighlights() {
    for (const timeout of highlightTimeoutsRef.current) {
      window.clearTimeout(timeout)
    }
    highlightTimeoutsRef.current.clear()
  }

  function updateHasMoreState() {
    const totalKnown = totalMessageCountRef.current
    const loaded = BigInt(messageMapRef.current.size + historyBufferRef.current.length)

    if (totalKnown !== undefined) {
      setHasMore(loaded < totalKnown)
      return
    }

    setHasMore(historyBufferRef.current.length > 0 || (historyCursorRef.current ?? 0) > 0)
  }

  function scheduleHighlightClear(messageId: string, session: number) {
    const timeout = window.setTimeout(() => {
      highlightTimeoutsRef.current.delete(timeout)

      if (session !== sessionRef.current) return

      const current = messageMapRef.current.get(messageId)
      if (!current?.isHighlighted) return

      messageMapRef.current.set(messageId, { ...current, isHighlighted: false })
      setMessages(Array.from(messageMapRef.current.values()).sort(compareLedgerMessages))
    }, 2400)

    highlightTimeoutsRef.current.add(timeout)
  }

  function upsertMessages(incoming: LedgerMessage[], highlight: boolean, session: number) {
    if (!incoming.length || session !== sessionRef.current) return

    let changed = false
    const highlightIds: string[] = []

    for (const message of incoming) {
      const existing = messageMapRef.current.get(message.id)
      const nextMessage: LedgerMessage = {
        ...(existing ?? {}),
        ...message,
        isHighlighted: existing?.isHighlighted || (!existing && highlight) || false,
      }

      const didChange =
        !existing ||
        existing.text !== nextMessage.text ||
        existing.timestamp !== nextMessage.timestamp ||
        existing.txHash !== nextMessage.txHash ||
        existing.blockHash !== nextMessage.blockHash ||
        existing.blockNumber !== nextMessage.blockNumber ||
        existing.logIndex !== nextMessage.logIndex ||
        existing.isHighlighted !== nextMessage.isHighlighted

      if (!didChange) continue

      if (highlight && !existing && viewerAddressRef.current && message.sender.toLowerCase() === viewerAddressRef.current.toLowerCase()) {
        userCountRef.current += 1
        setUserPostCount(userCountRef.current)
      }

      messageMapRef.current.set(message.id, nextMessage)
      changed = true

      if (highlight && !existing) {
        highlightIds.push(message.id)
      }

      if (message.blockNumber) {
        latestSeenBlockRef.current = Math.max(latestSeenBlockRef.current, Number(message.blockNumber))
      }
    }

    if (!changed) {
      updateHasMoreState()
      return
    }

    setMessages(Array.from(messageMapRef.current.values()).sort(compareLedgerMessages))
    updateHasMoreState()

    for (const messageId of highlightIds) {
      scheduleHighlightClear(messageId, session)
    }
  }

  async function bufferHistoryUntilPageFilled(session: number) {
    if (historyCursorRef.current === null) {
      historyCursorRef.current = await getLatestBlockNumber()
    }

    while (historyBufferRef.current.length < LEDGER_PAGE_SIZE && (historyCursorRef.current ?? 0) > 0) {
      if (session !== sessionRef.current) return

      const toBlock = historyCursorRef.current ?? 0
      const fromBlock = Math.max(1, toBlock - LEDGER_HISTORY_BLOCK_WINDOW + 1)

      const logs = await rpc<LedgerRpcLog[]>('eth_getLogs', [
        {
          address,
          topics: [LEDGER_MESSAGE_POSTED_TOPIC],
          fromBlock: toBlockHex(fromBlock),
          toBlock: toBlockHex(toBlock),
        },
      ])

      if (session !== sessionRef.current) return

      historyCursorRef.current = fromBlock > 1 ? fromBlock - 1 : 0

      const decoded = logs
        .map((log) => decodeLedgerLog(log))
        .filter((message): message is LedgerMessage => Boolean(message))
        .sort(compareLedgerMessages)

      if (decoded.length) {
        const bufferedIds = new Set(historyBufferRef.current.map((message) => message.id))

        for (const message of decoded) {
          if (messageMapRef.current.has(message.id) || bufferedIds.has(message.id)) continue
          historyBufferRef.current.push(message)
        }

        historyBufferRef.current.sort(compareLedgerMessages)
      }

      updateHasMoreState()
    }
  }

  async function loadMore() {
    if (!isValidContractAddress(address) || loadInFlightRef.current) return

    const session = sessionRef.current
    const isInitialLoad = !hasLoadedInitialRef.current

    loadInFlightRef.current = true
    setError(null)

    if (isInitialLoad) {
      setIsLoadingInitial(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const totalKnown = totalMessageCountRef.current
      if (totalKnown === 0n) {
        hasLoadedInitialRef.current = true
        updateHasMoreState()
        return
      }

      await bufferHistoryUntilPageFilled(session)
      if (session !== sessionRef.current) return

      const nextBatch = historyBufferRef.current.splice(0, LEDGER_PAGE_SIZE)
      upsertMessages(nextBatch, false, session)
      hasLoadedInitialRef.current = true
      updateHasMoreState()
    } catch (loadError) {
      if (session === sessionRef.current) {
        setError(normalizeError(loadError, 'Unable to load The Ledger history right now.'))
      }
    } finally {
      if (session === sessionRef.current) {
        setIsLoadingInitial(false)
        setIsLoadingMore(false)
      }
      loadInFlightRef.current = false
    }
  }

  async function pollForNewMessages(session: number) {
    if (pollInFlightRef.current || session !== sessionRef.current) return

    pollInFlightRef.current = true

    try {
      const latestBlock = await getLatestBlockNumber()
      if (session !== sessionRef.current) return

      const fromBlock = latestSeenBlockRef.current > 0
        ? Math.max(1, latestSeenBlockRef.current - 3)
        : Math.max(1, latestBlock - 3)

      const logs = await rpc<LedgerRpcLog[]>('eth_getLogs', [
        {
          address,
          topics: [LEDGER_MESSAGE_POSTED_TOPIC],
          fromBlock: toBlockHex(fromBlock),
          toBlock: toBlockHex(latestBlock),
        },
      ])

      if (session !== sessionRef.current) return

      const decoded = logs
        .map((log) => decodeLedgerLog(log))
        .filter((message): message is LedgerMessage => Boolean(message))
        .sort(compareLedgerMessages)

      upsertMessages(decoded, true, session)
      latestSeenBlockRef.current = Math.max(latestSeenBlockRef.current, latestBlock)
    } catch (pollError) {
      if (session === sessionRef.current) {
        setError(normalizeError(pollError, 'Live updates are temporarily unavailable.'))
      }
    } finally {
      pollInFlightRef.current = false
    }
  }

  async function ingestConfirmedTransaction(txHash: Hex) {
    if (!isValidContractAddress(address)) return

    try {
      const receipt = await getTransactionReceipt(txHash)
      const logs = Array.isArray(receipt?.logs) ? (receipt.logs as LedgerRpcLog[]) : []
      const ledgerLogs = logs
        .filter((log) => log.address?.toLowerCase() === address.toLowerCase())
        .map((log) => decodeLedgerLog(log))
        .filter((message): message is LedgerMessage => Boolean(message))
        .sort(compareLedgerMessages)

      upsertMessages(ledgerLogs, true, sessionRef.current)
    } catch {
      // Receipt-driven feed insertion is best-effort. The WebSocket/polling path will still recover.
    }
  }

  useEffect(() => {
    updateHasMoreState()
  }, [totalMessageCount])

  useEffect(() => {
    if (!viewerAddress || !isValidContractAddress(address)) {
      userCountRef.current = 0
      setUserPostCount(null)
      return
    }

    if (totalMessageCount === 0n) {
      userCountRef.current = 0
      setUserPostCount(0)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const logs = await rpc<LedgerRpcLog[]>('eth_getLogs', [
          {
            address,
            topics: [LEDGER_MESSAGE_POSTED_TOPIC, padAddressTopic(viewerAddress)],
            fromBlock: '0x1',
            toBlock: 'latest',
          },
        ])

        if (cancelled) return

        userCountRef.current = logs.length
        setUserPostCount(logs.length)
      } catch {
        if (!cancelled) {
          setUserPostCount(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [address, totalMessageCount, viewerAddress])

  useEffect(() => {
    if (!isValidContractAddress(address)) {
      initializedAddressRef.current = null
      setMessages([])
      setIsLoadingInitial(false)
      setIsLoadingMore(false)
      setHasMore(false)
      setConnectionMode('connecting')
      setError('The Ledger contract address is not configured.')
      return
    }

    if (!initializationReady) {
      setIsLoadingInitial(true)
      return
    }

    if (initializedAddressRef.current === address) {
      return
    }

    initializedAddressRef.current = address
    sessionRef.current += 1
    const session = sessionRef.current

    messageMapRef.current = new Map()
    historyBufferRef.current = []
    historyCursorRef.current = null
    latestSeenBlockRef.current = 0
    loadInFlightRef.current = false
    pollInFlightRef.current = false
    hasLoadedInitialRef.current = false

    clearHighlights()
    setMessages([])
    setError(null)
    setIsLoadingInitial(true)
    setIsLoadingMore(false)
    setHasMore(totalMessageCount ? totalMessageCount > 0n : false)
    setConnectionMode('connecting')

    let socket: WebSocket | null = null
    let reconnectTimeout: number | null = null
    let pollingInterval: number | null = null
    let subscriptionId: string | null = null
    let disposed = false
    let wsRequestId = 0

    const stopPolling = () => {
      if (pollingInterval) {
        window.clearInterval(pollingInterval)
        pollingInterval = null
      }
    }

    const startPolling = () => {
      if (disposed || pollingInterval) return

      setConnectionMode('polling')
      void pollForNewMessages(session)
      pollingInterval = window.setInterval(() => {
        void pollForNewMessages(session)
      }, LEDGER_POLL_INTERVAL_MS)
    }

    const disconnectSocket = () => {
      if (!socket) return

      if (socket.readyState === WebSocket.OPEN && subscriptionId) {
        socket.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: ++wsRequestId,
            method: 'eth_unsubscribe',
            params: [subscriptionId],
          }),
        )
      }

      socket.close()
      socket = null
      subscriptionId = null
    }

    const scheduleReconnect = () => {
      if (disposed || reconnectTimeout) return

      reconnectTimeout = window.setTimeout(() => {
        reconnectTimeout = null
        connectWebSocket()
      }, LEDGER_RECONNECT_DELAY_MS)
    }

    const connectWebSocket = () => {
      if (disposed) return

      try {
        setConnectionMode('connecting')
        socket = new WebSocket(LEDGER_WS_URL)

        socket.onopen = () => {
          if (disposed || !socket) return

          stopPolling()
          setConnectionMode('websocket')
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: ++wsRequestId,
              method: 'eth_subscribe',
              params: [
                'logs',
                {
                  address,
                  topics: [LEDGER_MESSAGE_POSTED_TOPIC],
                },
              ],
            }),
          )
        }

        socket.onmessage = (event) => {
          if (disposed) return

          try {
            const message = JSON.parse(event.data) as {
              id?: number
              error?: { message?: string }
              params?: { result?: LedgerRpcLog }
              result?: string
            }

            if (typeof message.result === 'string' && message.id) {
              subscriptionId = message.result
              return
            }

            if (message.error?.message) {
              setError(message.error.message)
              return
            }

            if (!message.params?.result) return

            const decoded = decodeLedgerLog(message.params.result)
            if (!decoded) return

            upsertMessages([decoded], true, session)
          } catch {
            setError('Received an unreadable live update from the node.')
          }
        }

        socket.onerror = () => {
          setError('WebSocket connection dropped. Polling fallback is active.')
        }

        socket.onclose = () => {
          socket = null
          subscriptionId = null

          if (disposed) return

          startPolling()
          scheduleReconnect()
        }
      } catch (connectionError) {
        setError(normalizeError(connectionError, 'Unable to connect to the live feed.'))
        startPolling()
        scheduleReconnect()
      }
    }

    void (async () => {
      try {
        latestSeenBlockRef.current = await getLatestBlockNumber()
        historyCursorRef.current = latestSeenBlockRef.current

        await loadMore()
        if (disposed || session !== sessionRef.current) return

        connectWebSocket()
      } catch (bootError) {
        if (disposed || session !== sessionRef.current) return

        setError(normalizeError(bootError, 'Unable to initialize The Ledger feed.'))
        setIsLoadingInitial(false)
        startPolling()
        scheduleReconnect()
      }
    })()

    return () => {
      disposed = true
      initializedAddressRef.current = null
      stopPolling()
      disconnectSocket()
      clearHighlights()

      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout)
      }
    }
  // The transport lifecycle is keyed to the contract address and readiness gate.
  // Deliberately excluding the helper functions prevents reconnect loops on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, initializationReady])

  return {
    messages,
    isLoadingInitial,
    isLoadingMore,
    hasMore,
    connectionMode,
    error,
    userPostCount,
    loadMore,
    ingestConfirmedTransaction,
  }
}

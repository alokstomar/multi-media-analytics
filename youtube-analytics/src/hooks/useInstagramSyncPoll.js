import { useEffect, useRef } from 'react'
import { getInstagramSyncStatus } from '../services/api'

const POLL_INTERVAL_MS = 3000
const MAX_ATTEMPTS = 20

/**
 * Polls sync status for any Instagram account currently in the "syncing"
 * state. Calls onStatusChange(username, status) the first time each account
 * reaches a terminal state ('ready' or 'error'). Re-fetching the accounts
 * list is the consumer's responsibility — typically triggered in onStatusChange.
 *
 * @param {Array<{username: string, syncStatus: string}>} accounts
 * @param {(username: string, status: {syncStatus: string, syncError: string, syncedAt: string}) => void} onStatusChange
 */
export function useInstagramSyncPoll(accounts, onStatusChange) {
  const attemptsRef = useRef({})

  useEffect(() => {
    const syncing = (accounts || []).filter((a) => a?.syncStatus === 'syncing' && a?.username)
    if (!syncing.length) {
      attemptsRef.current = {}
      return
    }

    let cancelled = false

    const tick = async () => {
      await Promise.all(
        syncing.map(async (acc) => {
          attemptsRef.current[acc.username] = (attemptsRef.current[acc.username] || 0) + 1
          try {
            const res = await getInstagramSyncStatus(acc.username)
            const data = res?.data
            if (!data) return
            if (data.syncStatus === 'ready' || data.syncStatus === 'error') {
              if (!cancelled) onStatusChange?.(acc.username, data)
              delete attemptsRef.current[acc.username]
            }
          } catch {
            // network blip — let next tick retry
          }
          if (attemptsRef.current[acc.username] >= MAX_ATTEMPTS) {
            delete attemptsRef.current[acc.username]
          }
        })
      )
    }

    tick()
    const id = setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [accounts, onStatusChange])
}

import { useState, useEffect, useCallback } from 'react'
import { getCompetitorOpportunities } from '../services/api'

export default function useCompetitorOpportunities(channelId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchOpportunities = useCallback(async () => {
    if (!channelId || channelId === 'demo' || channelId === 'demo_ig') {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await getCompetitorOpportunities(channelId)
      setData(result?.data || null)
    } catch (err) {
      console.error('Error fetching competitor opportunities:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [channelId])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  return {
    data,
    loading,
    error,
    refetch: fetchOpportunities
  }
}

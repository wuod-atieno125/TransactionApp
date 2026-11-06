import { useEffect } from 'react'

export default function useAutoDismiss(message, clearMessage, delay = 3500) {
  useEffect(() => {
    if (!message) return undefined

    const timeoutId = window.setTimeout(() => clearMessage(''), delay)
    return () => window.clearTimeout(timeoutId)
  }, [message, clearMessage, delay])
}

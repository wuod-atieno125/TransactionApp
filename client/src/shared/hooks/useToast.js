import { useCallback, useState } from 'react'

export default function useToast() {
  const [message, setMessage] = useState('')
  const notify = useCallback(text => {
    setMessage(text)
    window.clearTimeout(window.__gatherToastTimer)
    window.__gatherToastTimer = window.setTimeout(() => setMessage(''), 2500)
  }, [])
  return { message, notify }
}

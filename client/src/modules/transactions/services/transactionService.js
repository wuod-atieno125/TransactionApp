import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getTransactions(params = {}) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  }

  const suffix = query.toString() ? `?${query}` : ''
  const result = await apiRequest(`/welfare-contributions/contributions${suffix}`)

  return {
    transactions: Array.isArray(result.transactions)
      ? result.transactions
      : [],
    pagination: result.pagination ?? null,
  }
} 

export async function createTransaction(details) {
  const result = await apiRequest('/welfare-contributions/contributions', {
    method: 'POST',
    body: JSON.stringify(details),
  })

  return result.transaction || result.entry
}

export async function reverseTransaction(id, reason) {
  const result = await apiRequest(`/transactions/${encodeURIComponent(id)}/reverse`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  })

  return result
}

export async function getTransactionReversalRequests() {
  const result = await apiRequest('/transactions/reversal-requests')
  return Array.isArray(result.requests) ? result.requests : []
}

export async function decideTransactionReversal(requestId, decision, reason) {
  return apiRequest(`/transactions/reversal-requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, reason }),
  })
}

export async function getWeeklyGroupReport(weekStart) {
  const query = new URLSearchParams({ weekStart })
  const result = await apiRequest(`/transactions/weekly-report?${query}`)
  return result.weeklyReport
}

export async function getWeeklyMemberReport(weekStart) {
  const query = new URLSearchParams({ weekStart })
  const result = await apiRequest(`/transactions/weekly-report/members?${query}`)
  return result.weeklyReport
}

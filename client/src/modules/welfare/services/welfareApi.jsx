import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getRequirements() {
  const result = await apiRequest('/welfare-contributions/requirements')
  return result.requirements || []
}

export async function setRequirement(details) {
  const result = await apiRequest('/welfare-contributions/requirements', {
    method: 'PUT',
    body: JSON.stringify(details),
  })
  return result.requirement
}

export async function recordWelfareContribution(details) {
  const result = await apiRequest('/welfare-contributions/contributions', {
    method: 'POST',
    body: JSON.stringify(details),
  })
  return result.entry
}

export async function getWelfareStatement(memberId) {
  const result = await apiRequest(`/welfare-contributions/members/${encodeURIComponent(memberId)}/statement`)
  return result.statement
}

export async function getWelfareBalance() {
  const result = await apiRequest('/welfare-contributions/balance')
  return result.balance
}

export async function getWelfareWithdrawals() {
  const result = await apiRequest('/welfare-contributions/withdrawals')
  return result.withdrawals || []
}

export async function getWelfareWithdrawalExportData() {
  return apiRequest('/welfare-contributions/withdrawals/export')
}

export async function requestWelfareWithdrawal(details) {
  const result = await apiRequest('/welfare-contributions/withdrawals', {
    method: 'POST',
    body: JSON.stringify(details),
  })
  return result.request
}

export async function decideWelfareWithdrawal(id, approved, reason) {
  const result = await apiRequest(`/welfare-contributions/withdrawals/${encodeURIComponent(id)}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ approved, reason }),
  })
  return result.request
}

export async function executeWelfareWithdrawal(id) {
  const result = await apiRequest(`/welfare-contributions/withdrawals/${encodeURIComponent(id)}/execute`, {
    method: 'POST',
  })
  return result.request
}

export async function getWelfareSummary() {
  const result = await apiRequest('/transactions/summary/overview')
  return result.summary
}

export async function getWelfareReversalRequests() {
  const result = await apiRequest('/transactions/reversal-requests')
  return result.requests || []
}

export async function decideWelfareReversal(id, decision, reason) {
  return apiRequest(`/transactions/reversal-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, reason }),
  })
}

export async function getWelfareWeeklyReport(weekStart) {
  const query = new URLSearchParams({ weekStart })
  const result = await apiRequest(`/transactions/weekly-report?${query}`)
  return result.weeklyReport
}

export async function getWelfareMemberReport(weekStart) {
  const query = new URLSearchParams({ weekStart })
  const result = await apiRequest(`/transactions/weekly-report/members?${query}`)
  return result.weeklyReport
}

export async function getWelfareMonthlyReport(month) {
  const query = new URLSearchParams({ month })
  const result = await apiRequest(`/transactions/monthly-report?${query}`)
  return result.monthlyReport
}

export async function getWelfareMonthlyMemberReport(month) {
  const query = new URLSearchParams({ month })
  const result = await apiRequest(`/transactions/monthly-report/members?${query}`)
  return result.monthlyMemberReport
}

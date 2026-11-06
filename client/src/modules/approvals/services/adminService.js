import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getPendingMembers() {
  const result = await apiRequest('/admin/pending-members')
  return Array.isArray(result.members) ? result.members : []
}

export function approveMember(id) {
  return apiRequest(
    `/admin/members/${encodeURIComponent(id)}/approve`,
    { method: 'PATCH' },
  )
}

export function rejectMember(id) {
  return apiRequest(
    `/admin/members/${encodeURIComponent(id)}/reject`,
    { method: 'PATCH' },
  )
}

export async function getMemberDeletionRequests() {
  const result = await apiRequest('/admin/member-deletion-requests')
  return Array.isArray(result.deletionRequests) ? result.deletionRequests : []
}

export function decideMemberDeletion(id, decision, reason) {
  return apiRequest(
    `/admin/member-deletion-requests/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ decision, reason }),
    },
  )
}

export function deleteMemberAccount(id, reason) {
  return apiRequest(`/admin/members/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  })
}
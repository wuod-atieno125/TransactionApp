
import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getTechnicalAdminUsers() {
  const data = await apiRequest('/technical-admin/users')
  return data.users || []
}

export async function updateUserRole(userId, role) {
  return apiRequest(
    `/technical-admin/users/${encodeURIComponent(userId)}/role`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  )
}

export async function sendAppUpdateAnnouncement({ title, message }) {
  return apiRequest('/technical-admin/announcements', {
    method: 'POST',
    body: JSON.stringify({ title, message }),
  })
}

export async function getTechnicalAdminAuditLogs() {
  const data = await apiRequest('/technical-admin/audit-logs')
  return Array.isArray(data.auditLogs) ? data.auditLogs : []
}

export async function deleteTechnicalAdminAuditLogs() {
  return apiRequest('/technical-admin/audit-logs', {
    method: 'DELETE',
  })
}

export async function getRoleRemovalRequests() {
  const data = await apiRequest('/technical-admin/role-removal-requests')
  return Array.isArray(data.requests) ? data.requests : []
}

export async function decideRoleRemovalRequest(requestId, decision) {
  return apiRequest(`/technical-admin/role-removal-requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ decision }),
  })
}
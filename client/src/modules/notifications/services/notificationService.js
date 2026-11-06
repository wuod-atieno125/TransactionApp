import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getNotifications() {
  const result = await apiRequest('/notifications')

  if (Array.isArray(result.notifications)) {
    return result.notifications
  }

  if (Array.isArray(result.items)) return result.items

  return []
}

export async function getUnreadNotificationCount() {
  const result = await apiRequest('/notifications/unread-count')

  return Number(
    result.count ??
    result.unreadCount ??
    result.unread_count ??
    0,
  )
}

export async function markNotificationRead(id) {
  const result = await apiRequest(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
  )
  window.dispatchEvent(new Event('notifications:changed'))
  return result
}

export async function markAllNotificationsRead() {
  const result = await apiRequest('/notifications/read-all', {
    method: 'PATCH',
  })
  window.dispatchEvent(new Event('notifications:changed'))
  return result
}

export async function deleteNotification(id) {
  const result = await apiRequest(
    `/notifications/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  window.dispatchEvent(new Event('notifications:changed'))
  return result
}

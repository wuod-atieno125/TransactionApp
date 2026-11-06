import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getMeetingMinutes() {
  const result = await apiRequest('/meeting-minutes')

  if (Array.isArray(result.minutes)) return result.minutes
  if (Array.isArray(result.meetingMinutes)) return result.meetingMinutes
  if (Array.isArray(result.items)) return result.items

  return []
}

export function createMeetingMinutes(details) {
  return apiRequest('/meeting-minutes', {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export function updateMeetingMinutes(id, details) {
  return apiRequest(
    `/meeting-minutes/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(details),
    },
  )
}
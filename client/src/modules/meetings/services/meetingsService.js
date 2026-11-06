import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getMeetings() {
  const result = await apiRequest('/meetings')
  return Array.isArray(result.meetings) ? result.meetings : []
}

export function getNextMeeting() {
  return apiRequest('/meetings/next')
}

export function saveNextMeeting({ title, startsAt, description = '', location = null }) {
  return apiRequest('/meetings/next', {
    method: 'PUT',
    body: JSON.stringify({ title, startsAt, description, location }),
  })
}

export function deleteNextMeeting() {
  return apiRequest('/meetings/next', {
    method: 'DELETE',
  })
}

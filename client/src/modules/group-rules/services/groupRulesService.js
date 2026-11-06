import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getGroupRules() {
  return apiRequest('/group-rules')
}

export function saveGroupRules(rules) {
  return apiRequest('/group-rules', {
    method: 'POST',
    body: JSON.stringify({ content: rules }),
  })
}
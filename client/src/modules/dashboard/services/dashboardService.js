import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getDashboardOverview() {
  const result = await apiRequest('/dashboard/overview')
  return result
}

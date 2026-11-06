import { apiRequest } from '../../../shared/services/apiClient.js'

export async function getPaymentDestination() {
  const result = await apiRequest('/payment-destination')
  return result.paymentDestination
}

export async function savePaymentDestination(paymentNumber) {
  const result = await apiRequest('/payment-destination', {
    method: 'PUT',
    body: JSON.stringify({ paymentNumber }),
  })
  return result
}

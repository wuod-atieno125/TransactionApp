import { apiRequest } from './apiClient.js'

export async function sendEmailVerificationCode(email) {
  return apiRequest('/auth/email-verification/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function verifyEmailCode(email, code) {
  return apiRequest('/auth/email-verification/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}
export async function registerAccount(details) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export async function login(username, phone, password) {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, phone, password }),
  })

  return result.user
}

export async function changePassword(currentPassword, newPassword) {
  return apiRequest('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function requestPasswordReset(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}


export function verifyPasswordResetCode(email, code) {
  return apiRequest('/auth/reset-password/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

export function resetPassword(email, code, newPassword, username) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      email,
      code,
      newPassword,
      ...(username ? { username } : {}),
    }),
  })
}


export async function getCurrentUser() {
  const result = await apiRequest('/auth/me')
  return result.user
}

export async function logout() {
  return apiRequest('/auth/logout', { method: 'POST' })
}

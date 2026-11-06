import { apiBlob, apiRequest } from '../../../shared/services/apiClient.js'

export async function getMembers() {
  const result = await apiRequest('/members')
  return Array.isArray(result.members) ? result.members : []
}

export async function getMyAccount() {
  const result = await apiRequest('/members/me')
  return result.member
}

export async function updateMyAccount(details) {
  const result = await apiRequest('/members/me', {
    method: 'PATCH',
    body: JSON.stringify(details),
  })
  return result.member
}

export async function updateMyProfilePicture(file) {
  const formData = new FormData()
  formData.append('profilePicture', file)
  return apiRequest('/members/me/profile-picture', {
    method: 'PUT',
    body: formData,
  })
}

export async function getMyProfilePicture() {
  return apiBlob('/members/me/profile-picture', {
    cache: 'no-store',
  })
}

export async function getMyDeletionRequest() {
  const result = await apiRequest('/members/me/deletion-request')
  return result.deletionRequest
}

export async function requestAccountDeletion(reason) {
  return apiRequest('/members/me/deletion-request', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function getMyRoleRemovalRequest() {
  const result = await apiRequest('/members/me/role-removal-request')
  return result.roleRemovalRequest
}

export async function requestRoleRemoval(reason) {
  return apiRequest('/members/me/role-removal-request', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

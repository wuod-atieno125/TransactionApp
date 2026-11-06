import { useEffect, useState } from 'react'
import { getMyProfilePicture } from '../services/memberService.js'

function getInitials(name) {
  return name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
}

export default function ProfileAvatar({
  userId,
  name,
  profilePictureUpdatedAt,
  className = '',
}) {
  const [picture, setPicture] = useState(null)
  const initials = getInitials(name || 'Account')

  useEffect(() => {
    let active = true
    let objectUrl

    getMyProfilePicture()
      .then(blob => {
        if (!active || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setPicture({
          url: objectUrl,
          userId,
          updatedAt: profilePictureUpdatedAt || null,
        })
      })
      .catch(error => {
        console.error('Unable to load profile picture:', error)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [userId, profilePictureUpdatedAt])

  const imageUrl = picture?.userId === userId &&
    picture?.updatedAt === (profilePictureUpdatedAt || null)
    ? picture.url
    : null

  return (
    <span className={`avatar avatar-green profile-avatar ${className}`} aria-label={name || 'Account'}>
      {imageUrl
        ? <img src={imageUrl} alt="" />
        : initials}
    </span>
  )
}

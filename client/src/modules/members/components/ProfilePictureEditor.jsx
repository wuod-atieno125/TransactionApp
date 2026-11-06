import { useCallback, useEffect, useRef, useState } from 'react'
import ProfileAvatar from './ProfileAvatar.jsx'
import { updateMyProfilePicture } from '../services/memberService.js'

const MAX_FILE_SIZE = 2 * 1024 * 1024
const MAX_IMAGE_PIXELS = 25_000_000
const CROP_PREVIEW_SIZE = 260
const OUTPUT_SIZE = 512

function clampCropOffset(image, offset, size = CROP_PREVIEW_SIZE) {
  const scale = Math.max(size / image.width, size / image.height)
  const maxOffsetX = Math.max(0, (image.width * scale - size) / 2)
  const maxOffsetY = Math.max(0, (image.height * scale - size) / 2)

  return {
    x: Math.max(-maxOffsetX, Math.min(maxOffsetX, offset.x)),
    y: Math.max(-maxOffsetY, Math.min(maxOffsetY, offset.y)),
  }
}

function drawCrop(context, image, offsetX, offsetY, size) {
  const scale = Math.max(size / image.width, size / image.height)
  const width = image.width * scale
  const height = image.height * scale
  const offset = clampCropOffset(image, { x: offsetX, y: offsetY }, size)
  const left = (size - width) / 2 + offset.x
  const top = (size - height) / 2 + offset.y

  context.clearRect(0, 0, size, size)
  context.drawImage(
    image,
    0,
    0,
    image.width,
    image.height,
    left,
    top,
    width,
    height,
  )
}

function cropToJpeg(image, offsetX, offsetY) {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Your browser could not prepare the cropped image.')
  }

  drawCrop(context, image, offsetX, offsetY, OUTPUT_SIZE)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob
        ? resolve(blob)
        : reject(new Error('Your browser could not create the cropped image.')),
      'image/jpeg',
      0.9,
    )
  })
}

export default function ProfilePictureEditor({ account, onUpdated }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const previewCanvas = useRef(null)
  const imageRef = useRef(null)
  const dragRef = useRef(null)

  const renderPreview = useCallback((image, offset) => {
    const context = previewCanvas.current?.getContext('2d')
    if (context) {
      drawCrop(
        context,
        image,
        offset.x,
        offset.y,
        CROP_PREVIEW_SIZE,
      )
    }
  }, [])

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setSuccess('')

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setSelectedFile(null)
      setError('Choose a JPEG or PNG image.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null)
      setError('Profile pictures must be 2 MB or smaller.')
      event.target.value = ''
      return
    }

    setPreparing(true)
    try {
      const image = await createImageBitmap(file)
      const isTooLarge = image.width * image.height > MAX_IMAGE_PIXELS
      image.close()
      if (isTooLarge) {
        setSelectedFile(null)
        setError('The image dimensions are too large. Choose an image under 25 megapixels.')
        event.target.value = ''
        return
      }
      setCropOffset({ x: 0, y: 0 })
      setSelectedFile(file)
      event.target.value = ''
    } catch {
      setSelectedFile(null)
      setError('This image is corrupt or cannot be opened.')
      event.target.value = ''
    } finally {
      setPreparing(false)
    }
  }

  useEffect(() => {
    if (!selectedFile) return undefined
    let active = true

    createImageBitmap(selectedFile)
      .then(image => {
        if (!active) {
          image.close()
          return
        }
        imageRef.current = image
        const canvas = previewCanvas.current
        if (canvas) {
          canvas.width = CROP_PREVIEW_SIZE
          canvas.height = CROP_PREVIEW_SIZE
          renderPreview(image, { x: 0, y: 0 })
        }
      })
      .catch(() => {
        if (active) setError('This image is corrupt or cannot be opened.')
      })

    return () => {
      active = false
      imageRef.current?.close()
      imageRef.current = null
    }
  }, [selectedFile, renderPreview])

  useEffect(() => {
    if (imageRef.current) renderPreview(imageRef.current, cropOffset)
  }, [cropOffset, renderPreview])

  function handlePointerDown(event) {
    if (!imageRef.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset: cropOffset,
    }
  }

  function handlePointerMove(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const scale = CROP_PREVIEW_SIZE / bounds.width
    setCropOffset(clampCropOffset(imageRef.current, {
      x: drag.offset.x + (event.clientX - drag.startX) * scale,
      y: drag.offset.y + (event.clientY - drag.startY) * scale,
    }))
  }

  function handlePointerUp(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleCropKeyDown(event) {
    if (!imageRef.current) return

    const step = event.shiftKey ? 20 : 5
    const movement = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }[event.key]

    if (!movement) return
    event.preventDefault()
    setCropOffset(current => clampCropOffset(imageRef.current, {
      x: current.x + movement.x,
      y: current.y + movement.y,
    }))
  }

  async function handleSave() {
    if (!selectedFile) return

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const image = await createImageBitmap(selectedFile)
      let croppedImage
      try {
        const outputScale = OUTPUT_SIZE / CROP_PREVIEW_SIZE
        croppedImage = await cropToJpeg(
          image,
          cropOffset.x * outputScale,
          cropOffset.y * outputScale,
        )
      } finally {
        image.close()
      }
      const result = await updateMyProfilePicture(croppedImage)
      onUpdated?.(result.profilePictureUpdatedAt)
      setSelectedFile(null)
      setCropOffset({ x: 0, y: 0 })
      setSuccess(result.message || 'Profile picture updated.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to update your profile picture.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="profile-picture-editor" aria-labelledby="profile-picture-title">
      <div className="account-card-heading">
        <div>
          <h2 id="profile-picture-title">Profile picture</h2>
          <p>Choose a JPEG or PNG up to 2 MB, then drag the preview to frame your picture.</p>
        </div>
      </div>

      {error && <p className="app-error" role="alert">{error}</p>}
      {success && <p className="account-success" role="status">{success}</p>}
      {preparing && <p className="password-change-hint" role="status">Preparing image preview…</p>}

      <div className="profile-picture-controls">
        <ProfileAvatar
          userId={account.id}
          name={account.fullName}
          profilePictureUpdatedAt={account.profilePictureUpdatedAt}
          className="profile-picture-current"
        />
        <label className="profile-picture-file">
          Choose image
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            aria-label="Choose a JPEG or PNG profile picture"
          />
        </label>
      </div>

      {selectedFile && (
        <div className="profile-picture-cropper">
          <canvas
            ref={previewCanvas}
            className="profile-crop-preview"
            aria-label="Square crop preview. Drag to reposition or use the arrow keys."
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleCropKeyDown}
          />
          <button
            className="primary-button"
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving picture…' : 'Save profile picture'}
          </button>
        </div>
      )}
    </section>
  )
}

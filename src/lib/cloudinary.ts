/**
 * Cloudinary photo uploads for the Кахут question bank.
 *
 * Deliberately not Firebase Storage: that service requires a linked billing
 * account (Blaze) even to stay inside its own free tier, which means a real
 * card on file. Cloudinary's free tier needs no card at all — an unsigned
 * upload preset lets the browser upload directly with no secret key exposed,
 * and if the free tier is ever exceeded, new uploads simply fail rather than
 * becoming a bill (see `uploadQuestionPhoto` in `src/lib/kahoot.ts`, whose
 * caller already treats a failed upload as "this question has no photo").
 *
 * Configured the same way Firebase is in `firebase.ts`: two `VITE_*` env vars,
 * and every export degrades to a no-op when they're missing instead of
 * throwing, so the app runs with the Кахут photo picker simply doing nothing.
 */
const env = import.meta.env

const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET

/** True only when both values are present and non-blank. */
export const isCloudinaryConfigured =
  typeof cloudName === 'string' &&
  cloudName.trim() !== '' &&
  typeof uploadPreset === 'string' &&
  uploadPreset.trim() !== ''

/**
 * Uploads one image and returns its public URL, or `null` when it could not
 * be uploaded — missing config, a network failure, or Cloudinary refusing the
 * request all collapse to the same outcome, since every caller already treats
 * "no photo" as a normal, publishable state.
 */
export async function uploadImage(file: File): Promise<string | null> {
  if (!isCloudinaryConfigured) return null
  try {
    const body = new FormData()
    body.append('file', file)
    body.append('upload_preset', uploadPreset)

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body },
    )
    if (!response.ok) return null

    const data = (await response.json()) as { secure_url?: unknown }
    return typeof data.secure_url === 'string' ? data.secure_url : null
  } catch (error) {
    console.warn('[tarihhub] Could not upload the image.', error)
    return null
  }
}

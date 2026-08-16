/** One completed description for an image. */
export interface RecentDescription {
  time: number
  description: string
}

/** One image group in the recent panel, newest-updated image first. */
export interface RecentEntry {
  attachmentId: string
  sessionId?: string
  updatedAt: number
  descriptions: RecentDescription[]
}

/** Input produced by one completed automatic or explicit vision call. */
export interface RecentDescriptionInput {
  time: number
  attachmentId: string
  sessionId?: string
  description: string
}

/**
 * Retain a completed description under its image group, keyed by
 * `(sessionId, attachmentId)` so each conversation's history is isolated.
 *
 * Re-describing an image moves that group to the front, exposes the new answer
 * as its latest description, and retains the older intent-specific answers in
 * that same group. Both image groups and per-image descriptions are bounded;
 * a `null` per-image limit keeps the history unbounded.
 */
export function recordRecent(
  recent: RecentEntry[],
  entry: RecentDescriptionInput,
  maxImages: number,
  maxDescriptionsPerImage: number | null,
): void {
  const existingIndex = recent.findIndex(item =>
    item.attachmentId === entry.attachmentId && item.sessionId === entry.sessionId,
  )
  const existing = existingIndex < 0 ? undefined : recent[existingIndex]
  if (existingIndex >= 0) recent.splice(existingIndex, 1)

  const descriptions = existing?.descriptions ?? []
  descriptions.unshift({ time: entry.time, description: entry.description })
  if (maxDescriptionsPerImage !== null && descriptions.length > maxDescriptionsPerImage) {
    descriptions.length = maxDescriptionsPerImage
  }

  const sessionId = entry.sessionId ?? existing?.sessionId
  recent.unshift({
    attachmentId: entry.attachmentId,
    updatedAt: entry.time,
    descriptions,
    ...(sessionId === undefined ? {} : { sessionId }),
  })
  if (recent.length > maxImages) recent.length = maxImages
}

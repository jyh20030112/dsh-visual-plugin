interface EventLike {
  type?: string
  data?: Record<string, unknown>
}

/** Whether a tool call belongs to the turn that first admitted an attachment. */
export function isSameTurnAttachmentToolCall(
  events: readonly unknown[],
  attachmentId: string,
  callId: string,
): boolean {
  let activeTurn: number | undefined
  let attachmentTurn: number | undefined
  let callTurn: number | undefined
  for (const unknownEvent of events) {
    const event = unknownEvent as EventLike
    const data = event.data
    if (event.type === 'step/start' && typeof data?.turn === 'number') {
      activeTurn = data.turn
      continue
    }
    if (event.type === 'step/end' && data?.turn === activeTurn) {
      activeTurn = undefined
      continue
    }
    if (event.type === 'user/message' && activeTurn !== undefined) {
      const content = data?.content
      if (Array.isArray(content) && content.some((block) => {
        const value = block as { type?: unknown; attachment?: { attachmentId?: unknown } }
        return value.type === 'image' && String(value.attachment?.attachmentId) === attachmentId
      })) attachmentTurn = activeTurn
      continue
    }
    if (event.type === 'tool/call' && String(data?.callId) === callId && typeof data?.turn === 'number') {
      callTurn = data.turn
    }
  }
  return attachmentTurn !== undefined && attachmentTurn === callTurn
}

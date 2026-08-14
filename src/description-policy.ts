import type { VisionDescribeResult } from './vision.ts'

/** Build an intent-first prompt that treats OCR as supporting detail. */
export function visionPromptFor(userText: string): string {
  const intent = userText.trim().length === 0
    ? '用户没有附加问题，请概括图片的主要内容。'
    : `用户针对这张图片提出的问题：${userText.trim()}`
  return `${intent}\n`
    + '请直接回答用户问题，并先说明图片中的主要物体、人物或场景，以及相关动作和用途。'
    + '不要只回答图片中是否有文字；如果存在可读文字，再在内容说明后完整列出。'
}

/** Whether a nominally successful answer carries no useful visual content. */
export function isLowInformationDescription(description: string): boolean {
  const text = description.trim().replace(/\s+/g, ' ')
  if (text.length === 0) return true
  return [
    /^(?:图片|图像|画面)?中?(?:没有|未发现|看不到|不包含).*?(?:文字|文本)[。.!]?$/,
    /^(?:无法|不能)(?:识别|判断|看清|描述).*?[。.!]?$/,
    /^(?:there (?:is|are)|the image (?:has|contains)) no (?:visible )?text[.!]?$/i,
    /^(?:unable|cannot) to (?:identify|determine|describe).*?[.!]?$/i,
  ].some(pattern => pattern.test(text))
}

/** Run one vision request and retry once when it returns an OCR-only non-answer. */
export async function describeWithLowInformationRetry(
  run: (prompt: string) => Promise<VisionDescribeResult>,
  userText: string,
): Promise<VisionDescribeResult> {
  const prompt = visionPromptFor(userText)
  const first = await run(prompt)
  if (!isLowInformationDescription(first.description)) return first
  return run(`${prompt}\n上一次回答信息不足，只说明了是否存在文字。请重新分析整张图片并直接回答用户问题。`)
}

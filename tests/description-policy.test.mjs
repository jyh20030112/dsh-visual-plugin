import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeWithLowInformationRetry,
  isLowInformationDescription,
  visionPromptFor,
} from '../src/description-policy.ts'

test('vision prompt prioritizes answering the user over OCR', () => {
  const prompt = visionPromptFor('这是什么？')

  assert.match(prompt, /直接回答用户问题/)
  assert.match(prompt, /主要物体、人物或场景/)
  assert.match(prompt, /不要只回答图片中是否有文字/)
})

test('retries one low-information OCR-only answer with a stronger prompt', async () => {
  const prompts = []
  const result = await describeWithLowInformationRetry(async (prompt) => {
    prompts.push(prompt)
    return prompts.length === 1
      ? { description: '图片中没有任何文字。' }
      : { description: '这是一幅描绘山丘城堡、牛羊和马车的古典风景画。' }
  }, '这是什么？')

  assert.equal(prompts.length, 2)
  assert.match(prompts[1], /上一次回答信息不足/)
  assert.equal(result.description, '这是一幅描绘山丘城堡、牛羊和马车的古典风景画。')
})

test('accepts an informative first description without retrying', async () => {
  let calls = 0
  const result = await describeWithLowInformationRetry(async () => {
    calls += 1
    return { description: '画面是一只白色鲸鱼形状的图标。' }
  }, '这是什么？')

  assert.equal(calls, 1)
  assert.equal(isLowInformationDescription(result.description), false)
})

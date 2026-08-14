/** `vision-bridge` namespace dictionaries (the vision bridge panel's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'panel.title': '视觉桥接',
  'panel.hint': '主模型无视觉能力时，将图片转发到已配置的视觉模型进行描述。',
  'field.url': '接口地址',
  'field.url.placeholder': 'https://api.deepseek.com',
  'field.model': '模型名称',
  'field.model.placeholder': 'glm-4v-flash',
  'field.apiKey': 'API Key',
  'field.apiKey.placeholder': '仅填写一次，保存后不再回显',
  'action.save': '保存配置',
  'action.test': '测试连接',
  'action.refresh': '刷新',
  'status.saved': '已保存',
  'status.notConfigured': '未配置视觉模型',
  'status.configured': '已配置',
  'status.testing': '测试中…',
  'status.testOk': '连接成功（{latency} ms）',
  'status.testFail': '连接失败：{message}',
  'status.keyConfigured': 'API Key 已配置',
  'status.keyMissing': 'API Key 未配置',
  'balance.title': '剩余额度',
  'balance.unsupported': '该服务暂不提供额度查询',
  'balance.unavailable': '额度查询失败：{message}',
  'balance.line': '{currency} 可用 {available}（总额 {total}）',
  'history.title': '最近描述',
  'history.empty': '暂无图片描述记录',
  'history.attachments': '附件 {id}',
}

/** The vision-bridge namespace key union. */
export type VisionBridgeKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en: Record<VisionBridgeKey, string> = {
  'panel.title': 'Vision Bridge',
  'panel.hint': 'When the main model has no vision, forward images to the configured vision model for description.',
  'field.url': 'Endpoint URL',
  'field.url.placeholder': 'https://api.deepseek.com',
  'field.model': 'Model name',
  'field.model.placeholder': 'glm-4v-flash',
  'field.apiKey': 'API Key',
  'field.apiKey.placeholder': 'Enter once; never echoed after saving',
  'action.save': 'Save',
  'action.test': 'Test connection',
  'action.refresh': 'Refresh',
  'status.saved': 'Saved',
  'status.notConfigured': 'Vision model not configured',
  'status.configured': 'Configured',
  'status.testing': 'Testing…',
  'status.testOk': 'Connected ({latency} ms)',
  'status.testFail': 'Connection failed: {message}',
  'status.keyConfigured': 'API Key configured',
  'status.keyMissing': 'API Key not configured',
  'balance.title': 'Remaining balance',
  'balance.unsupported': 'Balance query is not supported by this service',
  'balance.unavailable': 'Balance query failed: {message}',
  'balance.line': '{currency} available {available} of {total}',
  'history.title': 'Recent descriptions',
  'history.empty': 'No image descriptions yet',
  'history.attachments': 'Attachment {id}',
}

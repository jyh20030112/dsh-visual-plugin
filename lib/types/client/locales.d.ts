/** `vision-bridge` namespace dictionaries (the vision bridge panel's copy). */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'panel.title': string;
    'panel.hint': string;
    'field.url': string;
    'field.url.placeholder': string;
    'field.model': string;
    'field.model.placeholder': string;
    'field.apiKey': string;
    'field.apiKey.placeholder': string;
    'action.save': string;
    'action.test': string;
    'action.refresh': string;
    'status.saved': string;
    'status.notConfigured': string;
    'status.configured': string;
    'status.testing': string;
    'status.describing': string;
    'status.describeFail': string;
    'status.interrupted': string;
    'status.testOk': string;
    'status.testFail': string;
    'status.keyConfigured': string;
    'status.keyMissing': string;
    'balance.title': string;
    'balance.unsupported': string;
    'balance.unavailable': string;
    'balance.line': string;
    'history.title': string;
    'history.empty': string;
    'history.attachments': string;
};
/** The vision-bridge namespace key union. */
export type VisionBridgeKey = keyof typeof zh;
/** English dictionary, checked complete against the zh key set. */
export declare const en: Record<VisionBridgeKey, string>;

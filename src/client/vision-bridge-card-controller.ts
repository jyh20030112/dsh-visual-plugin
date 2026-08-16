/**
 * The vision-bridge settings card's staged form. Unlike the harness's shipped
 * plugin cards, the `vision-bridge` settings namespace is NOT on the settings
 * web gateway's allowlist, so the card cannot bind it through `settingsScope`
 * (it would read `settings-not-exposed` forever). It instead reads and writes
 * the bridge config through the same-origin `/vision-bridge/config` route the
 * Host exposes: `url`/`model`/`historyLimit` are settings-section values,
 * `apiKey` is a write-only credential the Host stores through the credentials
 * seam.
 * @module dsh-visual-plugin/client/vision-bridge-card-controller
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import {
  VisionBridgeForm,
  type VisionBridgeField, type VisionBridgeSection,
} from './vision-bridge-form.ts'

/** What the card renders. */
export interface VisionBridgeCardState {
  available: boolean
  writable: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
  failed: boolean
  url: string
  model: string
  apiKey: string
  historyLimit: string
  apiKeyConfigured: boolean
}

/** The write actions the card's slot entry injects. */
export interface VisionBridgeCardActions {
  edit(field: VisionBridgeField, text: string): void
  discard(): void
  save(): void
}

/** The registration-side face the card's slot entry injects. */
export interface VisionBridgeCardFace extends VisionBridgeCardActions {
  hooks: {
    visionBridgeCard: SnapshotStore<VisionBridgeCardState>
  }
}

/** The `/vision-bridge/config` response envelope the Host returns. */
interface ConfigEnvelope {
  ok?: boolean
  config?: { url: string; model: string; historyLimit?: number | null; keyConfigured: boolean }
}

/** Bridges the same-origin config route onto the card's staged form. */
export class VisionBridgeCardController {
  private readonly form = new VisionBridgeForm()
  private readonly store: SnapshotStore<VisionBridgeCardState>
  private section: VisionBridgeSection = { url: '', model: '' }
  private apiKeyConfigured = false
  private available = false
  private saving = false
  private failed = false

  constructor() {
    this.store = createSnapshotStore(this.projection())
    void this.load()
  }

  private projection(): VisionBridgeCardState {
    const plan = this.form.plan(this.section)
    return {
      available: this.available,
      writable: true,
      dirty: plan.dirty,
      invalid: plan.invalid,
      saving: this.saving,
      failed: this.failed,
      url: this.form.text('url', this.section),
      model: this.form.text('model', this.section),
      apiKey: this.form.text('apiKey', this.section),
      historyLimit: this.form.text('historyLimit', this.section),
      apiKeyConfigured: this.apiKeyConfigured,
    }
  }

  /** Load the stored config and key state from the host config route. */
  private async load(): Promise<void> {
    try {
      const response = await fetch('/vision-bridge/config')
      const body = await response.json() as ConfigEnvelope
      if (body.ok !== true || body.config === undefined) return
      this.section = {
        url: body.config.url ?? '',
        model: body.config.model ?? '',
        historyLimit: body.config.historyLimit,
      }
      this.apiKeyConfigured = body.config.keyConfigured ?? false
      this.available = true
      this.publish()
    } catch {
      // Config route unavailable (host half absent) — leave the form empty.
    }
  }

  /** Build the card's face for the slot registration. */
  inject(): VisionBridgeCardFace {
    return {
      hooks: { visionBridgeCard: this.store },
      edit: (field, text) => {
        this.form.edit(field, text)
        this.failed = false
        this.publish()
      },
      discard: () => {
        this.form.discard()
        this.failed = false
        this.publish()
      },
      save: () => { void this.save() },
    }
  }

  /**
   * Write every staged edit through the host config route, then re-seed from
   * what the Host accepted. A save that did not land keeps its drafts so the
   * user can correct them.
   */
  private async save(): Promise<void> {
    const plan = this.form.plan(this.section)
    if (!plan.dirty || plan.invalid || this.saving) return
    this.saving = true
    this.failed = false
    this.publish()
    const url = this.form.text('url', this.section)
    const model = this.form.text('model', this.section)
    const apiKey = this.form.text('apiKey', this.section)
    const limitText = this.form.text('historyLimit', this.section).trim()
    const historyLimit = limitText === '' ? null : Number(limitText)
    try {
      const response = await fetch('/vision-bridge/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, model, apiKey, historyLimit }),
      })
      const body = await response.json() as ConfigEnvelope
      if (body.ok === true) {
        this.form.discard()
        this.section = { url, model, historyLimit }
        this.apiKeyConfigured = body.config?.keyConfigured ?? this.apiKeyConfigured
      } else {
        this.failed = true
      }
    } catch {
      this.failed = true
    }
    this.saving = false
    this.publish()
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}

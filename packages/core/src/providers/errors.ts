/**
 * Typed errors that the model providers and the managed-provider gate raise.
 * The renderer maps these to friendly UI messages — see
 * apps/desktop/src/renderer/src/pages/Providers.tsx.
 */

export class MissingApiKeyError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly envVar: string,
  ) {
    super(
      `API key missing for ${providerId} (set ${envVar} in the environment or configure it under Settings → AI Provider).`,
    )
    this.name = 'MissingApiKeyError'
  }
}

export class CloudNotApprovedError extends Error {
  constructor(public readonly providerId: string) {
    super(
      `Cloud provider "${providerId}" requires explicit user approval before any network call.`,
    )
    this.name = 'CloudNotApprovedError'
  }
}

export class LocalOnlyModeBlockedError extends Error {
  constructor(public readonly providerId: string) {
    super(
      `Local-only mode is on — disable it under Settings → AI Provider before using "${providerId}".`,
    )
    this.name = 'LocalOnlyModeBlockedError'
  }
}

export class ProviderHttpError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly status: number,
    public readonly bodySnippet: string,
  ) {
    super(`${providerId} HTTP ${status}: ${bodySnippet}`)
    this.name = 'ProviderHttpError'
  }
}

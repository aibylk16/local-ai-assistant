export interface BrowserAction {
  kind: 'navigate' | 'click' | 'type' | 'scrape'
  url?: string
  selector?: string
  value?: string
}

export interface BrowserConnector {
  id: 'browser.playwright'
  label: string
  ready(): Promise<boolean>
  run(actions: BrowserAction[]): Promise<{ ok: boolean; output?: unknown; error?: string }>
}

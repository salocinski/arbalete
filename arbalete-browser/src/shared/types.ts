export type BrowserTab = {
  id: string
  title: string
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  favicon?: string
}

export type BrowserState = {
  tabs: BrowserTab[]
  activeTabId: string | null
}

export type BrowserAPI = {
  getState: () => Promise<BrowserState>
  createTab: (url?: string) => Promise<string>
  closeTab: (id: string) => Promise<void>
  activateTab: (id: string) => Promise<void>
  navigate: (url: string) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  reload: () => Promise<void>
  setContentBounds: (bounds: { x: number; y: number; width: number; height: number }) => void
  getSystemTheme: () => Promise<'dark' | 'light'>
  onSystemTheme: (callback: (theme: 'dark' | 'light') => void) => () => void
  onState: (callback: (state: BrowserState) => void) => () => void
}

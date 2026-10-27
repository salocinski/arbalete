/// <reference types="vite/client" />
import type { BrowserAPI } from '../../shared/types'

declare global {
  interface Window {
    arbalete: BrowserAPI
  }
}
export {}

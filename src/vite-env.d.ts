/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the demo Worker, e.g. https://paperterminal-demo-api.example.com */
  readonly VITE_DEMO_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

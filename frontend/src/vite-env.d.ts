/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_PRINT_MODE?: string;
  readonly VITE_DEVICE_BRIDGE_URL?: string;
  readonly VITE_IDLE_TIMEOUT_SEC?: string;
  readonly VITE_IDLE_WARNING_SEC?: string;
  readonly VITE_TTS_ENABLED?: string;
  readonly VITE_DEFAULT_LANG?: string;
  readonly VITE_KIOSK_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

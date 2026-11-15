import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/plus-jakarta-sans/vietnamese-400.css'
import '@fontsource/plus-jakarta-sans/vietnamese-600.css'
import '@fontsource/plus-jakarta-sans/vietnamese-700.css'
import './offline/pwa'
import './index.css'
import NativeAppBridge from './components/NativeAppBridge.jsx'
import App from './App.jsx'
import { startSyncRuntime } from './sync/compositionRoot'
import SyncFeedback from './sync/presentation/SyncFeedback'
import './sync/presentation/sync.css'

startSyncRuntime();

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <BrowserRouter>
        <NativeAppBridge />
        <ToastProvider>
          <AuthProvider>
            <SyncFeedback />
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
  </StrictMode>,
)

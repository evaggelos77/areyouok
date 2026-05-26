import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/inter/latin.css';
import './styles/globals.css';
import { registerServiceWorker } from './registerSW';
import { initInstallPromptCapture } from './lib/installPrompt';
import { AuthProvider } from './contexts/AuthContext';
import { PrefsProvider } from './contexts/PrefsContext';
import { ToastProvider } from './contexts/ToastContext';
import { VoiceAssistProvider } from './contexts/VoiceAssistContext';
import App from './App';

registerServiceWorker();
initInstallPromptCapture();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PrefsProvider>
        <ToastProvider>
          <VoiceAssistProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </VoiceAssistProvider>
        </ToastProvider>
      </PrefsProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import '@/main.css';
import 'streamdown/styles.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/core/components/App';
import { initLogs } from '@tiny-chat/shared/src/logs.ts';
import { useLogs } from '@/stores/logs.tsx';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/api';

initLogs(useLogs.getState().writeLog, false);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

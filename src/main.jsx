import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { TrainingProvider } from './app/TrainingProvider';
import App from './app/App';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <TrainingProvider>
        <App />
      </TrainingProvider>
    </HashRouter>
  </React.StrictMode>,
);

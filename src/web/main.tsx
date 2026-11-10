import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../app/App.tsx';
import '../app/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application mount point');
createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);

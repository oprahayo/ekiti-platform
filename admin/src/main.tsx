import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './AdminApp.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Admin root missing');
createRoot(root).render(<React.StrictMode><AdminApp /></React.StrictMode>);

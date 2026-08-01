// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
/// <reference lib="DOM" />
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { MedplumProvider } from '@medplum/react';
import '@medplum/react/styles.css';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { App } from './App';
import { BoardPage } from './pages/BoardPage';
import { PreopDetailPage } from './pages/PreopDetailPage';
import { PreviewPage } from './pages/PreviewPage';
import { RecoveryDetailPage } from './pages/RecoveryDetailPage';
import { connect, medplum } from './lib/session';
import './theme.css';

const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));
/** Mantine only backs the Medplum sign-in form; everything else is our own CSS. */
const theme = createTheme({
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
});

const container = document.getElementById('root') as HTMLDivElement;
const root = createRoot(container);

const router = createBrowserRouter([
  { path: '/', element: <Suspense fallback={<div className="landing-loading">Loading CareOrbit…</div>}><LandingPage /></Suspense> },
  // Outside the App layout on purpose: no MedplumProvider profile needed, so the
  // visual harness renders without a session.
  { path: '/preview', element: <PreviewPage /> },
  {
    element: <App />,
    children: [
      { path: 'dashboard', element: <BoardPage /> },
      { path: 'preop', element: <BoardPage view="preop" /> },
      { path: 'preop/:patientId', element: <PreopDetailPage /> },
      { path: 'recovery', element: <BoardPage view="recovery" /> },
      { path: 'recovery/:patientId', element: <RecoveryDetailPage /> },
      { path: '*', element: <BoardPage /> },
    ],
  },
]);

// The app authenticates itself with the project's ClientApplication before first render.
// This puts the client secret in the browser bundle — fine for a local demo on synthetic
// data, not how this would ship.
await connect();

root.render(
  <StrictMode>
    <MedplumProvider medplum={medplum} navigate={router.navigate}>
      {/* "auto" keeps the Mantine-rendered sign-in card on the same side of
          light/dark as our own tokens — otherwise white text lands on a white card. */}
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <RouterProvider router={router} />
      </MantineProvider>
    </MedplumProvider>
  </StrictMode>
);

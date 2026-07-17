/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { RecipeDetail } from './pages/RecipeDetail';
import { Toaster } from './components/ui/Toaster';

const CreateRecipe = lazy(() => import('./pages/CreateRecipe').then(m => ({ default: m.CreateRecipe })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));

const PageFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" role="status" aria-label="טוען עמוד" />
  </div>
);

function AppRoutes() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]" role="status" aria-label="טוען את RecipeHub">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" aria-hidden="true" />
          <p className="font-serif italic text-stone-500">טוען את RecipeHub...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/create" element={<ProtectedRoute><CreateRecipe /></ProtectedRoute>} />
        <Route path="/edit/:id" element={<ProtectedRoute><CreateRecipe /></ProtectedRoute>} />
        <Route path="/profile/:userId?" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-primary-100 selection:text-primary-900 font-sans transition-colors duration-300" dir="rtl">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 py-8">
              <AppRoutes />
            </main>
            <Toaster />
          </div>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

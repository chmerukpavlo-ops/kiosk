import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/admin/Dashboard';
import { Products } from './pages/admin/Products';
import { Sales } from './pages/admin/Sales';
import { Kiosks } from './pages/admin/Kiosks';
import { Employees } from './pages/admin/Employees';
import { EmployeeProfile } from './pages/admin/EmployeeProfile';
import { Schedule } from './pages/admin/Schedule';
import { Expenses } from './pages/admin/Expenses';
import { Stock } from './pages/admin/Stock';
import { Inventory } from './pages/admin/Inventory';
import { Customers } from './pages/admin/Customers';
import { SellerDashboard } from './pages/seller/Dashboard';
import { Gamification } from './pages/seller/Gamification';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              {user?.role === 'admin' ? <AdminDashboard /> : <SellerDashboard />}
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/products"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Products />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Sales />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/kiosks"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Kiosks />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Employees />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees/:id"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <EmployeeProfile />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Schedule />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Expenses />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Stock />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Inventory />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Customers />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      {/* Seller routes */}
      <Route
        path="/gamification"
        element={
          <ProtectedRoute>
            <Layout>
              <Gamification />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  // Check for critical errors on mount
  useEffect(() => {
    console.log('📱 App component mounted');
    if (!import.meta.env.VITE_API_URL && !import.meta.env.DEV) {
      console.error('⚠️ VITE_API_URL не встановлено! Перевірте Environment Variables в Vercel.');
    } else {
      console.log('✅ VITE_API_URL:', import.meta.env.VITE_API_URL || 'using /api (dev mode)');
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <ErrorBoundary>
              <AppRoutes />
              <ToastContainer />
              <PWAInstallPrompt />
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

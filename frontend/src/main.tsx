import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard as AdminDashboard } from './pages/admin/Dashboard';
import { Products } from './pages/admin/Products';
import { Sales } from './pages/admin/Sales';
import { Employees } from './pages/admin/Employees';
import { Customers } from './pages/admin/Customers';
import { Kiosks } from './pages/admin/Kiosks';
import { Schedule } from './pages/admin/Schedule';
import { Expenses } from './pages/admin/Expenses';
import { Inventory } from './pages/admin/Inventory';
import { Stock } from './pages/admin/Stock';
import { Promotions } from './pages/admin/Promotions';
import { Analytics } from './pages/admin/Analytics';
import { TelegramSettings } from './pages/admin/TelegramSettings';
import { Dashboard as SellerDashboard } from './pages/seller/Dashboard';
import { Gamification } from './pages/seller/Gamification';
import { SellerStats } from './pages/seller/SellerStats';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SellerDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
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
              path="/customers"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <Customers />
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
              path="/promotions"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <Promotions />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <Analytics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/telegram"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TelegramSettings />
                  </Layout>
                </ProtectedRoute>
              }
            />
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
            <Route
              path="/seller-stats"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SellerStats />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);


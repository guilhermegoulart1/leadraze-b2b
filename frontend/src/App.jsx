import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BillingProvider } from './contexts/BillingContext';

// Páginas
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import AuthErrorPage from './pages/AuthErrorPage';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import GoogleMapsSearchPage from './pages/GoogleMapsSearchPage';
import GoogleMapsAgentsPage from './pages/GoogleMapsAgentsPage';
import CampaignsPage from './pages/CampaignsPage';
import LeadsPage from './pages/LeadsPage';
import ContactsPage from './pages/ContactsPage';
import ConversationsPage from './pages/ConversationsPage';
import AIAgentsPage from './pages/AIAgentsPage';
import AgentsPage from './pages/AgentsPage';
import InsightsPage from './pages/InsightsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import LinkedInAccountsPage from './pages/LinkedInAccountsPage';
import UsersPage from './pages/UsersPage';
import PermissionsPage from './pages/PermissionsPage';
import SectorsPage from './pages/SectorsPage';
import ActivationAgentsPage from './pages/ActivationAgentsPage';
import ActivationCampaignsPage from './pages/ActivationCampaignsPage';
import ContactListsPage from './pages/ContactListsPage';
import PricingPage from './pages/PricingPage';
import BillingPage from './pages/BillingPage';

// Layout
import Layout from './components/Layout';
import SubscriptionBlockOverlay from './components/SubscriptionBlockOverlay';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Rotas públicas */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/auth/error" element={<AuthErrorPage />} />

      {/* Pricing - acessível para todos */}
      <Route path="/pricing" element={<PricingPage />} />

      {/* Rotas protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <SubscriptionBlockOverlay>
              <Layout />
            </SubscriptionBlockOverlay>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="google-maps-search" element={<GoogleMapsSearchPage />} />
        <Route path="google-maps-agents" element={<GoogleMapsAgentsPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="conversations" element={<ConversationsPage />} />
        <Route path="ai-agents" element={<AIAgentsPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="linkedin-accounts" element={<LinkedInAccountsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="sectors" element={<SectorsPage />} />
        <Route path="activation-agents" element={<ActivationAgentsPage />} />
        <Route path="activation-campaigns" element={<ActivationCampaignsPage />} />
        <Route path="contact-lists" element={<ContactListsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <BillingProvider>
          <AppRoutes />
        </BillingProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
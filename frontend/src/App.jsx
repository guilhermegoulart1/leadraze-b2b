import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { BillingProvider } from './contexts/BillingContext';

// Páginas
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import AuthErrorPage from './pages/AuthErrorPage';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import GoogleMapsSearchPage from './pages/GoogleMapsSearchPage';
import GoogleMapsAgentsPage from './pages/GoogleMapsAgentsPage';
import GoogleMapsAgentDetailPage from './pages/GoogleMapsAgentDetailPage';
import CampaignsPage from './pages/CampaignsPage';
import CampaignReportPage from './pages/CampaignReportPage';
import LinkedInPage from './pages/LinkedInPage';
import ListasPage from './pages/ListasPage';
// LeadsPage removida - usar PipelinesPage
import ContactsPage from './pages/ContactsPage';
import ConversationsPage from './pages/ConversationsPage';
import AgentsPage from './pages/AgentsPage';
import InsightsPage from './pages/InsightsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ChannelsPage from './pages/ChannelsPage';
import UsersPage from './pages/UsersPage';
import PermissionsPage from './pages/PermissionsPage';
import SectorsPage from './pages/SectorsPage';
import ActivationAgentsPage from './pages/ActivationAgentsPage';
import ActivationCampaignsPage from './pages/ActivationCampaignsPage';
import MyConnectionsPage from './pages/MyConnectionsPage';
import ContactListsPage from './pages/ContactListsPage';
import PricingPage from './pages/PricingPage';
import CheckoutPage from './pages/CheckoutPage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import SetPasswordPage from './pages/SetPasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MagicLoginPage from './pages/MagicLoginPage';
import ForceChangePasswordPage from './pages/ForceChangePasswordPage';
import BillingPage from './pages/BillingPage';
import AffiliatePage from './pages/AffiliatePage';
import ProfilePage from './pages/ProfilePage';
import EmailSettingsPage from './pages/EmailSettingsPage';
import SettingsPage from './pages/SettingsPage';
import WebsiteAgentsPage from './pages/WebsiteAgentsPage';
import ApiKeysPage from './pages/ApiKeysPage';
import TasksPage from './pages/TasksPage';
import ChecklistTemplatesPage from './pages/ChecklistTemplatesPage';
import NextPage from './pages/NextPage';
import PartnersAdminPage from './pages/PartnersAdminPage';
import MyAccountPage from './pages/MyAccountPage';
import TagsPage from './pages/TagsPage';
import ConfigPage from './pages/ConfigPage';
import TeamPage from './pages/TeamPage';
import SecretAgentPage from './pages/SecretAgentPage';
import AIEmployeesPage from './pages/AIEmployeesPage';
import SearchPostsPage from './pages/SearchPostsPage';
import PipelinesPage from './pages/PipelinesPage';
import OnboardingPage from './pages/OnboardingPage';
import OnboardingAdminPage from './pages/OnboardingAdminPage';
import NotificationsPage from './pages/NotificationsPage';
import InstagramAgentsPage from './pages/InstagramAgentsPage';

// Partner Pages
import PartnerLoginPage from './pages/partner/PartnerLoginPage';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import PartnerSetPasswordPage from './pages/partner/PartnerSetPasswordPage';

// Support Access
import SupportAccessPage from './pages/SupportAccessPage';
import ImpersonationBanner from './components/ImpersonationBanner';

// Layout
import Layout from './components/Layout';
import SubscriptionBlockOverlay from './components/SubscriptionBlockOverlay';

// Protected Route Component
const ProtectedRoute = ({ children, allowPasswordChange = false }) => {
  const { isAuthenticated, loading, user } = useAuth();

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

  // Redirect to force-change-password if user must change password
  // (except when we're already on that page)
  if (user?.must_change_password && !allowPasswordChange) {
    return <Navigate to="/force-change-password" replace />;
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

      {/* Checkout Success - acessível para todos */}
      <Route path="/checkout/success" element={<CheckoutSuccessPage />} />

      {/* Set Password - para novos usuários criados via Stripe */}
      <Route path="/set-password" element={<SetPasswordPage />} />

      {/* Forgot Password - recuperação de senha */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Magic Login - para sub-usuários convidados via email */}
      <Route path="/magic-login" element={<MagicLoginPage />} />

      {/* Support Access - para operadores acessarem contas de clientes */}
      <Route path="/support-access" element={<SupportAccessPage />} />

      {/* Force Change Password - para usuários que entraram via magic link */}
      <Route
        path="/force-change-password"
        element={
          <ProtectedRoute allowPasswordChange>
            <ForceChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Checkout - protegido mas sem bloqueio de subscription */}
      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        }
      />

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
        <Route path="search" element={<SearchPage />} />
        <Route path="search/posts" element={<SearchPostsPage />} />
        <Route path="google-maps-search" element={<GoogleMapsSearchPage />} />
        <Route path="google-maps-agents" element={<GoogleMapsAgentsPage />} />
        <Route path="google-maps-agents/:id" element={<GoogleMapsAgentDetailPage />} />
        <Route path="instagram-agents" element={<InstagramAgentsPage />} />
        <Route path="campaigns" element={<LinkedInPage />} />
        <Route path="campaigns/:id/report" element={<CampaignReportPage />} />
        <Route path="leads" element={<Navigate to="/pipelines" replace />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="conversations" element={<ConversationsPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="activation-agents" element={<ActivationAgentsPage />} />
        <Route path="activation-campaigns" element={<ListasPage />} />
        <Route path="my-connections" element={<MyConnectionsPage />} />
        <Route path="contact-lists" element={<ContactListsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="secret-agent" element={<SecretAgentPage />} />
        <Route path="admin/partners" element={<PartnersAdminPage />} />

        {/* Novas páginas com abas */}
        <Route path="my-account" element={<MyAccountPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="team" element={<TeamPage />} />

        {/* Redirects das rotas antigas */}
        <Route path="profile" element={<Navigate to="/my-account" replace />} />
        <Route path="billing" element={<Navigate to="/my-account?tab=billing" replace />} />
        <Route path="affiliate" element={<Navigate to="/my-account?tab=affiliate" replace />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="aiemployees" element={<AIEmployeesPage />} />
        <Route path="pipelines" element={<PipelinesPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="onboarding/admin" element={<OnboardingAdminPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="api-keys" element={<Navigate to="/config?tab=api-keys" replace />} />
        <Route path="channels" element={<Navigate to="/config?tab=channels" replace />} />
        <Route path="checklist-templates" element={<Navigate to="/config?tab=checklists" replace />} />
        <Route path="email-settings" element={<Navigate to="/config?tab=emails" replace />} />
        <Route path="website-agents" element={<Navigate to="/config?tab=website-agents" replace />} />
        <Route path="users" element={<Navigate to="/team?tab=users" replace />} />
        <Route path="sectors" element={<Navigate to="/team?tab=sectors" replace />} />
        <Route path="permissions" element={<Navigate to="/team?tab=permissions" replace />} />
        <Route path="settings" element={<Navigate to="/my-account" replace />} />
      </Route>

      {/* GetRaze Next - Layout próprio, sem sidebar */}
      <Route
        path="/next"
        element={
          <ProtectedRoute>
            <NextPage />
          </ProtectedRoute>
        }
      />

      {/* Partner Portal - Rotas públicas */}
      <Route path="/partner/login" element={<PartnerLoginPage />} />
      <Route path="/partner/set-password" element={<PartnerSetPasswordPage />} />
      <Route path="/partner" element={<PartnerDashboard />} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <BillingProvider>
            <ImpersonationBanner />
            <AppRoutes />
          </BillingProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
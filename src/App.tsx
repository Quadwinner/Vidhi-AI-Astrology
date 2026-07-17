// src/App.tsx
import { Toaster } from 'react-hot-toast';
import { Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import './App.css';
import Footer from './components/Footer';
import GoogleTranslateWidget from './components/GoogleTranslateWidget';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { PricingProvider } from './context/PricingContext';

// Pages
import ArticlesSection from './components/ArticlesSection';
import { MainSection } from './components/MainSection';
import AccountPage from './pages/AccountPage';
import AdminCheckPage from './pages/AdminCheckPage';
import AdminPage from './pages/AdminPage';
import BlogPostPage from './pages/BlogPostPage';
import ChatPage from './pages/ChatPage';
import CreateProfilePage from './pages/CreateProfilePage';
import DebugPage from './pages/DebugPage';
import FireSignsBlog from './pages/FireSignsBlog';
import FullMoonBlog from './pages/FullMoonBlog';
import HomePage from './pages/HomePage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PlanetaryTransitsBlog from './pages/PlanetaryTransitsBlog';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ProfileDashboardPage from './pages/ProfileDashboardPage';
import QuickRechargePage from './pages/QuickRechargePage';
import RashifalPage from './pages/RashifalPage';
import RemediesPage from './pages/RemediesPage';
import ReportsPage from './pages/ReportsPage';
import SubscriptionManagementPage from './pages/SubscriptionManagementPage';
import TermsAndConditions from './pages/TermsAndConditions';
import WalletPage from './pages/WalletPage';
import YearEndBlog from './pages/YearEndBlog';


import { usePageTracking } from './hooks/usePageTracking';

function AppContent() {
  const location = useLocation();
  const showFooter = location.pathname !== "/chat" && location.pathname !== "/wallet" && location.pathname !== "/profiles" && location.pathname !== "/remedies";
  const isChatPage = location.pathname === "/chat";

  usePageTracking();

  return (
    <>
      <Navbar />

      <div className="pageContainer">
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/how-it-works" element={<MainSection />} />
            <Route path="/blog" element={<ArticlesSection />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/BlogPage" element={<BlogPostPage />} />

            <Route path="/rashifal" element={<RashifalPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/profiles" element={<ProfileDashboardPage />} />
              <Route path="/profiles/new" element={<CreateProfilePage />} />
              <Route path="/reports/:profileId" element={<ReportsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/subscription-management" element={<SubscriptionManagementPage />} />
              <Route path="/debug" element={<DebugPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/payment-success" element={<PaymentSuccessPage />} />
              <Route path="/FireSigns" element={<FireSignsBlog />} />
              <Route path="/FullMoonBlog" element={<FullMoonBlog />} />
              <Route path="/YearEndPredictions" element={<YearEndBlog />} />
              <Route path="/PlanetaryTransits" element={<PlanetaryTransitsBlog />} />
              <Route path="/quick-recharge" element={<QuickRechargePage />} />
              <Route path="/remedies" element={<RemediesPage />} />
            </Route>

            {/* Hidden Admin - guarded by admin-only route. No links in UI. */}
            <Route element={<ProtectedRoute requireAdmin={true} />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>

            {/* Debug route to verify admin state */}
            <Route element={<ProtectedRoute />}>
              <Route path="/admin-check" element={<AdminCheckPage />} />
            </Route>

            <Route path="*" element={<h1>404: Page Not Found</h1>} />
          </Routes>
        </div>

        {/* Footer */}
        {showFooter && <Footer />}
      </div>

      <GoogleTranslateWidget />

      {/* Toast Notifications */}
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          style: {
            zIndex: 10001,
          },
        }}
        containerStyle={{
          zIndex: 10001,
        }}
      />
    </>
  );
}


export default function App() {
  return (
    <Router>
      <AuthProvider>
        <PricingProvider>
          <AppContent />
        </PricingProvider>
      </AuthProvider>
    </Router>
  );
}
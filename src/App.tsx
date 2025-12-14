import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { StaffView } from './components/StaffView';
import { OwnerDashboard } from './components/OwnerDashboard';

function AppContent() {
  const { shop, userRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading Tallyra...</p>
        </div>
      </div>
    );
  }

  if (!shop || !userRole) {
    return <LoginPage />;
  }

  if (userRole === 'staff') {
    return <StaffView />;
  }

  if (userRole === 'owner') {
    return <OwnerDashboard />;
  }

  return <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
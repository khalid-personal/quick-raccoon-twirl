import React from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogOut, Users, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { logout, userRole } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-40 w-full border-b bg-white/90 backdrop-blur-sm dark:bg-gray-950/90">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link to="/admin" className="text-xl font-bold text-primary flex items-center space-x-2">
            <Home className="h-6 w-6" />
            <span>Agency Admin ({userRole})</span>
          </Link>
          <nav className="flex items-center space-x-4">
            <Link to="/admin">
              <Button variant="ghost" size="sm">
                <Users className="h-4 w-4 mr-2" /> Candidates
              </Button>
            </Link>
            <Button onClick={logout} variant="destructive" size="sm">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-grow container p-4 md:p-8">
        {children}
      </main>
      <footer className="p-4 text-center text-sm text-gray-500 border-t dark:border-gray-800">
        © 2024 Employment Agency Tracker
      </footer>
    </div>
  );
};

export default AdminLayout;
import React from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogOut, Users, Home, Settings, Menu, UserCog } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAddisAbabaTime } from '@/hooks/use-addis-ababa-time';
import { UserRole } from '@/lib/types';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    isSuperAdminRoute?: boolean;
    userRole: UserRole | null;
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon, label, isActive, isSuperAdminRoute = false, userRole }) => {
    if (isSuperAdminRoute && userRole !== 'admin') {
        return null;
    }
    
    return (
        <Link to={to} className="w-full">
            <Button 
                variant={isActive ? "secondary" : "ghost"} 
                className="w-full justify-start"
            >
                {icon}
                <span className="ml-2">{label}</span>
            </Button>
        </Link>
    );
};

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { logout, userRole } = useAuth();
  const location = useLocation();
  const addisAbabaTime = useAddisAbabaTime();
  
  const isSuperAdmin = userRole === 'admin';
  
  // Use a mock tracking code for easy testing of the public view
  const MOCK_TRACKING_CODE = 'TRK-ET-0001'; 
  
  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: <Users className="h-4 w-4" />, isSuperAdminRoute: false },
    // Updated link to point to a specific candidate's tracking page for testing
    { to: `/track/${MOCK_TRACKING_CODE}`, label: 'Public Tracking Test', icon: <Home className="h-4 w-4" />, isSuperAdminRoute: false },
    { to: '/admin/settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, isSuperAdminRoute: true },
    { to: '/admin/users', label: 'User Management', icon: <UserCog className="h-4 w-4" />, isSuperAdminRoute: true },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-40 w-full border-b bg-white/90 backdrop-blur-sm dark:bg-gray-950/90">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          
          {/* Left: Hamburger Menu (Mobile Only) */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[250px] p-4 pt-10 flex flex-col">
                <h2 className="text-xl font-bold text-primary mb-4">Agency Admin</h2>
                <nav className="flex flex-col space-y-1 flex-grow">
                  {navItems.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      icon={item.icon}
                      label={item.label}
                      isActive={location.pathname === item.to}
                      isSuperAdminRoute={item.isSuperAdminRoute}
                      userRole={userRole}
                    />
                  ))}
                </nav>
                <div className="mt-auto pt-4 border-t">
                    <Button onClick={logout} variant="destructive" className="w-full">
                        <LogOut className="h-4 w-4 mr-2" /> Logout
                    </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          {/* Center: Addis Ababa Time */}
          <div className="absolute left-1/2 transform -translate-x-1/2 text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
            {addisAbabaTime}
          </div>

          {/* Desktop Navigation (Hidden on Mobile) */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/admin" className="text-xl font-bold text-primary flex items-center space-x-2">
                <Home className="h-6 w-6" />
                <span>Admin ({userRole})</span>
            </Link>
            
            <nav className="flex items-center space-x-2 ml-6">
                {navItems.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      icon={item.icon}
                      label={item.label}
                      isActive={location.pathname === item.to}
                      isSuperAdminRoute={item.isSuperAdminRoute}
                      userRole={userRole}
                    />
                ))}
            </nav>
          </div>
          
          {/* Right: Logout Button (Always visible, or only visible on desktop if mobile has sheet) */}
          <div className="flex items-center space-x-4">
            <Button onClick={logout} variant="destructive" size="sm" className="hidden md:inline-flex">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
            {/* Show a smaller logout button on mobile if the sheet is not open, but since the sheet contains logout, we can rely on that or keep a small icon here */}
            <Button onClick={logout} variant="destructive" size="icon" className="md:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
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
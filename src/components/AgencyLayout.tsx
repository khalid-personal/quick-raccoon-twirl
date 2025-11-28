import React from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogOut, Building, Users, Menu, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAddisAbabaTime } from '@/hooks/use-addis-ababa-time';
import { UserRole } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface AgencyLayoutProps {
  children: React.ReactNode;
}

interface NavLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    userRole: UserRole | null;
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon, label, isActive }) => {
    return (
        <Link to={to} className="w-full">
            <Button 
                variant={isActive ? "secondary" : "ghost"} 
                className="w-full justify-start relative"
            >
                {icon}
                <span className="ml-2">{label}</span>
            </Button>
        </Link>
    );
};

const AgencyLayout: React.FC<AgencyLayoutProps> = ({ children }) => {
  const { logout, userRole, user, userForeignAgency } = useAuth();
  const location = useLocation();
  const addisAbabaTime = useAddisAbabaTime();
  
  const agencyEmail = user?.email || 'Foreign Agency';
  const agencyName = userForeignAgency || agencyEmail.split('@')[0].toUpperCase();

  const navItems = [
    { to: '/agency/dashboard', label: 'Dashboard', icon: <Home className="h-4 w-4" /> },
    { to: '/agency/staged-candidates', label: 'Staged Candidates', icon: <Users className="h-4 w-4" /> },
    // Add other agency-specific navigation items here
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
                <h2 className="text-xl font-bold text-blue-600 mb-4">Agency Portal</h2>
                <nav className="flex flex-col space-y-1 flex-grow">
                  {navItems.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      icon={item.icon}
                      label={item.label}
                      isActive={location.pathname === item.to}
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
          
          {/* Center: Agency Name & Addis Ababa Time */}
          <div className="flex items-center space-x-4">
            <Link to="/agency/dashboard" className="text-xl font-extrabold tracking-tight text-blue-600 flex items-center space-x-2">
                <Building className="h-6 w-6" />
                <span className="text-lg">{agencyName} Portal</span>
                <span className="text-sm font-medium text-muted-foreground ml-2">({userRole})</span>
            </Link>
            <div className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {addisAbabaTime}
            </div>
          </div>

          {/* Desktop Navigation (Hidden on Mobile) */}
          <nav className="hidden md:flex items-center space-x-2 ml-6 flex-grow justify-end">
              {navItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    isActive={location.pathname === item.to}
                    userRole={userRole}
                  />
              ))}
              <Button onClick={logout} variant="destructive" size="sm" className="ml-4">
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
          </nav>
          
          {/* Right: Mobile Logout Button (if desktop nav is hidden) */}
          <Button onClick={logout} variant="destructive" size="icon" className="md:hidden">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-grow container p-4 md:p-8">
        {children}
      </main>
      <footer className="p-4 text-center text-sm text-gray-500 border-t dark:border-gray-800">
        © 2024 Domestic Agency Workforce Management
      </footer>
    </div>
  );
};

export default AgencyLayout;
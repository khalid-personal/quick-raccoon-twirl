"use client";

import React from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogOut, Users, Home, Settings, Menu, UserCog, MessageSquare, Key, CalendarDays, Eye } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAddisAbabaTime } from '@/hooks/use-addis-ababa-time';
import { UserRole, ChatMessage } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'; // NEW IMPORTS
import { Input } from '@/components/ui/input'; // NEW IMPORT
import { Label } from '@/components/ui/label'; // NEW IMPORT
import { toast } from 'sonner'; // NEW IMPORT

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
    unreadCount?: number;
    onClick?: () => void; // Added onClick for dialog trigger
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon, label, isActive, isSuperAdminRoute = false, userRole, unreadCount = 0, onClick }) => {
    if (isSuperAdminRoute && userRole !== 'admin') {
        return null;
    }
    
    return (
        <Link to={to} className="w-full" onClick={onClick}>
            <Button 
                variant={isActive ? "secondary" : "ghost"} 
                className="w-full justify-start relative"
            >
                {icon}
                <span className="ml-2">{label}</span>
                {unreadCount > 0 && (
                    <Badge 
                        variant="destructive" 
                        className="ml-auto h-5 px-2 rounded-full text-xs font-bold"
                    >
                        {unreadCount}
                    </Badge>
                )}
            </Button>
        </Link>
    );
};

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { logout, userRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate(); // NEW
  const addisAbabaTime = useAddisAbabaTime();
  
  const isSuperAdmin = userRole === 'admin';
  
  // State for Public Tracking Test dialog
  const [isTrackingTestDialogOpen, setIsTrackingTestDialogOpen] = React.useState(false); // NEW
  const [trackingCodeInput, setTrackingCodeInput] = React.useState(''); // NEW
  
  // Fetch inbox summary for unread count
  const { data: inboxSummary = [] } = useQuery<ChatMessage[]>({
    queryKey: ['adminInboxSummary'],
    queryFn: api.getAdminInboxSummary,
    enabled: userRole === 'admin' || userRole === 'staff',
    refetchInterval: 10000, // Poll for new messages
  });
  
  const unreadCount = inboxSummary.filter(m => m.sender === 'candidate' && !m.is_read_by_admin).length;
  
  // Handle navigation for public tracking test
  const handleViewPublicTracking = () => {
    if (trackingCodeInput.trim()) {
      navigate(`/track/${trackingCodeInput.trim()}`);
      setIsTrackingTestDialogOpen(false);
      setTrackingCodeInput(''); // Clear input after navigation
    } else {
      toast.error("Please enter a tracking code.");
    }
  };
  
  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: <Users className="h-4 w-4" />, isSuperAdminRoute: false },
    { to: '/admin/chat', label: 'Candidate Chat', icon: <MessageSquare className="h-4 w-4" />, isSuperAdminRoute: false, unreadCount: unreadCount },
    { to: '/admin/attendance', label: 'Attendance', icon: <CalendarDays className="h-4 w-4" />, isSuperAdminRoute: false },
    // Updated link to open a dialog instead of direct navigation
    { 
      to: '#', // Use '#' or a dummy path as it will be intercepted by onClick
      label: 'Public Tracking Test', 
      icon: <Home className="h-4 w-4" />, 
      isSuperAdminRoute: false,
      onClick: () => setIsTrackingTestDialogOpen(true), // Open dialog on click
    },
    { to: '/admin/auth-codes', label: 'Auth Codes', icon: <Key className="h-4 w-4" />, isSuperAdminRoute: true },
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
                <h2 className="text-xl font-bold text-primary mb-4">DAWM Portal</h2>
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
                      unreadCount={item.unreadCount}
                      onClick={item.onClick} // Pass onClick handler
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
            <Link to="/admin" className="text-xl font-extrabold tracking-tight text-primary flex items-center space-x-2">
                <Home className="h-6 w-6" />
                <span className="text-lg">Domestic Agency Workforce Management (DAWM) Portal</span>
                <span className="text-sm font-medium text-muted-foreground ml-2">({userRole})</span>
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
                      unreadCount={item.unreadCount}
                      onClick={item.onClick} // Pass onClick handler
                    />
                ))}
            </nav>
          </div>
          
          {/* Right: Logout Button (Always visible, or only visible on desktop if mobile has sheet) */}
          <div className="flex items-center space-x-4">
            <Button onClick={logout} variant="destructive" size="sm" className="hidden md:inline-flex">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
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
        © 2024 Domestic Agency Workforce Management
      </footer>

      {/* Public Tracking Test Dialog */}
      <Dialog open={isTrackingTestDialogOpen} onOpenChange={setIsTrackingTestDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Eye className="h-5 w-5 mr-2" /> View Public Tracking
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tracking-code-input">Enter Candidate Tracking Code</Label>
              <Input
                id="tracking-code-input"
                placeholder="e.g., TRK-ET-0001"
                value={trackingCodeInput}
                onChange={(e) => setTrackingCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleViewPublicTracking();
                  }
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              You can use `TRK-ET-0001` for a quick test.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleViewPublicTracking}>
              View Tracking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLayout;
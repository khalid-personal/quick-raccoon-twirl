import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import AdminDashboard from './AdminDashboard';

export function LocalAgencyDashboard() {
  const { isLoading, userLocalAgencyId, userLocalAgencyName } = useAuth();
  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" aria-label="Loading agency dashboard" /></div>;
  if (!userLocalAgencyId || !userLocalAgencyName) return <p role="alert" className="text-destructive">Your local agency assignment could not be loaded. Contact an administrator.</p>;
  return <AdminDashboard />;
}

export default LocalAgencyDashboard;
import { CircleHelp, Wifi, WifiOff } from 'lucide-react';
import { usePresence } from '@/hooks/use-presence';
import { presenceFor, type PresenceKind } from '@/lib/presence';
import { isDemoMode } from '@/lib/demo-mode';
import { cn } from '@/lib/utils';

export default function AvatarActivity({ id, kind, lastSeen }: { id?: string; kind: PresenceKind; lastSeen?: string }) {
  const snapshot = usePresence();
  if (!id) return null;
  const actual = presenceFor(snapshot, kind, id, lastSeen);
  // Demo activity is illustrative, never a real login or attendance record.
  const demo = isDemoMode() && id.startsWith('demo-')
    && !Object.values(snapshot.sessions).some(session => session.subjectId === id && session.kind === kind);
  const online = actual.online || (demo && [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4 === 0);
  const known = demo || !!actual.lastSeen;
  const label = `${demo ? 'Demo simulated: ' : ''}${online ? 'Online' : known ? 'Offline' : 'Activity unknown'}${!demo && actual.lastSeen ? `; last seen ${new Date(actual.lastSeen).toLocaleString()}` : ''}`;
  const Icon = online ? Wifi : known ? WifiOff : CircleHelp;
  return <span role="img" aria-label={label} title={label} className={cn(
    'absolute -right-0.5 -top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background shadow-sm',
    online ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground',
  )}><Icon className="h-3 w-3" aria-hidden="true" /></span>;
}

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { StaffUser } from '@/lib/types';
import AvatarActivity from './AvatarActivity';

export default function UserAvatar({ user, className = 'h-9 w-9' }: {
  user: Pick<StaffUser, 'id' | 'email' | 'profile_image_url' | 'last_online_at'>; className?: string;
}) {
  return <Avatar className={`!overflow-visible ${className}`} aria-label={user.email}>
    <AvatarImage className="rounded-full object-cover" src={user.profile_image_url} alt={user.email} />
    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{user.email.slice(0, 2).toUpperCase()}</AvatarFallback>
    <AvatarActivity id={user.id} kind="staff" lastSeen={user.last_online_at} />
  </Avatar>;
}

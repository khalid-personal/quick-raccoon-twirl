import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

export default function AuthPasswordInput({ autoComplete = 'current-password', className, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><Input {...props} type={visible ? 'text' : 'password'} autoComplete={autoComplete} className={cn('pr-12', className)} /><button type="button" disabled={props.disabled} aria-label={visible ? 'Hide PIN' : 'Show PIN'} aria-pressed={visible} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setVisible(value => !value)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>;
}

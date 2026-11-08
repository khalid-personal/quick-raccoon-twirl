import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun key="sun" className="h-5 w-5 motion-safe:animate-in motion-safe:spin-in-90 motion-safe:zoom-in-50 duration-300" /> : <Moon key="moon" className="h-5 w-5 motion-safe:animate-in motion-safe:-spin-in-90 motion-safe:zoom-in-50 duration-300" />}
    </Button>
  );
};

export default ThemeToggle;

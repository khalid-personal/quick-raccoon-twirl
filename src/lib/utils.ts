import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { StageStatus } from "./types";
import * as LucideIcons from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStatusColor(status: StageStatus | string): string {
  switch (status) {
    case 'Completed':
    case 'Passed':
    case 'Issued':
      return 'bg-green-500 text-white';
    case 'In Progress':
      return 'bg-blue-500 text-white';
    case 'Failed':
      return 'bg-red-500 text-white';
    case 'Pending':
    default:
      return 'bg-gray-300 text-gray-800';
  }
}

// Utility to get Lucide icon component by name string
export function getIconComponent(iconName: string): React.FC<LucideIcons.LucideProps> | null {
  const Icon = LucideIcons[iconName as keyof typeof LucideIcons];
  if (Icon) {
    return Icon as React.FC<LucideIcons.LucideProps>;
  }
  return null;
}
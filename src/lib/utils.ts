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
      // Success: Green background, white text
      return 'bg-green-600 text-white hover:bg-green-700';
    case 'In Progress':
      // Active: Blue background, white text
      return 'bg-blue-600 text-white hover:bg-blue-700';
    case 'Failed':
      // Failure/Blocked: Red background, white text
      return 'bg-red-600 text-white hover:bg-red-700';
    case 'Pending':
    default:
      // Neutral/Pending: Gray background, dark text
      return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600';
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
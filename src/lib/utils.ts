import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { StageStatus } from "./types";

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
import { createContext, useContext } from 'react';

export interface PopupDockItem {
  id: string;
  title: string;
  minimized: boolean;
  minimize: () => void;
  resume: () => void;
  close: () => void;
}
export const PopupDockContext = createContext<{
  register: (item: PopupDockItem) => void;
  unregister: (id: string) => void;
  activate: (id: string) => void;
} | null>(null);
export const usePopupDock = () => useContext(PopupDockContext);

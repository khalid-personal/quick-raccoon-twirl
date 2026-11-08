import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface LayoutEditValue {
  editing: boolean;
  editable: boolean;
  setEditing: (value: boolean) => void;
  setEditable: (value: boolean) => void;
}

const LayoutEditContext = createContext<LayoutEditValue>({ editing: false, editable: false, setEditing: () => undefined, setEditable: () => undefined });

export const LayoutEditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [editing, setEditingState] = useState(false);
  const [editable, setEditableState] = useState(false);
  const setEditable = useCallback((value: boolean) => { setEditableState(value); if (!value) setEditingState(false); }, []);
  const value = useMemo(() => ({ editing, editable, setEditing: setEditingState, setEditable }), [editing, editable, setEditable]);
  return <LayoutEditContext.Provider value={value}>{children}</LayoutEditContext.Provider>;
};

export const useLayoutEdit = () => useContext(LayoutEditContext);

const DEMO_FLAG = 'dawm_demo_session';
export const VIEW_AS_KEY = 'dawm_view_as';
export const DEMO_KEY_PREFIX = 'dawm_demo_';
export const DEMO_SCENARIO_KEY = 'dawm_demo_scenario';
export type DemoScenario = 'priority' | 'needs-attention' | 'high-performing';

export const isDemoMode = (): boolean => {
  try { return sessionStorage.getItem(DEMO_FLAG) === '1'; } catch { return false; }
};

export const getDemoScenario = (): DemoScenario => {
  const value = sessionStorage.getItem(DEMO_SCENARIO_KEY);
  return value === 'needs-attention' || value === 'high-performing' ? value : 'priority';
};

export const setDemoScenario = (scenario: DemoScenario) => sessionStorage.setItem(DEMO_SCENARIO_KEY, scenario);
export const enterDemo = (path = '/admin') => { sessionStorage.setItem(DEMO_FLAG, '1'); window.location.assign(path); };
export const exitDemo = () => { sessionStorage.removeItem(DEMO_FLAG); sessionStorage.removeItem(VIEW_AS_KEY); window.location.assign('/login'); };
export const clearDemoStorage = () => Object.keys(localStorage).filter(key => key.startsWith(DEMO_KEY_PREFIX)).forEach(key => localStorage.removeItem(key));
export const resetDemo = () => { clearDemoStorage(); setDemoScenario('priority'); window.location.assign('/admin'); };

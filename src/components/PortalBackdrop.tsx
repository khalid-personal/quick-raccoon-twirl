import { useState } from 'react';
import JourneyArrowField from './JourneyArrowField';

export default function PortalBackdrop() {
  const [paused, setPaused] = useState(false);
  return <>
    <div aria-hidden="true" className="portal-backdrop" data-motion={paused ? 'static' : 'active'}>
    <div className="portal-backdrop-scene">
      <span className="portal-backdrop-glow portal-backdrop-glow-teal" />
      <span className="portal-backdrop-glow portal-backdrop-glow-lime" />
      <span className="portal-backdrop-orbit portal-backdrop-orbit-outer" />
      <span className="portal-backdrop-orbit portal-backdrop-orbit-inner" />
      <span className="portal-backdrop-grid" />
      <JourneyArrowField paused={paused} />
    </div>
  </div>
  <button type="button" aria-pressed={paused} className="portal-atmosphere-control" onClick={() => setPaused(value => !value)}>{paused ? 'Resume atmosphere' : 'Pause atmosphere'}</button>
  </>;
}

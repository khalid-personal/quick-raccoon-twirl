import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import DawmBrand from './DawmBrand';
import JourneyArrowField from './JourneyArrowField';
import '@/styles/public-site.css';

export default function PublicSiteLayout({ children, atmospherePaused = false }: { children: ReactNode; atmospherePaused?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const closeMenu = () => setMenuOpen(false);
  return <div className="dawm-public">
    <JourneyArrowField paused={atmospherePaused} />
    <a className="public-skip-link" href="#public-content">Skip to content</a>
    <header className="public-header">
      <div className="public-container public-header-inner">
        <Link to="/" aria-label="DAWM home" onClick={closeMenu}><DawmBrand compact appearance="dark" subtitle="Connected workforce" /></Link>
        <button className="public-menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X /> : <Menu />}</button>
        <nav id="public-navigation" aria-label="Main navigation" className={menuOpen ? 'public-nav is-open' : 'public-nav'}>
          <Link to="/#platform" onClick={closeMenu}>The platform</Link>
          <Link to="/#journey" onClick={closeMenu}>How it works</Link>
          <Link to="/developers" aria-current={pathname === '/developers' ? 'page' : undefined} onClick={closeMenu}>Developers</Link>
          <Link to="/#pricing" onClick={closeMenu}>Pricing</Link>
          <Link to="/login" className="public-button public-button-small public-button-outline" onClick={closeMenu}>Sign in <ArrowUpRight size={16} /></Link>
        </nav>
      </div>
    </header>
    <main id="public-content">{children}</main>
    <footer className="public-footer">
      <div className="public-container public-footer-top">
        <div><Link to="/" aria-label="DAWM home"><DawmBrand compact appearance="dark" subtitle="Connected workforce" /></Link><p>Built in Ethiopia.<br />Designed for the journey beyond.</p></div>
        <nav aria-label="Footer navigation"><Link to="/#platform">Platform</Link><Link to="/developers">Integration docs</Link><Link to="/#pricing">Pricing</Link><Link to="/login">Staff sign in</Link><Link to="/login?tab=candidate">Candidate sign in</Link></nav>
      </div>
      <div className="public-container public-footer-bottom"><span>&copy; {new Date().getFullYear()} DAWM</span><span>Domestic Agency Workforce Management</span><span>One journey. Everyone connected.</span></div>
    </footer>
  </div>;
}

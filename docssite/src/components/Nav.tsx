interface NavItem {
  key: string;
  title: string;
}

interface Props {
  brand: string;
  items: NavItem[];
  activeId: string | null;
  audience: 'developer' | 'business';
  onAudienceChange: (a: 'developer' | 'business') => void;
}

const Nav: React.FC<Props> = ({ brand, items, activeId, audience, onAudienceChange }) => (
  <nav className="site-nav" aria-label="Sections">
    <div className="nav-brand">{brand}</div>
    <div className="audience-tabs">
      <button
        type="button"
        className={`audience-tab${audience === 'developer' ? ' audience-tab--active' : ''}`}
        onClick={() => onAudienceChange('developer')}
      >
        Developer
      </button>
      <button
        type="button"
        className={`audience-tab${audience === 'business' ? ' audience-tab--active' : ''}`}
        onClick={() => onAudienceChange('business')}
      >
        Business
      </button>
    </div>
    <ul className="nav-list">
      {items.map(({ key, title }) => (
        <li key={key} className="nav-item">
          <a
            href={`#${key}`}
            className={`nav-link${activeId === key ? ' nav-link--active' : ''}`}
          >
            {title}
          </a>
        </li>
      ))}
    </ul>
  </nav>
);

export default Nav;

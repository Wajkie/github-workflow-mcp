interface NavItem {
  key: string;
  title: string;
}

interface Props {
  items: NavItem[];
  activeId: string | null;
}

const Nav: React.FC<Props> = ({ items, activeId }) => (
  <nav className="site-nav" aria-label="Sections">
    <div className="nav-brand">GitHub Workflow MCP</div>
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

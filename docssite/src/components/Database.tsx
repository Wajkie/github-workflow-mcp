import type { DatabaseSection } from '../types/onboarding';
import CopyButton from './CopyButton';

interface Props {
  data: DatabaseSection;
}

const Database: React.FC<Props> = ({ data }) => (
  <div className="database">
    <h3 className="subsection-title">Providers</h3>
    <div className="provider-scroll">
      {data.providers.map((p) => (
        <div key={p.id} className="card provider-card">
          <div className="card-label">{p.label}</div>
          {p.url && (
            <a className="provider-url" href={p.url} target="_blank" rel="noreferrer">
              {p.url}
            </a>
          )}
          <p className="card-note">{p.note}</p>
        </div>
      ))}
    </div>

    <h3 className="subsection-title">Commands</h3>
    <div className="db-commands">
      {data.commands.map((cmd) => (
        <div key={cmd.id} className="db-command">
          <div className="db-command-label">{cmd.label}</div>
          <div className="code-block">
            <code className="code-text">{cmd.command}</code>
            <CopyButton text={cmd.command} />
          </div>
          {cmd.note && <p className="step-note">{cmd.note}</p>}
        </div>
      ))}
    </div>

    <h3 className="subsection-title">Schema Overview</h3>
    <table className="schema-table">
      <thead>
        <tr>
          <th>Model</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {data.schema_overview.map((row) => (
          <tr key={row.model}>
            <td><code>{row.model}</code></td>
            <td>{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default Database;

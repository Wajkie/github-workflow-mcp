import type { ScriptsSection } from '../types/onboarding';
import CopyButton from './CopyButton';

interface Props {
  data: ScriptsSection;
}

const Scripts: React.FC<Props> = ({ data }) => (
  <div className="scripts">
    <table className="scripts-table">
      <thead>
        <tr>
          <th>Command</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((item) => (
          <tr key={item.command} className="scripts-row">
            <td className="scripts-cmd-cell">
              <div className="scripts-cmd-wrap">
                <code className="scripts-cmd">{item.command}</code>
                <CopyButton text={item.command} />
              </div>
            </td>
            <td>{item.description}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="scripts-cards">
      {data.items.map((item) => (
        <div key={item.command} className="card scripts-card">
          <div className="scripts-cmd-wrap">
            <code className="scripts-cmd">{item.command}</code>
            <CopyButton text={item.command} />
          </div>
          <p className="card-description">{item.description}</p>
        </div>
      ))}
    </div>
  </div>
);

export default Scripts;

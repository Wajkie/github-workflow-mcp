import { useState } from 'react';
import type { ContentSection } from '../types/onboarding';
import CopyButton from './CopyButton';

interface Props {
  data: ContentSection;
}

const Content: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<string>('methods');

  return (
    <div className="content-section">
      <div className="tabs" role="tablist">
        <button
          role="tab"
          type="button"
          className={`tab-btn${activeTab === 'methods' ? ' tab-btn--active' : ''}`}
          aria-selected={activeTab === 'methods'}
          onClick={() => setActiveTab('methods')}
        >
          Methods
        </button>
        <button
          role="tab"
          type="button"
          className={`tab-btn${activeTab === 'shape' ? ' tab-btn--active' : ''}`}
          aria-selected={activeTab === 'shape'}
          onClick={() => setActiveTab('shape')}
        >
          Crew Member Shape
        </button>
      </div>

      {activeTab === 'methods' && (
        <div className="tab-panel">
          {data.methods.map((method) => (
            <div key={method.id} className="card method-card">
              <div className="card-label">{method.label}</div>
              <p className="card-description">{method.description}</p>
              {method.auth_header && (
                <div className="code-block code-block--inline">
                  <code className="code-text">{method.auth_header}</code>
                  <CopyButton text={method.auth_header} />
                </div>
              )}
              {method.command && (
                <div className="code-block">
                  <code className="code-text">{method.command}</code>
                  <CopyButton text={method.command} />
                </div>
              )}
              {method.endpoints && method.endpoints.length > 0 && (
                <table className="endpoints-table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Description</th>
                      <th>Auth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {method.endpoints.map((ep) => (
                      <tr key={ep.route}>
                        <td><code>{ep.route}</code></td>
                        <td>{ep.description}</td>
                        <td>{ep.auth ? <span className="badge badge--required">yes</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'shape' && (
        <div className="tab-panel">
          <p className="card-description">{data.crew_member_shape.description}</p>
          <div className="code-block code-block--json">
            <code className="code-text">
              <pre>{JSON.stringify(data.crew_member_shape.example, null, 2)}</pre>
            </code>
            <CopyButton text={JSON.stringify(data.crew_member_shape.example, null, 2)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Content;

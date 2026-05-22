import type { IntegrationsSection } from '../types/onboarding';

interface Props {
  data: IntegrationsSection;
}

const Integrations: React.FC<Props> = ({ data }) => (
  <div className="integrations">
    {data.items.map((item) => (
      <details key={item.id} className="integration-accordion">
        <summary className="integration-summary">
          <span className="integration-label">{item.label}</span>
          <span className={`badge badge--${item.status}`}>{item.status}</span>
        </summary>
        <div className="integration-body">
          <p className="card-description">{item.description}</p>
          <ol className="setup-steps">
            {item.setup.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      </details>
    ))}
  </div>
);

export default Integrations;

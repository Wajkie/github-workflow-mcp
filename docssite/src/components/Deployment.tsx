import type { DeploymentSection } from '../types/onboarding';

interface Props {
  data: DeploymentSection;
}

const Deployment: React.FC<Props> = ({ data }) => (
  <div className="deployment">
    <div className="platform-grid">
      {data.platforms.map((platform) => (
        <div key={platform.id} className="card platform-card">
          <div className="card-label">
            {platform.label}
            {platform.id === data.recommended && (
              <span className="badge badge--required">recommended</span>
            )}
          </div>
          <ol className="setup-steps">
            {platform.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p className="step-note">{platform.note}</p>
        </div>
      ))}
    </div>

    <h3 className="subsection-title">Post-Deploy Checklist</h3>
    <ul className="checklist">
      {data.post_deploy_checklist.map((item, i) => (
        <li key={i} className="checklist-item">
          <span className="checkbox" aria-hidden="true" />
          <div className="checklist-body">
            <span className="checklist-label">{item}</span>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

export default Deployment;

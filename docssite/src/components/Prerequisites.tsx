import type { PrerequisitesSection } from '../types/onboarding';

interface Props {
  data: PrerequisitesSection;
}

const Prerequisites: React.FC<Props> = ({ data }) => (
  <div className="prerequisites">
    <div className="prereq-group">
      <h3 className="prereq-group-title">Required</h3>
      <ul className="checklist">
        {data.required.map((item) => (
          <li key={item.id} className="checklist-item">
            <span className="checkbox" aria-hidden="true" />
            <div className="checklist-body">
              <span className="checklist-label">
                {item.label}
                {item.version && <span className="version-badge">{item.version}</span>}
              </span>
              <span className="checklist-why">{item.why}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>

    <div className="prereq-group">
      <h3 className="prereq-group-title">Optional</h3>
      <ul className="checklist checklist--optional">
        {data.optional.map((item) => (
          <li key={item.id} className="checklist-item checklist-item--optional">
            <span className="checkbox checkbox--optional" aria-hidden="true" />
            <div className="checklist-body">
              <span className="checklist-label">
                {item.label}
                <span className="badge badge--optional">skippable</span>
              </span>
              <span className="checklist-why">{item.why}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default Prerequisites;

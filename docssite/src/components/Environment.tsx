import type { EnvironmentSection } from '../types/onboarding';

interface Props {
  data: EnvironmentSection;
}

const Environment: React.FC<Props> = ({ data }) => (
  <div className="env-groups">
    {data.groups.map((group) => (
      <details key={group.id} className="env-group" open>
        <summary className="env-group-summary">{group.label}</summary>
        <div className="env-variables">
          {group.variables.map((v) => (
            <div key={v.key} className="env-row">
              <div className="env-key-row">
                <code className="env-key">{v.key}</code>
                {v.required ? (
                  <span className="badge badge--required">required</span>
                ) : (
                  <span className="badge badge--optional">optional</span>
                )}
              </div>
              <p className="env-description">{v.description}</p>
              {v.example && (
                <p className="env-example">
                  <span className="env-example-label">Example: </span>
                  <code>{v.example}</code>
                </p>
              )}
              {v.hint && <p className="env-hint">{v.hint}</p>}
            </div>
          ))}
        </div>
      </details>
    ))}
  </div>
);

export default Environment;

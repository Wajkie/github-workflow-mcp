import type { CustomizationSection } from '../types/onboarding';

interface Props {
  data: CustomizationSection;
}

const Customization: React.FC<Props> = ({ data }) => (
  <div className="customization-grid">
    {data.items.map((item) => (
      <div key={item.id} className="card customization-card">
        <div className="card-label">{item.label}</div>
        {item.files && item.files.length > 0 && (
          <div className="file-chips">
            {item.files.map((f) => (
              <code key={f} className="file-chip">{f}</code>
            ))}
          </div>
        )}
        {item.how && <p className="how-label">Via: <em>{item.how}</em></p>}
        <p className="card-instructions">{item.instructions}</p>
      </div>
    ))}
  </div>
);

export default Customization;

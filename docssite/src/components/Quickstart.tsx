import type { QuickstartSection } from '../types/onboarding';
import CopyButton from './CopyButton';

interface Props {
  data: QuickstartSection;
}

const Quickstart: React.FC<Props> = ({ data }) => (
  <ol className="steps-list">
    {data.steps.map((step) => (
      <li key={step.id} className="step">
        <div className="step-number">{step.order}</div>
        <div className="step-body">
          <h3 className="step-title">{step.title}</h3>
          <div className="code-block">
            <code className="code-text">{step.command}</code>
            <CopyButton text={step.command} />
          </div>
          {step.note && <p className="step-note">{step.note}</p>}
        </div>
      </li>
    ))}
  </ol>
);

export default Quickstart;

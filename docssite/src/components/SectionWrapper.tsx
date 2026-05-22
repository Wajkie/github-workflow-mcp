interface Props {
  id: string;
  title: string;
  description?: string;
  index: number;
  children: React.ReactNode;
}

const SectionWrapper: React.FC<Props> = ({ id, title, description, index, children }) => {
  const num = String(index + 1).padStart(2, '0');

  return (
    <section
      id={id}
      className="section-wrapper"
      style={{ '--section-number': `"${num}"` } as React.CSSProperties}
    >
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      <div className="section-content">{children}</div>
    </section>
  );
};

export default SectionWrapper;

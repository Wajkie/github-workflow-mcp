import { useState } from 'react';
import rawData from '../../docs/docs.json';
import type { DocsData, ContentBlock, Tool, ToolGroup } from './types/docs';
import { useActiveSection } from './hooks/useActiveSection';
import Nav from './components/Nav';
import SectionWrapper from './components/SectionWrapper';
import CopyButton from './components/CopyButton';

const data = rawData as unknown as DocsData;
const { meta, tools, audiences } = data;
const toolMap = Object.fromEntries(tools.map((t) => [t.id, t]));

function Block({ block }: { block: ContentBlock }): React.ReactElement | null {
  switch (block.type) {
    case 'prose':
      return <p className="prose">{block.body}</p>;

    case 'code':
      return (
        <div className="code-block">
          {block.label && <span className="code-label">{block.label}</span>}
          <div className="code-header">
            <span className="code-lang">{block.lang}</span>
            <CopyButton text={block.body} />
          </div>
          <pre><code>{block.body}</code></pre>
        </div>
      );

    case 'callout':
      return (
        <div className={`callout callout--${block.variant}`}>
          {block.body}
        </div>
      );

    case 'list':
      return (
        <ul className="content-list">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );

    case 'steps':
      return (
        <ol className="steps-list">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
      );

    case 'capability-list':
      return (
        <ul className="capability-list">
          {block.items.map((item) => (
            <li key={item.label} className="capability-item">
              <strong>{item.label}</strong>
              <span>{item.summary}</span>
            </li>
          ))}
        </ul>
      );

    case 'env-table':
      return (
        <table className="env-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Required</th>
              <th>Default</th>
              <th>Description</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            {block.vars.map((v) => (
              <tr key={v.name}>
                <td><code>{v.name}</code></td>
                <td>{v.required ? '✓' : '—'}</td>
                <td>{v.default ?? '—'}</td>
                <td>{v.description}</td>
                <td>{v.example ? <code>{v.example}</code> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    default:
      return null;
  }
}

function ToolCard({ tool }: { tool: Tool }): React.ReactElement {
  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <code className="tool-name">{tool.name}</code>
        {tool.requiresWrites && (
          <span className="badge badge--write">requires writes</span>
        )}
      </div>
      <p className="tool-summary">{tool.summary}</p>
      <p className="tool-description">{tool.description}</p>
      {tool.inputs.length > 0 && (
        <table className="env-table">
          <thead>
            <tr><th>Input</th><th>Type</th><th>Required</th><th>Description</th></tr>
          </thead>
          <tbody>
            {tool.inputs.map((inp) => (
              <tr key={inp.name}>
                <td><code>{inp.name}</code></td>
                <td><code>{inp.type}</code></td>
                <td>{inp.required ? '✓' : '—'}</td>
                <td>{inp.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ToolsGroup({ group }: { group: ToolGroup }): React.ReactElement {
  return (
    <div className="tool-group">
      <h3 className="tool-group-title">
        {group.title}
        {group.requiresWrites && (
          <span className="badge badge--write">requires writes</span>
        )}
      </h3>
      <div className="tool-group-cards">
        {group.toolRefs.map((ref) => {
          const tool = toolMap[ref];
          return tool ? <ToolCard key={ref} tool={tool} /> : null;
        })}
      </div>
    </div>
  );
}

function App(): React.ReactElement {
  const [audience, setAudience] = useState<'developer' | 'business'>('developer');
  const activeSections = audiences[audience].sections;
  const activeSectionIds = activeSections.map((s) => s.id);
  const activeId = useActiveSection(activeSectionIds);
  const navItems = activeSections.map((s) => ({ key: s.id, title: s.title }));

  return (
    <div className="layout">
      <Nav brand={meta.title} items={navItems} activeId={activeId} audience={audience} onAudienceChange={setAudience} />
      <main className="main-content">
        <header className="site-header">
          <h1 className="site-title">{meta.title}</h1>
          <p className="site-description">{meta.description}</p>
          <div className="stack-chips">
            <span className="stack-chip">
              <span className="stack-chip-key">version:</span> {meta.version}
            </span>
            <span className="stack-chip">
              <span className="stack-chip-key">repo:</span>{' '}
              <a href={meta.repo} target="_blank" rel="noreferrer">{meta.repo}</a>
            </span>
          </div>
        </header>

        {activeSections.map((section, index) => (
          <SectionWrapper
            key={section.id}
            id={section.id}
            title={section.title}
            index={index}
          >
            {section.pages?.map((page) => (
              <div key={page.id} className="page-block">
                <h3 className="page-title">{page.title}</h3>
                {page.content.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            ))}

            {section.groups?.map((group) => (
              <ToolsGroup key={group.id} group={group} />
            ))}
          </SectionWrapper>
        ))}
        <footer className="site-footer">
          {meta.title} — Documentation
        </footer>
      </main>
    </div>
  );
}

export default App;

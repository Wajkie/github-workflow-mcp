export interface DocsMeta {
  title: string;
  description: string;
  version: string;
  repo: string;
}

export interface ToolInput {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface Tool {
  id: string;
  name: string;
  category: string;
  requiresWrites: boolean;
  summary: string;
  description: string;
  inputs: ToolInput[];
  returns: { description: string; shape: unknown };
  example: { input: unknown; output: unknown };
}

export interface EnvVar {
  name: string;
  required: boolean;
  default: string | null;
  description: string;
  example?: string;
}

export type ContentBlock =
  | { type: 'prose'; body: string }
  | { type: 'code'; lang: string; body: string; label?: string }
  | { type: 'callout'; variant: string; body: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'capability-list'; items: { label: string; summary: string }[] }
  | { type: 'env-table'; vars: EnvVar[] };

export interface Page {
  id: string;
  title: string;
  content: ContentBlock[];
}

export interface ToolGroup {
  id: string;
  title: string;
  toolRefs: string[];
  requiresWrites?: boolean;
}

export interface Section {
  id: string;
  title: string;
  pages?: Page[];
  groups?: ToolGroup[];
}

export interface Audience {
  nav: string[];
  sections: Section[];
}

export interface DocsData {
  meta: DocsMeta;
  tools: Tool[];
  audiences: {
    developer: Audience;
    business: Audience;
  };
}

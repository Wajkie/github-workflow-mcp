export type SectionKey =
  | 'prerequisites'
  | 'quickstart'
  | 'environment'
  | 'database'
  | 'customization'
  | 'content'
  | 'integrations'
  | 'deployment'
  | 'scripts';

export interface MetaStack {
  framework: string;
  language: string;
  styling: string;
  database: string;
  hosting: string;
  storage: string;
}

export interface Meta {
  name: string;
  version: string;
  description: string;
  stack: MetaStack;
  sections: SectionKey[];
}

export interface RequiredItem {
  id: string;
  label: string;
  version?: string;
  why: string;
}

export interface OptionalItem {
  id: string;
  label: string;
  why: string;
  skippable: true;
}

export interface PrerequisitesSection {
  title: string;
  description: string;
  required: RequiredItem[];
  optional: OptionalItem[];
}

export interface QuickstartStep {
  order: number;
  id: string;
  title: string;
  command: string;
  note?: string;
}

export interface QuickstartSection {
  title: string;
  description: string;
  steps: QuickstartStep[];
}

export interface EnvVariable {
  key: string;
  required: boolean;
  description: string;
  example?: string;
  hint?: string;
}

export interface EnvGroup {
  id: string;
  label: string;
  variables: EnvVariable[];
}

export interface EnvironmentSection {
  title: string;
  description: string;
  groups: EnvGroup[];
}

export interface DbProvider {
  id: string;
  label: string;
  url?: string;
  note: string;
}

export interface DbCommand {
  id: string;
  label: string;
  command: string;
  note?: string;
}

export interface SchemaModel {
  model: string;
  description: string;
}

export interface DatabaseSection {
  title: string;
  description: string;
  providers: DbProvider[];
  commands: DbCommand[];
  schema_overview: SchemaModel[];
}

export interface CustomizationItem {
  id: string;
  label: string;
  files?: string[];
  how?: string;
  instructions: string;
}

export interface CustomizationSection {
  title: string;
  description: string;
  items: CustomizationItem[];
}

export interface ApiEndpoint {
  route: string;
  description: string;
  auth?: true;
}

export interface ContentMethod {
  id: string;
  label: string;
  description: string;
  auth_header?: string;
  endpoints?: ApiEndpoint[];
  command?: string;
}

export interface CrewMemberExample {
  name: string;
  handle: string;
  rank: string;
  role: string;
  bio: string;
  image: string;
  twitchLogin: string;
  personality: string[];
  socials: Record<string, string>;
}

export interface CrewMemberShape {
  description: string;
  example: CrewMemberExample;
}

export interface ContentSection {
  title: string;
  description: string;
  methods: ContentMethod[];
  crew_member_shape: CrewMemberShape;
}

export interface IntegrationItem {
  id: string;
  label: string;
  status: 'optional' | 'required';
  description: string;
  setup: string[];
}

export interface IntegrationsSection {
  title: string;
  items: IntegrationItem[];
}

export interface DeployPlatform {
  id: string;
  label: string;
  steps: string[];
  note: string;
}

export interface DeploymentSection {
  title: string;
  recommended: string;
  platforms: DeployPlatform[];
  post_deploy_checklist: string[];
}

export interface ScriptItem {
  command: string;
  description: string;
}

export interface ScriptsSection {
  title: string;
  items: ScriptItem[];
}

export interface TemplateStrategyPhase {
  phase: number;
  label: string;
  tasks: string[];
}

export interface TemplateStrategySection {
  title: string;
  description: string;
  phases: TemplateStrategyPhase[];
}

export interface OnboardingData {
  meta: Meta;
  prerequisites: PrerequisitesSection;
  quickstart: QuickstartSection;
  environment: EnvironmentSection;
  database: DatabaseSection;
  customization: CustomizationSection;
  content: ContentSection;
  integrations: IntegrationsSection;
  deployment: DeploymentSection;
  scripts: ScriptsSection;
  template_strategy: TemplateStrategySection;
}

export type Role = 'VIEWER' | 'EDITOR' | 'ADMIN' | 'OWNER';
export type TeamRole = 'MEMBER' | 'ADMIN' | 'OWNER';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
export const ROLE_ORDER: Role[] = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'];

export const atLeast = (role: Role | undefined, min: Role) =>
  role !== undefined && ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(min);

export interface User {
  id: string;
  email: string;
  name: string;
  avatarColor: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  role: Role;
  memberCount: number;
  collectionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface Variable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
}

export type BodyMode = 'none' | 'json' | 'text' | 'xml' | 'html' | 'urlencoded' | 'form-data';

export interface RequestBody {
  mode: BodyMode;
  raw: string;
  fields: KeyValue[];
}

export type AuthType = 'inherit' | 'none' | 'bearer' | 'basic' | 'apikey';

export interface AuthConfig {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  value?: string;
  in?: 'header' | 'query';
}

export interface ResponseExample {
  id: string;
  name: string;
  status: number;
  body: string;
  contentType?: string | null;
  createdAt: string;
}

export interface ApiRequest {
  id: string;
  collectionId: string;
  folderId: string | null;
  name: string;
  method: HttpMethod;
  url: string;
  description: string;
  headers: KeyValue[];
  queryParams: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
  examples: ResponseExample[];
  sortOrder: number;
  updatedAt: string;
}

export type RequestDraft = Pick<
  ApiRequest,
  'name' | 'method' | 'url' | 'description' | 'headers' | 'queryParams' | 'body' | 'auth'
>;

export interface Folder {
  id: string;
  collectionId: string;
  parentId: string | null;
  name: string;
  description: string;
  sortOrder: number;
  updatedAt: string;
}

export interface Collection {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  variables: Variable[];
  auth: AuthConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionSummary {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  requestCount: number;
  updatedAt: string;
}

export interface CollectionDetail {
  collection: Collection;
  folders: Folder[];
  requests: ApiRequest[];
}

export interface Environment {
  id: string;
  workspaceId: string;
  name: string;
  variables: Variable[];
  global: boolean;
  updatedAt: string;
}

export interface Header {
  key: string;
  value: string;
}

export interface ExecuteResponse {
  status: number;
  statusText: string;
  headers: Header[];
  body: string;
  bodyEncoding: 'text' | 'base64';
  contentType: string | null;
  durationMs: number;
  size: number;
  truncated: boolean;
  error: string | null;
  /** Where the request was sent from (set by the client; not part of the server API). */
  via?: 'server' | 'agent' | 'browser';
}

export interface HistoryItem {
  id: string;
  requestId: string | null;
  requestName: string | null;
  method: HttpMethod;
  url: string;
  statusCode: number | null;
  durationMs: number | null;
  responseSize: number | null;
  createdAt: string;
}

export interface ShareLink {
  id: string;
  token: string;
  collectionId: string;
  enabled: boolean;
  active: boolean;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarColor: string | null;
  role: Role;
  createdAt: string;
}

export interface WorkspaceTeam {
  id: string;
  teamId: string;
  teamName: string;
  memberCount: number;
  role: Role;
  createdAt: string;
}

export interface JoinCode {
  /** Formatted like "K7QM-X2PD"; null when joining by code is disabled. */
  code: string | null;
  role: Role;
  enabled: boolean;
}

export interface MembersResponse {
  members: Member[];
  teams: WorkspaceTeam[];
  /** Only provided to admins. */
  joinCode: JoinCode | null;
}

export interface MergeResult {
  collection: Collection;
  requestsAdded: number;
  requestsUpdated: number;
  foldersAdded: number;
}

export type WsMessageFormat = 'text' | 'json';

export interface WsSavedMessage {
  id: string;
  name: string;
  body: string;
  format: WsMessageFormat;
}

export interface WebSocketConnection {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  protocols: string[];
  messages: WsSavedMessage[];
  updatedAt: string;
}

export type SnippetKind = 'NOTE' | 'CODE';

export interface Person {
  id: string;
  name: string;
  avatarColor: string | null;
}

export interface SnippetSummary {
  id: string;
  title: string;
  kind: SnippetKind;
  language: string | null;
  pinned: boolean;
  preview: string;
  createdBy: Person | null;
  updatedBy: Person | null;
  updatedAt: string;
  version: number;
}

export interface Snippet {
  id: string;
  workspaceId: string;
  title: string;
  kind: SnippetKind;
  language: string | null;
  content: string;
  pinned: boolean;
  createdBy: Person | null;
  updatedBy: Person | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  canDelete: boolean;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  myRole: TeamRole;
  memberCount: number;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarColor: string | null;
  role: TeamRole;
  createdAt: string;
}

export interface TeamDetail {
  team: Team;
  members: TeamMember[];
  workspaces: { workspaceId: string; workspaceName: string; role: Role }[];
}

export interface Activity {
  id: string;
  userId: string | null;
  userName: string;
  userColor: string | null;
  action: string;
  targetType: string;
  targetName: string | null;
  createdAt: string;
}

export interface ExportItem {
  type: 'folder' | 'request';
  name: string;
  description?: string | null;
  method?: string;
  url?: string;
  headers?: unknown;
  queryParams?: unknown;
  body?: unknown;
  auth?: unknown;
  examples?: unknown;
  items?: ExportItem[];
}

export interface ExportCollection {
  magidoc: string;
  name: string;
  description?: string | null;
  variables?: unknown;
  auth?: unknown;
  items: ExportItem[];
}

export interface PublicDocs {
  workspaceName: string;
  detail: CollectionDetail;
}

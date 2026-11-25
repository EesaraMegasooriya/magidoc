import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../lib/api';
import { normalizeRequest } from '../lib/request';
import { normalizeVars, uid } from '../lib/utils';
import type {
  Activity,
  ApiRequest,
  AuthConfig,
  Collection,
  CollectionDetail,
  CollectionSummary,
  Environment,
  ExecuteResponse,
  ExportCollection,
  Folder,
  HistoryItem,
  JoinCode,
  MergeResult,
  MembersResponse,
  PublicDocs,
  RequestDraft,
  ResponseExample,
  Role,
  ShareLink,
  Snippet,
  SnippetKind,
  SnippetSummary,
  Team,
  TeamDetail,
  TeamMember,
  TeamRole,
  User,
  Variable,
  WebSocketConnection,
  Workspace,
  WsSavedMessage,
} from '../types';

const get = <T,>(url: string) => api.get<T>(url).then((r) => r.data);

export const keys = {
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspace', id] as const,
  collections: (wsId: string) => ['collections', wsId] as const,
  collection: (id: string) => ['collection', id] as const,
  environments: (wsId: string) => ['environments', wsId] as const,
  history: (wsId: string) => ['history', wsId] as const,
  members: (wsId: string) => ['members', wsId] as const,
  activity: (wsId: string) => ['activity', wsId] as const,
  teams: ['teams'] as const,
  team: (id: string) => ['team', id] as const,
  shares: (colId: string) => ['shares', colId] as const,
  websockets: (wsId: string) => ['websockets', wsId] as const,
  snippets: (wsId: string) => ['snippets', wsId] as const,
  snippet: (id: string) => ['snippet', id] as const,
};

const normalizeCollection = (c: Collection): Collection => ({
  ...c,
  description: c.description ?? '',
  variables: normalizeVars(c.variables),
  auth: (c.auth && typeof c.auth === 'object' ? c.auth : { type: 'none' }) as AuthConfig,
});

export const normalizeDetail = (d: CollectionDetail): CollectionDetail => ({
  collection: normalizeCollection(d.collection),
  folders: d.folders,
  requests: d.requests.map(normalizeRequest),
});

/** Mutation helper: shows errors as toasts and invalidates the given keys on success. */
function useApiMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { invalidate?: (vars: TVars, result: TResult) => QueryKey[]; success?: string | ((r: TResult) => string) } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, vars) => {
      opts.invalidate?.(vars, result).forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(result) : opts.success);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---------------- Auth & profile ----------------

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }).then((r) => r.data),
  register: (name: string, email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/register', { name, email, password }).then((r) => r.data),
  resetPassword: (email: string, recoveryCode: string, newPassword: string) =>
    api.post<{ recoveryCodesRemaining: number }>('/auth/reset-password', { email, recoveryCode, newPassword }).then((r) => r.data),
};

export const useUpdateProfile = () =>
  useApiMutation((v: { name: string; avatarColor?: string }) => api.put<User>('/users/me', v).then((r) => r.data), {
    success: 'Profile updated',
  });

export const useChangePassword = () =>
  useApiMutation(
    (v: { currentPassword: string; newPassword: string }) =>
      api.put<{ token: string; user: User }>('/users/me/password', v).then((r) => r.data),
    { success: 'Password changed. Your other devices were signed out.' },
  );

export interface RecoveryStatus {
  remaining: number;
  total: number;
  generatedAt: string | null;
}

export const useRecoveryStatus = (enabled = true) =>
  useQuery({ queryKey: ['recovery-codes'], queryFn: () => get<RecoveryStatus>('/users/me/recovery-codes'), enabled });

export const useGenerateRecoveryCodes = () =>
  useApiMutation(
    (currentPassword: string) => api.post<{ codes: string[] }>('/users/me/recovery-codes', { currentPassword }).then((r) => r.data),
    { invalidate: () => [['recovery-codes']] },
  );

export const useSignOutEverywhere = () =>
  useApiMutation(() => api.post('/users/me/sessions/revoke'), { success: 'Signed out of all devices' });

// ---------------- Workspaces ----------------

export const useWorkspaces = () => useQuery({ queryKey: keys.workspaces, queryFn: () => get<Workspace[]>('/workspaces') });

export const useWorkspace = (id: string) =>
  useQuery({ queryKey: keys.workspace(id), queryFn: () => get<Workspace>(`/workspaces/${id}`), retry: false });

export const useCreateWorkspace = () =>
  useApiMutation((v: { name: string; description?: string }) => api.post<Workspace>('/workspaces', v).then((r) => r.data), {
    invalidate: () => [keys.workspaces],
    success: 'Workspace created',
  });

export const useUpdateWorkspace = (id: string) =>
  useApiMutation((v: { name: string; description?: string }) => api.put<Workspace>(`/workspaces/${id}`, v).then((r) => r.data), {
    invalidate: () => [keys.workspaces, keys.workspace(id), keys.activity(id)],
    success: 'Workspace saved',
  });

export const useDeleteWorkspace = () =>
  useApiMutation((id: string) => api.delete(`/workspaces/${id}`), { invalidate: () => [keys.workspaces], success: 'Workspace deleted' });

export const useLeaveWorkspace = () =>
  useApiMutation((id: string) => api.post(`/workspaces/${id}/leave`), { invalidate: () => [keys.workspaces], success: 'You left the workspace' });

export const useActivity = (wsId: string) =>
  useQuery({ queryKey: keys.activity(wsId), queryFn: () => get<Activity[]>(`/workspaces/${wsId}/activity?limit=60`) });

// ---------------- Members ----------------

export const useMembers = (wsId: string) =>
  useQuery({ queryKey: keys.members(wsId), queryFn: () => get<MembersResponse>(`/workspaces/${wsId}/members`) });

const memberKeys = (wsId: string) => [keys.members(wsId), keys.workspace(wsId), keys.activity(wsId), keys.workspaces];

export const useAddMember = (wsId: string) =>
  useApiMutation(
    (v: { email: string; role: Role }) => api.post<{ message: string }>(`/workspaces/${wsId}/members`, v).then((r) => r.data),
    { invalidate: () => memberKeys(wsId), success: (r) => r.message },
  );

export const useGenerateJoinCode = (wsId: string) =>
  useApiMutation((role: Role) => api.post<JoinCode>(`/workspaces/${wsId}/join-code`, { role }).then((r) => r.data), {
    invalidate: () => [keys.members(wsId), keys.activity(wsId)],
    success: 'New join code created',
  });

export const useUpdateJoinCodeRole = (wsId: string) =>
  useApiMutation((role: Role) => api.put<JoinCode>(`/workspaces/${wsId}/join-code`, { role }).then((r) => r.data), {
    invalidate: () => [keys.members(wsId)],
    success: 'Join role updated',
  });

export const useDisableJoinCode = (wsId: string) =>
  useApiMutation(() => api.delete(`/workspaces/${wsId}/join-code`), {
    invalidate: () => [keys.members(wsId), keys.activity(wsId)],
    success: 'Join code disabled',
  });

/** Joining shows errors inline in its dialog, so this hook doesn't toast. */
export const useJoinWorkspace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<Workspace>('/workspaces/join', { code }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspaces }),
  });
};

export const useUpdateMemberRole = (wsId: string) =>
  useApiMutation((v: { memberId: string; role: Role }) => api.put(`/workspaces/${wsId}/members/${v.memberId}`, { role: v.role }), {
    invalidate: () => memberKeys(wsId),
    success: 'Role updated',
  });

export const useRemoveMember = (wsId: string) =>
  useApiMutation((memberId: string) => api.delete(`/workspaces/${wsId}/members/${memberId}`), {
    invalidate: () => memberKeys(wsId),
    success: 'Member removed',
  });

export const useAddWorkspaceTeam = (wsId: string) =>
  useApiMutation((v: { teamId: string; role: Role }) => api.post(`/workspaces/${wsId}/teams`, v), {
    invalidate: () => [...memberKeys(wsId), keys.teams],
    success: 'Team added',
  });

export const useUpdateWorkspaceTeam = (wsId: string) =>
  useApiMutation((v: { id: string; role: Role }) => api.put(`/workspaces/${wsId}/teams/${v.id}`, { role: v.role }), {
    invalidate: () => memberKeys(wsId),
    success: 'Team role updated',
  });

export const useRemoveWorkspaceTeam = (wsId: string) =>
  useApiMutation((id: string) => api.delete(`/workspaces/${wsId}/teams/${id}`), { invalidate: () => memberKeys(wsId), success: 'Team removed' });

// ---------------- Teams ----------------

export const useTeams = () => useQuery({ queryKey: keys.teams, queryFn: () => get<Team[]>('/teams') });

export const useTeam = (id: string | null) =>
  useQuery({ queryKey: keys.team(id ?? ''), queryFn: () => get<TeamDetail>(`/teams/${id}`), enabled: !!id });

export const useCreateTeam = () =>
  useApiMutation((v: { name: string; description?: string }) => api.post<Team>('/teams', v).then((r) => r.data), {
    invalidate: () => [keys.teams],
    success: 'Team created',
  });

export const useUpdateTeam = (id: string) =>
  useApiMutation((v: { name: string; description?: string }) => api.put<Team>(`/teams/${id}`, v).then((r) => r.data), {
    invalidate: () => [keys.teams, keys.team(id)],
    success: 'Team saved',
  });

export const useDeleteTeam = () =>
  useApiMutation((id: string) => api.delete(`/teams/${id}`), { invalidate: () => [keys.teams, keys.workspaces], success: 'Team deleted' });

export const useAddTeamMember = (teamId: string) =>
  useApiMutation((v: { email: string; role: TeamRole }) => api.post<TeamMember>(`/teams/${teamId}/members`, v).then((r) => r.data), {
    invalidate: () => [keys.teams, keys.team(teamId)],
    success: (m) => `${m.name} added to the team`,
  });

export const useUpdateTeamMember = (teamId: string) =>
  useApiMutation((v: { memberId: string; role: TeamRole }) => api.put(`/teams/${teamId}/members/${v.memberId}`, { role: v.role }), {
    invalidate: () => [keys.team(teamId)],
    success: 'Role updated',
  });

export const useRemoveTeamMember = (teamId: string) =>
  useApiMutation((memberId: string) => api.delete(`/teams/${teamId}/members/${memberId}`), {
    invalidate: () => [keys.teams, keys.team(teamId), keys.workspaces],
  });

// ---------------- Collections ----------------

export const useCollections = (wsId: string) =>
  useQuery({ queryKey: keys.collections(wsId), queryFn: () => get<CollectionSummary[]>(`/workspaces/${wsId}/collections`) });

export const useCollection = (id: string | undefined) =>
  useQuery({
    queryKey: keys.collection(id ?? ''),
    queryFn: () => get<CollectionDetail>(`/collections/${id}`).then(normalizeDetail),
    enabled: !!id,
  });

const colKeys = (wsId: string, colId?: string) =>
  [keys.collections(wsId), keys.activity(wsId), keys.workspaces, ...(colId ? [keys.collection(colId)] : [])] as QueryKey[];

export const useCreateCollection = (wsId: string) =>
  useApiMutation((v: { name: string; description?: string }) => api.post<Collection>(`/workspaces/${wsId}/collections`, v).then((r) => r.data), {
    invalidate: () => colKeys(wsId),
    success: 'Collection created',
  });

export const useImportCollection = (wsId: string) =>
  useApiMutation((v: ExportCollection) => api.post<Collection>(`/workspaces/${wsId}/collections/import`, v).then((r) => r.data), {
    invalidate: () => colKeys(wsId),
    success: (c) => `Imported “${c.name}”`,
  });

const mergeMessage = (r: MergeResult) =>
  `“${r.collection.name}”: ${r.requestsAdded} added, ${r.requestsUpdated} updated${r.foldersAdded ? `, ${r.foldersAdded} folders added` : ''}`;

/** Imports several files as one collection, auto-merging overlapping folders and requests. */
export const useImportMerged = (wsId: string) =>
  useApiMutation(
    (v: { collections: ExportCollection[]; name?: string }) =>
      api.post<MergeResult>(`/workspaces/${wsId}/collections/import-merged`, v).then((r) => r.data),
    { invalidate: () => colKeys(wsId), success: mergeMessage },
  );

/** Merges files into an existing collection (matched items are updated in place). */
export const useMergeIntoCollection = (wsId: string) =>
  useApiMutation(
    (v: { collectionId: string; collections: ExportCollection[] }) =>
      api.post<MergeResult>(`/collections/${v.collectionId}/merge`, { collections: v.collections }).then((r) => r.data),
    { invalidate: (v) => colKeys(wsId, v.collectionId), success: mergeMessage },
  );

export const useUpdateCollection = (wsId: string) =>
  useApiMutation(
    (v: { id: string; name?: string; description?: string; variables?: Variable[]; auth?: AuthConfig }) => {
      const { id, ...body } = v;
      return api.put<Collection>(`/collections/${id}`, body).then((r) => r.data);
    },
    { invalidate: (v) => colKeys(wsId, v.id), success: 'Collection saved' },
  );

export const useDeleteCollection = (wsId: string) =>
  useApiMutation((id: string) => api.delete(`/collections/${id}`), { invalidate: () => colKeys(wsId), success: 'Collection deleted' });

export const useDuplicateCollection = (wsId: string) =>
  useApiMutation((id: string) => api.post<Collection>(`/collections/${id}/duplicate`).then((r) => r.data), {
    invalidate: () => colKeys(wsId),
    success: 'Collection duplicated',
  });

export const exportCollection = (id: string) => get<ExportCollection>(`/collections/${id}/export`);

// ---------------- Folders ----------------

export const useCreateFolder = (wsId: string) =>
  useApiMutation(
    (v: { collectionId: string; name: string; parentId?: string | null }) =>
      api.post<Folder>(`/collections/${v.collectionId}/folders`, { name: v.name, parentId: v.parentId ?? null }).then((r) => r.data),
    { invalidate: (v) => colKeys(wsId, v.collectionId) },
  );

export const useUpdateFolder = (wsId: string) =>
  useApiMutation(
    (v: { id: string; collectionId: string; name?: string; description?: string }) =>
      api.put<Folder>(`/folders/${v.id}`, { name: v.name, description: v.description }).then((r) => r.data),
    { invalidate: (v) => colKeys(wsId, v.collectionId) },
  );

export const useMoveFolder = (wsId: string) =>
  useApiMutation(
    (v: { id: string; collectionId: string; parentId: string | null }) => api.put(`/folders/${v.id}/move`, { parentId: v.parentId }),
    { invalidate: (v) => colKeys(wsId, v.collectionId) },
  );

export const useDeleteFolder = (wsId: string) =>
  useApiMutation((v: { id: string; collectionId: string }) => api.delete(`/folders/${v.id}`), {
    invalidate: (v) => colKeys(wsId, v.collectionId),
    success: 'Folder deleted',
  });

// ---------------- Requests ----------------

export const useCreateRequest = (wsId: string) =>
  useApiMutation(
    (v: { collectionId: string; folderId?: string | null; draft: Partial<RequestDraft> & { name: string } }) =>
      api
        .post<ApiRequest>(`/collections/${v.collectionId}/requests`, { ...v.draft, folderId: v.folderId ?? null })
        .then((r) => normalizeRequest(r.data)),
    { invalidate: (v) => colKeys(wsId, v.collectionId) },
  );

/** Saves a request and patches the cached collection in place (no refetch flicker). */
export const useSaveRequest = (wsId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; draft: Partial<RequestDraft>; examples?: ResponseExample[] }) =>
      api.put<ApiRequest>(`/requests/${v.id}`, { ...v.draft, examples: v.examples }).then((r) => normalizeRequest(r.data)),
    onSuccess: (saved) => {
      qc.setQueryData<CollectionDetail>(keys.collection(saved.collectionId), (old) =>
        old ? { ...old, requests: old.requests.map((r) => (r.id === saved.id ? saved : r)) } : old,
      );
      qc.invalidateQueries({ queryKey: keys.activity(wsId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
};

export const useMoveRequest = (wsId: string) =>
  useApiMutation(
    (v: { id: string; collectionId: string; folderId: string | null }) => api.put(`/requests/${v.id}/move`, { folderId: v.folderId }),
    { invalidate: (v) => colKeys(wsId, v.collectionId) },
  );

export const useDuplicateRequest = (wsId: string) =>
  useApiMutation(
    (v: { id: string; collectionId: string }) => api.post<ApiRequest>(`/requests/${v.id}/duplicate`).then((r) => normalizeRequest(r.data)),
    { invalidate: (v) => colKeys(wsId, v.collectionId) },
  );

export const useDeleteRequest = (wsId: string) =>
  useApiMutation((v: { id: string; collectionId: string }) => api.delete(`/requests/${v.id}`), {
    invalidate: (v) => colKeys(wsId, v.collectionId),
    success: 'Request deleted',
  });

// ---------------- Environments ----------------

export const useEnvironments = (wsId: string) =>
  useQuery({
    queryKey: keys.environments(wsId),
    queryFn: () =>
      get<Environment[]>(`/workspaces/${wsId}/environments`).then((list) =>
        list.map((e) => ({ ...e, variables: normalizeVars(e.variables) })),
      ),
  });

export const useCreateEnvironment = (wsId: string) =>
  useApiMutation(
    (v: { name: string; variables?: Variable[] }) => api.post<Environment>(`/workspaces/${wsId}/environments`, v).then((r) => r.data),
    { invalidate: () => [keys.environments(wsId), keys.activity(wsId)], success: 'Environment created' },
  );

export const useUpdateEnvironment = (wsId: string) =>
  useApiMutation(
    (v: { id: string; name?: string; variables?: Variable[] }) =>
      api.put<Environment>(`/environments/${v.id}`, { name: v.name, variables: v.variables }).then((r) => r.data),
    { invalidate: () => [keys.environments(wsId), keys.activity(wsId)], success: 'Environment saved' },
  );

export const useDuplicateEnvironment = (wsId: string) =>
  useApiMutation((id: string) => api.post<Environment>(`/environments/${id}/duplicate`).then((r) => r.data), {
    invalidate: () => [keys.environments(wsId)],
    success: 'Environment duplicated',
  });

export const useDeleteEnvironment = (wsId: string) =>
  useApiMutation((id: string) => api.delete(`/environments/${id}`), {
    invalidate: () => [keys.environments(wsId), keys.activity(wsId)],
    success: 'Environment deleted',
  });

// ---------------- WebSockets ----------------

const normalizeWs = (w: WebSocketConnection): WebSocketConnection => ({
  ...w,
  protocols: Array.isArray(w.protocols) ? w.protocols.filter((p) => typeof p === 'string') : [],
  messages: Array.isArray(w.messages)
    ? w.messages
        .filter((m) => m && typeof m === 'object')
        .map((m: Partial<WsSavedMessage>) => ({
          id: m.id || uid(),
          name: m.name || 'Message',
          body: m.body ?? '',
          format: m.format === 'json' ? ('json' as const) : ('text' as const),
        }))
    : [],
});

export const useWebSockets = (wsId: string) =>
  useQuery({
    queryKey: keys.websockets(wsId),
    queryFn: () => get<WebSocketConnection[]>(`/workspaces/${wsId}/websockets`).then((l) => l.map(normalizeWs)),
  });

export const useCreateWebSocket = (wsId: string) =>
  useApiMutation(
    (v: { name: string; url?: string }) =>
      api.post<WebSocketConnection>(`/workspaces/${wsId}/websockets`, v).then((r) => normalizeWs(r.data)),
    { invalidate: () => [keys.websockets(wsId), keys.activity(wsId)] },
  );

export const useUpdateWebSocket = (wsId: string) =>
  useApiMutation(
    (v: { id: string; name?: string; url?: string; protocols?: string[]; messages?: WsSavedMessage[] }) => {
      const { id, ...body } = v;
      return api.put<WebSocketConnection>(`/websockets/${id}`, body).then((r) => normalizeWs(r.data));
    },
    { invalidate: () => [keys.websockets(wsId), keys.activity(wsId)] },
  );

export const useDuplicateWebSocket = (wsId: string) =>
  useApiMutation((id: string) => api.post<WebSocketConnection>(`/websockets/${id}/duplicate`).then((r) => normalizeWs(r.data)), {
    invalidate: () => [keys.websockets(wsId)],
    success: 'Connection duplicated',
  });

export const useDeleteWebSocket = (wsId: string) =>
  useApiMutation((id: string) => api.delete(`/websockets/${id}`), {
    invalidate: () => [keys.websockets(wsId), keys.activity(wsId)],
    success: 'Connection deleted',
  });

// ---------------- Text space ----------------

/** Server-side search covers titles and full content. */
export const useSnippets = (wsId: string, q = '') =>
  useQuery({
    queryKey: [...keys.snippets(wsId), q],
    queryFn: () => get<SnippetSummary[]>(`/workspaces/${wsId}/snippets${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    placeholderData: keepPreviousData,
  });

export const useSnippet = (id: string) =>
  useQuery({ queryKey: keys.snippet(id), queryFn: () => get<Snippet>(`/snippets/${id}`), retry: false });

export const useCreateSnippet = (wsId: string) => {
  const qc = useQueryClient();
  return useApiMutation(
    (v: { title: string; kind: SnippetKind; language?: string; content?: string }) =>
      api.post<Snippet>(`/workspaces/${wsId}/snippets`, v).then((r) => r.data),
    { invalidate: (_v, s) => { qc.setQueryData(keys.snippet(s.id), s); return [keys.snippets(wsId), keys.activity(wsId)]; } },
  );
};

/** Version conflicts (409) are returned to the caller instead of toasted, so the UI can offer a resolution. */
export const useSaveSnippet = (wsId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; title: string; kind: SnippetKind; language: string | null; content: string; version: number }) => {
      const { id, ...body } = v;
      return api.put<Snippet>(`/snippets/${id}`, { ...body, language: body.kind === 'CODE' ? body.language ?? 'plaintext' : undefined }).then((r) => r.data);
    },
    onSuccess: (s) => {
      qc.setQueryData(keys.snippet(s.id), s);
      qc.invalidateQueries({ queryKey: keys.snippets(wsId) });
      qc.invalidateQueries({ queryKey: keys.activity(wsId) });
    },
    onError: (e) => {
      if (!(axios.isAxiosError(e) && e.response?.status === 409)) toast.error(errorMessage(e));
    },
  });
};

export const usePinSnippet = (wsId: string) => {
  const qc = useQueryClient();
  return useApiMutation((v: { id: string; pinned: boolean }) => api.put<Snippet>(`/snippets/${v.id}/pin`, { pinned: v.pinned }).then((r) => r.data), {
    invalidate: (_v, s) => { qc.setQueryData(keys.snippet(s.id), s); return [keys.snippets(wsId)]; },
    success: (s) => (s.pinned ? 'Pinned to the top' : 'Unpinned'),
  });
};

export const useDeleteSnippet = (wsId: string) =>
  useApiMutation((id: string) => api.delete(`/snippets/${id}`), {
    invalidate: () => [keys.snippets(wsId), keys.activity(wsId)],
    success: 'Text deleted',
  });

// ---------------- Execution & history ----------------

export interface ExecutePayload {
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  body: { mode: string; raw?: string; fields?: { key: string; value: string }[] };
  requestId?: string | null;
  requestName?: string;
  followRedirects?: boolean;
  timeoutMs?: number;
}

export const executeRequest = (wsId: string, payload: ExecutePayload) =>
  api.post<ExecuteResponse>(`/workspaces/${wsId}/execute`, payload).then((r) => r.data);

export const useHistory = (wsId: string) =>
  useQuery({ queryKey: keys.history(wsId), queryFn: () => get<HistoryItem[]>(`/workspaces/${wsId}/history?limit=150`) });

export const useClearHistory = (wsId: string) =>
  useApiMutation(() => api.delete(`/workspaces/${wsId}/history`), { invalidate: () => [keys.history(wsId)], success: 'History cleared' });

// ---------------- Sharing ----------------

export const useShares = (colId: string) =>
  useQuery({ queryKey: keys.shares(colId), queryFn: () => get<ShareLink[]>(`/collections/${colId}/shares`) });

export const useCreateShare = (wsId: string, colId: string) =>
  useApiMutation(
    (v: { expiresInDays?: number | null }) => api.post<ShareLink>(`/collections/${colId}/shares`, v).then((r) => r.data),
    { invalidate: () => [keys.shares(colId), keys.activity(wsId)], success: 'Public link created' },
  );

export const useUpdateShare = (colId: string) =>
  useApiMutation((v: { id: string; enabled: boolean }) => api.put<ShareLink>(`/shares/${v.id}`, { enabled: v.enabled }).then((r) => r.data), {
    invalidate: () => [keys.shares(colId)],
  });

export const useDeleteShare = (colId: string) =>
  useApiMutation((id: string) => api.delete(`/shares/${id}`), { invalidate: () => [keys.shares(colId)], success: 'Link revoked' });

export const usePublicDocs = (token: string) =>
  useQuery({
    queryKey: ['public', token],
    queryFn: () => get<PublicDocs>(`/public/docs/${token}`).then((d) => ({ ...d, detail: normalizeDetail(d.detail) })),
    retry: false,
  });

import clsx from 'clsx';
import { BookOpen, Box, ChevronsUpDown, FileUp, History, Layers, NotebookPen, PanelLeftClose, PanelLeftOpen, Plug, Plus, Search, Settings, ShieldAlert, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCollections, useWorkspace, useWorkspaces } from '../api/hooks';
import { AppHeader } from '../components/AppHeader';
import { LogoMark } from '../components/Logo';
import { Button, EmptyState, FullPageSpinner, Kbd, Menu, RoleBadge, Skeleton } from '../components/ui';
import { CollectionsPanel } from '../features/workspace/CollectionsPanel';
import { CollectionView } from '../features/workspace/CollectionView';
import { CommandPalette } from '../features/workspace/CommandPalette';
import { AgentSetupModal } from '../features/workspace/LocalAgent';
import { DocsTab } from '../features/workspace/DocsTab';
import { EnvironmentsPanel } from '../features/workspace/EnvironmentsPanel';
import { EnvironmentView } from '../features/workspace/EnvironmentView';
import { HistoryPanel } from '../features/workspace/HistoryPanel';
import { ImportModal } from '../features/workspace/ImportModal';
import { SavedRequestTab, ScratchTab } from '../features/workspace/RequestTabs';
import { SettingsView } from '../features/workspace/SettingsView';
import { SnippetsPanel } from '../features/workspace/SnippetsPanel';
import { SnippetView } from '../features/workspace/SnippetView';
import { TabBar, useNewScratch } from '../features/workspace/TabBar';
import { WebSocketsPanel } from '../features/workspace/WebSocketsPanel';
import { WebSocketView } from '../features/workspace/WebSocketView';
import { useWs, WorkspaceProvider } from '../features/workspace/context';
import { useWorkspaceStore, useWsState } from '../store/workspace';

type Panel = 'collections' | 'websockets' | 'texts' | 'environments' | 'history';

const SIDEBAR_KEY = 'magidoc-sidebar-open';
/** Short captions under rail icons (the full name is the tooltip / accessible label). */
const RAIL_SHORT: Record<string, string> = { Environments: 'Envs', WebSocket: 'Socket', 'Text space': 'Texts' };
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function WorkspacePage() {
  const { workspaceId = '' } = useParams();
  const { data: workspace, isLoading, isError } = useWorkspace(workspaceId);

  useEffect(() => {
    if (workspace) document.title = `${workspace.name} · MagiDoc`;
    return () => {
      document.title = 'MagiDoc';
    };
  }, [workspace]);

  if (isLoading) return <FullPageSpinner />;
  if (isError || !workspace) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader />
        <EmptyState
          icon={<ShieldAlert />}
          title="Workspace not available"
          description="It doesn't exist or you don't have access. Ask a workspace admin to invite you."
          action={
            <Link to="/">
              <Button variant="primary">Back to workspaces</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <WorkspaceProvider workspace={workspace}>
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
}

function WorkspaceSwitcher() {
  const { workspace } = useWs();
  const { data: all } = useWorkspaces();
  const navigate = useNavigate();
  return (
    <Menu
      width={260}
      items={[
        ...(all ?? []).map((w) => ({
          label: w.name,
          icon: <Box />,
          onClick: () => navigate(`/w/${w.id}`),
          hint: w.id === workspace.id ? '✓' : undefined,
        })),
        'divider' as const,
        { label: 'All workspaces', icon: <Layers />, onClick: () => navigate('/') },
      ]}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-[13px] font-medium transition-colors hover:bg-panel-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          aria-label="Switch workspace"
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-accent-soft text-[11px] font-semibold text-accent-fg">{workspace.name[0]?.toUpperCase()}</span>
          <span className="max-w-[10rem] truncate sm:max-w-[16rem]">{workspace.name}</span>
          <span className="hidden sm:inline-flex">
            <RoleBadge role={workspace.role} />
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-faint" />
        </button>
      )}
    />
  );
}

function readSidebarPref() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== 'false';
  } catch {
    return true;
  }
}

function WorkspaceLayout() {
  const { wsId, canAdmin } = useWs();
  const [panel, setPanel] = useState<Panel>('collections');
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarPref);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const openSettings = () => openTab(wsId, { kind: 'settings', id: 'settings', title: 'Settings' });
  const activeKey = useWsState(wsId).active;

  // On small screens the drawer closes as soon as something is opened from it.
  useEffect(() => setMobileOpen(false), [activeKey]);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setMobileOpen((v) => !v);
      return;
    }
    setSidebarOpen((v) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, String(!v));
      } catch {
        /* storage unavailable */
      }
      return !v;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key.toLowerCase() === 'b' && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSidebar]);

  const selectPanel = (p: Panel) => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setPanel(p);
      setMobileOpen(true);
      return;
    }
    if (p === panel && sidebarOpen) toggleSidebar();
    else {
      setPanel(p);
      if (!sidebarOpen) toggleSidebar();
    }
  };

  const rail: { id: Panel; label: string; icon: ReactNode }[] = [
    { id: 'collections', label: 'Collections', icon: <Box /> },
    { id: 'websockets', label: 'WebSocket', icon: <Plug /> },
    { id: 'texts', label: 'Text space', icon: <NotebookPen /> },
    { id: 'environments', label: 'Environments', icon: <Layers /> },
    { id: 'history', label: 'History', icon: <History /> },
  ];

  const panelContent = (
    <>
      {panel === 'collections' && <CollectionsPanel />}
      {panel === 'websockets' && <WebSocketsPanel />}
      {panel === 'texts' && <SnippetsPanel />}
      {panel === 'environments' && <EnvironmentsPanel />}
      {panel === 'history' && <HistoryPanel />}
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        showNav={false}
        left={<WorkspaceSwitcher />}
        right={
          <>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-8 w-64 items-center gap-2 rounded-lg border border-line-strong bg-panel-2 px-2.5 text-[13px] text-faint transition-colors hover:border-faint/60 hover:text-muted cursor-pointer md:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              aria-label="Search (command palette)"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">Search…</span>
              <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd>K</Kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-panel-3 hover:text-fg md:hidden cursor-pointer"
              aria-label="Search"
            >
              <Search className="size-4" />
            </button>
            <Button size="md" variant="secondary" icon={canAdmin ? <UserPlus /> : <Users />} onClick={openSettings} className="hidden sm:inline-flex">
              {canAdmin ? 'Invite' : 'Members'}
            </Button>
          </>
        }
      />
      <div className="relative flex min-h-0 flex-1">
        {/* Navigation rail */}
        <nav className="flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-2" aria-label="Workspace">
          <RailButton label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'} shortcut={`${isMac ? '⌘' : 'Ctrl+'}B`} onClick={toggleSidebar} className="hidden md:flex">
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </RailButton>
          <div className="my-1 hidden h-px w-6 bg-line md:block" />
          {rail.map((r) => (
            <RailButton key={r.id} label={r.label} active={panel === r.id && (sidebarOpen || mobileOpen)} onClick={() => selectPanel(r.id)} showLabel>
              {r.icon}
            </RailButton>
          ))}
          <div className="flex-1" />
          <RailButton label="Settings" onClick={openSettings} showLabel>
            <Settings />
          </RailButton>
        </nav>

        {/* Desktop sidebar */}
        {sidebarOpen && <aside className="hidden w-[280px] shrink-0 border-r border-line bg-panel md:block">{panelContent}</aside>}

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Sidebar">
            <div className="absolute inset-0 bg-overlay" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] border-r border-line bg-panel shadow-2xl">
              {panelContent}
            </aside>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col bg-bg">
          <TabBar />
          <div className="min-h-0 flex-1">
            <ActiveTab onImport={() => setImportOpen(true)} onSearch={() => setPaletteOpen(true)} />
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onImport={() => setImportOpen(true)} />
      <AgentSetupModal />
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function RailButton({
  label,
  shortcut,
  active,
  onClick,
  children,
  className,
  showLabel,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        'relative flex w-12 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-colors cursor-pointer [&_svg]:size-[18px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        active ? 'bg-accent-soft text-accent-fg' : 'text-muted hover:bg-panel-3 hover:text-fg',
        className,
      )}
    >
      {active && <span className="absolute -left-1.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
      {children}
      {showLabel && <span className="text-[9.5px] font-medium leading-tight">{RAIL_SHORT[label] ?? label}</span>}
    </button>
  );
}

function ActiveTab({ onImport, onSearch }: { onImport: () => void; onSearch: () => void }) {
  const { wsId } = useWs();
  const { tabs, active } = useWsState(wsId);
  const tab = tabs.find((t) => t.key === active);
  if (!tab) return <Welcome onImport={onImport} onSearch={onSearch} />;
  switch (tab.kind) {
    case 'request':
      return <SavedRequestTab key={tab.key} tab={tab} />;
    case 'scratch':
      return <ScratchTab key={tab.key} tab={tab} />;
    case 'collection':
      return <CollectionView key={tab.key} tab={tab} />;
    case 'environment':
      return <EnvironmentView key={tab.key} tab={tab} />;
    case 'docs':
      return <DocsTab key={tab.key} tab={tab} />;
    case 'websocket':
      return <WebSocketView key={tab.key} tab={tab} />;
    case 'snippet':
      return <SnippetView key={tab.key} tab={tab} />;
    case 'settings':
      return <SettingsView />;
  }
}

function Welcome({ onImport, onSearch }: { onImport: () => void; onSearch: () => void }) {
  const { wsId, workspace, canEdit } = useWs();
  const newScratch = useNewScratch();
  const openTab = useWorkspaceStore((s) => s.openTab);
  const { data: collections } = useCollections(wsId);
  const first = collections?.[0];

  const action = (icon: ReactNode, title: string, text: string, onClick: () => void, kbd?: string) => (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl border border-line bg-panel p-4 text-left shadow-xs transition hover:border-line-strong hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-sm font-medium text-fg">
          {title}
          {kbd && <span className="hidden text-[11px] font-normal text-faint lg:inline">{kbd}</span>}
        </span>
        <span className="mt-0.5 block text-[13px] text-muted">{text}</span>
      </span>
    </button>
  );

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6 sm:p-10">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <LogoMark size={44} className="mx-auto" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">{workspace.name}</h1>
          <p className="mt-1.5 text-sm text-muted">{workspace.description || 'Design, test and document your APIs.'}</p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {action(<Plus />, 'New request', 'Start testing an endpoint right away.', () => newScratch())}
          {action(<Search />, 'Find anything', 'Jump to any request, collection or environment.', onSearch, isMac ? '⌘K' : 'Ctrl+K')}
          {canEdit && action(<FileUp />, 'Import', 'Postman, OpenAPI, Swagger or a cURL command.', onImport)}
          {/* Wait for collections so the card doesn't flicker from "Invite" to "Browse docs". */}
          {collections === undefined ? (
            <div className="flex items-start gap-3 rounded-xl border border-line bg-panel p-4" aria-hidden="true">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ) : first
            ? action(<BookOpen />, 'Browse docs', `Preview “${first.name}” as your readers see it.`, () => openTab(wsId, { kind: 'docs', id: first.id, title: `Docs · ${first.name}` }))
            : action(<Users />, 'Invite your team', 'Collaborate with roles and teams.', () => openTab(wsId, { kind: 'settings', id: 'settings', title: 'Settings' }))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
          <span className="flex items-center gap-1.5"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>↵</Kbd> Send</span>
          <span className="flex items-center gap-1.5"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>S</Kbd> Save</span>
          <span className="flex items-center gap-1.5"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd> Search</span>
          <span className="flex items-center gap-1.5"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>B</Kbd> Sidebar</span>
        </div>
      </div>
    </div>
  );
}

export type ViewMode = 'all' | 'active' | 'favorites';

export interface SelectedEvent {
  id: string;
  eventId?: string;
  tour: string;
  name: string;
}

export interface CompetitorIdentity {
  id: string;
  status: string;
  name: string;
}

export interface LeaderboardMeta {
  id: string;
  tour: string;
  name: string;
  currentRound: number | null;
  location: string;
  cityState: string;
  purse: string | number;
  isLive: boolean;
  competitorMap: Record<string, CompetitorIdentity>;
  competitorMapById: Record<string, CompetitorIdentity>;
}

export interface EventSelectorOption {
  id: string;
  tour: string;
  tourName: string;
  name: string;
  status: string;
  currentRound: number | null;
  leaderText: string;
  location: string;
  courseName: string;
  isLive: boolean;
}

export interface PlayerRow {
  COMP_ID: string;
  POS: string;
  PLAYER: string;
  SCORE: string;
  TODAY: string;
  THRU: string;
  R1: string;
  R2: string;
  R3: string;
  R4: string;
  TOT: string;
  CTRY?: string;
}

export interface StatSource {
  name?: string;
  displayName?: string;
  displayValue?: string | number | null;
  value?: string | number | null;
}

export interface RoundSummary {
  period?: number;
  displayValue?: string;
  outScore?: number | string | null;
  inScore?: number | string | null;
  startTee?: number | string | null;
  teeTime?: string;
  linescores?: any[];
  statistics?: any[];
}

export interface CompetitorSummary {
  rounds?: RoundSummary[];
  stats?: StatSource[];
  [key: string]: any;
}

export interface DetailContent {
  header: string;
  body: string;
}

export interface AppState {
  playerList: PlayerRow[];
  filteredPlayerList: PlayerRow[];
  leaderboardMeta: LeaderboardMeta | null;
  scorecardSelectionTimeout: NodeJS.Timeout | null;
  suppressSelectionEvents: boolean;
  playerJumpBuffer: string;
  playerJumpTimeout: NodeJS.Timeout | null;
  detailViewOpen: boolean;
  playerViewMode: ViewMode;
  refreshTimer: NodeJS.Timeout | null;
  isUpdatingLeaderboard: boolean;
  refreshRequestedWhileUpdating: boolean;
  currentRefreshIntervalMillis: number;
  scorecardCollapsed: boolean;
  eventSelectorOpen: boolean;
  isLoadingEventSelector: boolean;
  eventSelectorOptions: EventSelectorOption[];
  eventSelectorCards: any[];
  selectedEventSelectorIndex: number;
  selectedEvent: SelectedEvent | null;
  eventSelectorShowingLiveOnly: boolean;
  eventSelectorGridColumns: number;
  eventSelectorLastLoadedAt: number;
  eventSelectorLoadPromise: Promise<EventSelectorOption[]> | null;
  eventSelectorCardLayoutKey: string;
  favoritePlayersByEvent: Record<string, Record<string, boolean>>;
  scorecardCache: Record<string, CompetitorSummary>;
}

export interface Widgets {
  screen: any;
  grid: any;
  table: any;
  topInfoBar: any;
  scorecardBox: any;
  detailBox: any;
  detailHeaderBox: any;
  detailContentBox: any;
  shortcutBar: any;
  eventSelectorBox: any;
}

export interface LeaderboardResponse {
  meta: LeaderboardMeta;
  rows: PlayerRow[];
}

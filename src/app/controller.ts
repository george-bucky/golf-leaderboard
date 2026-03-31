import _ from 'lodash';
import {
  eventSelectorCacheMillis,
  idleUpdateFrequencyMillis,
  liveUpdateFrequencyMillis,
  minimumSupportedNodeMajor,
  PLAYER_VIEW_MODES,
  playerJumpResetMillis
} from '../config/constants';
import {
  fetchCompetitorSummary,
  fetchEventSelectorOptions,
  fetchLeaderboardData
} from '../data/espn';
import { buildVisiblePlayerRow, getEmptyPlayerViewMessage } from '../format/leaderboard';
import { buildDetailHeader, formatCompactScorecard, formatFullScreenDetail } from '../format/scorecard';
import {
  clearScorecardCache,
  createAppState,
  findCompetitorForPlayerRow,
  isFavoritePlayer,
  playerMatchesCurrentView,
  toggleFavoritePlayer
} from '../state/store';
import { AppState, DetailContent, Widgets } from '../types';
import { closeDetailOverlay, openDetailOverlay, showDetailContent as setDetailContent } from '../ui/detailView';
import { updateShortcutBar as renderShortcutBar, updateTopInfoBar as renderTopInfoBar } from '../ui/bars';
import {
  clearEventSelectorCards,
  moveEventSelectorSelection,
  renderEventSelector as renderEventSelectorPanel
} from '../ui/eventSelector';
import { applyResponsiveLayout, createLayout } from '../ui/layout';
import { normalizeName } from '../utils/text';

class AppController {
  private readonly state: AppState;

  private readonly widgets: Widgets;

  constructor() {
    this.state = createAppState();
    this.widgets = createLayout({
      onCloseDetail: () => this.closeDetailView(),
      onTableSelect: (index) => this.onTableSelect(index),
      onTableAction: (index) => this.onTableAction(index),
      onTableKeypress: (ch, key) => this.handlePlayerJumpKeypress(ch, key)
    });
  }

  init(): void {
    this.bindKeys();
    applyResponsiveLayout(this.widgets, this.state);
    this.updateShortcutBar();
    this.widgets.eventSelectorBox.focus();
    this.widgets.screen.render();

    this.widgets.screen.on('resize', () => {
      applyResponsiveLayout(this.widgets, this.state);
      this.updateTopInfoBar();
      if (this.state.eventSelectorOpen) {
        this.renderEventSelector();
      } else if (!this.state.scorecardCollapsed && this.state.filteredPlayerList.length) {
        this.scheduleScorecardLoad(this.widgets.table.rows.selected || 0);
      }
      this.widgets.screen.render();
    });

    if (!this.isNodeVersionSupported()) {
      this.showNodeVersionMessage();
      return;
    }

    this.openEventSelector();
  }

  private bindKeys(): void {
    this.widgets.screen.key(['C-c'], () => process.exit(0));
    this.widgets.screen.key(['escape'], () => {
      if (this.state.eventSelectorOpen) {
        return;
      }
      if (this.state.detailViewOpen) {
        this.closeDetailView();
      }
      this.jumpToTopLeaderboard();
    });
    this.widgets.screen.key(['`'], () => {
      if (this.state.eventSelectorOpen) {
        this.loadEventSelectorOptions({ forceRefresh: true });
        return;
      }
      this.requestLeaderboardUpdate();
    });
    this.widgets.screen.key(['/'], () => {
      if (this.state.detailViewOpen || this.state.eventSelectorOpen) {
        return;
      }
      this.cyclePlayerViewMode();
    });
    this.widgets.screen.key([';'], () => {
      if (this.state.detailViewOpen || this.state.eventSelectorOpen) {
        return;
      }
      this.toggleFavoriteForSelectedPlayer();
    });
    this.widgets.screen.key(['1'], () => {
      if (this.state.detailViewOpen) {
        this.closeDetailView();
      }
      this.openEventSelector();
    });
    this.widgets.screen.key(['up', 'k'], () => this.moveEventSelectorVertical(-1));
    this.widgets.screen.key(['down', 'j'], () => this.moveEventSelectorVertical(1));
    this.widgets.screen.key(['left', 'h'], () => this.moveEventSelectorHorizontal(-1));
    this.widgets.screen.key(['right', 'l'], () => this.moveEventSelectorHorizontal(1));
    this.widgets.screen.key(['enter'], () => {
      if (!this.state.eventSelectorOpen || !this.state.eventSelectorOptions.length) {
        return;
      }
      this.activateSelectedEvent();
    });
  }

  private isNodeVersionSupported(): boolean {
    const major = parseInt(`${_.get(process, 'versions.node', '0')}`.split('.')[0], 10);
    return Number.isInteger(major) && major >= minimumSupportedNodeMajor;
  }

  private showNodeVersionMessage(): void {
    const version = `${process.version || 'unknown'}`;
    this.widgets.topInfoBar.setContent(`Node ${version} is too old. Use Node ${minimumSupportedNodeMajor}+.`);
    this.widgets.scorecardBox.setContent('Please switch to Node 20+ (example: nvm use 20), then restart.');
    this.widgets.screen.render();
  }

  private onTableSelect(index: number): void {
    if (this.state.suppressSelectionEvents) {
      return;
    }
    this.scheduleScorecardLoad(index);
  }

  private onTableAction(index: number): void {
    if (this.state.scorecardSelectionTimeout) {
      clearTimeout(this.state.scorecardSelectionTimeout);
      this.state.scorecardSelectionTimeout = null;
    }
    this.openDetailView(index);
  }

  private updateTopInfoBar(): void {
    renderTopInfoBar(this.widgets, this.state);
  }

  private updateShortcutBar(): void {
    renderShortcutBar(this.widgets, this.state);
  }

  private renderEventSelector(): void {
    renderEventSelectorPanel(this.widgets, this.state);
  }

  private updateLeaderboard(): void {
    const selectedPlayerNameBeforeUpdate = this.getSelectedPlayerName();
    this.state.isUpdatingLeaderboard = true;
    fetchLeaderboardData(this.state.selectedEvent || undefined)
      .then((response) => {
        this.state.leaderboardMeta = response.meta;
        this.state.selectedEvent = {
          id: response.meta.id,
          tour: response.meta.tour,
          name: response.meta.name
        };
        this.state.currentRefreshIntervalMillis = this.getRefreshIntervalMillis(response.meta);
        this.state.playerList = response.rows || [];
        clearScorecardCache(this.state);

        const now = new Date();
        const refreshFrequencyMins = Math.round(this.state.currentRefreshIntervalMillis / 60000);
        const liveStatusText = response.meta?.isLive ? 'live' : 'not live';
        this.widgets.table.setLabel({
          text: `Last updated: ${now.getHours()}:${now.getMinutes() < 10 ? 0 : ''}${now.getMinutes()} (${liveStatusText}, refresh ${refreshFrequencyMins}m)`,
          side: 'right'
        });
        this.updateTopInfoBar();
        this.refilter('', { preferredPlayerName: selectedPlayerNameBeforeUpdate });
      })
      .catch(() => {
        this.state.currentRefreshIntervalMillis = idleUpdateFrequencyMillis;
        const hasExistingRows = this.state.playerList.length > 0;
        const hasExistingMeta = !!this.state.leaderboardMeta;
        this.widgets.scorecardBox.setContent(
          hasExistingRows ? 'Refresh failed. Showing last successful leaderboard.' : 'Unable to refresh leaderboard right now.'
        );
        if (!hasExistingMeta) {
          this.widgets.topInfoBar.setContent('Unable to load event info.');
        }
        this.widgets.screen.render();
      })
      .finally(() => {
        this.state.isUpdatingLeaderboard = false;
        if (this.state.refreshRequestedWhileUpdating) {
          this.state.refreshRequestedWhileUpdating = false;
          this.requestLeaderboardUpdate();
          return;
        }
        this.scheduleNextRefresh();
      });
  }

  private requestLeaderboardUpdate(): void {
    if (this.state.eventSelectorOpen) {
      return;
    }
    if (this.state.isUpdatingLeaderboard) {
      this.state.refreshRequestedWhileUpdating = true;
      return;
    }
    if (this.state.refreshTimer) {
      clearTimeout(this.state.refreshTimer);
      this.state.refreshTimer = null;
    }
    if (this.state.selectedEvent?.name) {
      this.widgets.topInfoBar.setContent(`Loading ${this.state.selectedEvent.name}...`);
      this.widgets.screen.render();
    }
    this.updateLeaderboard();
  }

  private scheduleNextRefresh(): void {
    if (this.state.refreshTimer) {
      clearTimeout(this.state.refreshTimer);
    }
    this.state.refreshTimer = setTimeout(() => {
      this.state.refreshTimer = null;
      this.requestLeaderboardUpdate();
    }, this.state.currentRefreshIntervalMillis);
  }

  private getRefreshIntervalMillis(meta: { isLive?: boolean } | null): number {
    return meta?.isLive ? liveUpdateFrequencyMillis : idleUpdateFrequencyMillis;
  }

  private openEventSelector(): void {
    this.state.eventSelectorOpen = true;
    if (this.state.refreshTimer) {
      clearTimeout(this.state.refreshTimer);
      this.state.refreshTimer = null;
    }
    applyResponsiveLayout(this.widgets, this.state);
    this.updateTopInfoBar();
    this.updateShortcutBar();
    this.renderEventSelector();
    this.widgets.eventSelectorBox.focus();
    this.widgets.screen.render();
    this.loadEventSelectorOptions();
  }

  private loadEventSelectorOptions(options?: { forceRefresh?: boolean }): Promise<any> {
    const hasFreshCache = this.state.eventSelectorOptions.length > 0 &&
      (Date.now() - this.state.eventSelectorLastLoadedAt) < eventSelectorCacheMillis;
    if (!options?.forceRefresh && hasFreshCache) {
      this.updateTopInfoBar();
      this.renderEventSelector();
      this.widgets.screen.render();
      return Promise.resolve(this.state.eventSelectorOptions);
    }

    if (this.state.isLoadingEventSelector) {
      return this.state.eventSelectorLoadPromise || Promise.resolve(this.state.eventSelectorOptions);
    }

    this.state.isLoadingEventSelector = true;
    this.updateTopInfoBar();
    if (!this.state.eventSelectorOptions.length) {
      this.renderEventSelector();
    }
    this.widgets.screen.render();

    this.state.eventSelectorLoadPromise = fetchEventSelectorOptions()
      .then((optionsList) => {
        this.state.eventSelectorOptions = optionsList || [];
        this.state.eventSelectorLastLoadedAt = Date.now();
        this.state.eventSelectorShowingLiveOnly = _.some(this.state.eventSelectorOptions, (entry) => !!entry.isLive);

        if (this.state.selectedEvent?.id) {
          const selectedIndex = _.findIndex(
            this.state.eventSelectorOptions,
            (entry) => `${entry.id}` === `${this.state.selectedEvent?.id}`
          );
          if (selectedIndex >= 0) {
            this.state.selectedEventSelectorIndex = selectedIndex;
          }
        }

        if (this.state.selectedEventSelectorIndex >= this.state.eventSelectorOptions.length) {
          this.state.selectedEventSelectorIndex = Math.max(0, this.state.eventSelectorOptions.length - 1);
        }

        return this.state.eventSelectorOptions;
      })
      .catch(() => {
        if (!this.state.eventSelectorOptions.length) {
          this.state.eventSelectorShowingLiveOnly = true;
          this.state.eventSelectorOptions = [];
          this.state.selectedEventSelectorIndex = 0;
          this.state.eventSelectorLastLoadedAt = 0;
        }
        return this.state.eventSelectorOptions;
      })
      .finally(() => {
        this.state.isLoadingEventSelector = false;
        this.state.eventSelectorLoadPromise = null;
        this.updateTopInfoBar();
        this.renderEventSelector();
        this.widgets.screen.render();
      });

    return this.state.eventSelectorLoadPromise;
  }

  private moveEventSelectorHorizontal(delta: number): void {
    if (!this.state.eventSelectorOpen || !this.state.eventSelectorOptions.length) {
      return;
    }
    moveEventSelectorSelection(this.widgets, this.state, this.state.selectedEventSelectorIndex + delta);
  }

  private moveEventSelectorVertical(deltaRows: number): void {
    if (!this.state.eventSelectorOpen || !this.state.eventSelectorOptions.length) {
      return;
    }
    const columns = Math.max(1, this.state.eventSelectorGridColumns || 1);
    moveEventSelectorSelection(this.widgets, this.state, this.state.selectedEventSelectorIndex + (deltaRows * columns));
  }

  private activateSelectedEvent(): void {
    const chosen = this.state.eventSelectorOptions[this.state.selectedEventSelectorIndex];
    if (!chosen) {
      return;
    }

    this.state.selectedEvent = { id: chosen.id, eventId: chosen.id, tour: chosen.tour, name: chosen.name };
    this.state.playerViewMode = PLAYER_VIEW_MODES[0];
    this.state.eventSelectorOpen = false;
    clearEventSelectorCards(this.state);
    applyResponsiveLayout(this.widgets, this.state);
    this.updateTopInfoBar();
    this.updateShortcutBar();
    this.widgets.table.focus();
    this.widgets.screen.render();
    this.requestLeaderboardUpdate();
  }

  private refilter(filterText: string, options?: { preferredPlayerName?: string }): void {
    const preferredPlayerName = options?.preferredPlayerName || this.getSelectedPlayerName();

    this.state.filteredPlayerList = _.filter(this.state.playerList, (player) => {
      const nameMatches = !!(
        player &&
        player.PLAYER &&
        player.PLAYER.toUpperCase().indexOf((filterText || '').toUpperCase()) !== -1
      );
      if (!nameMatches) {
        return false;
      }
      return playerMatchesCurrentView(this.state, player);
    });

    const visibleRows = _.map(
      this.state.filteredPlayerList,
      (row) => buildVisiblePlayerRow(row, isFavoritePlayer(this.state, row))
    );
    const fallbackRow = this.state.playerList.length
      ? [buildVisiblePlayerRow(this.state.playerList[0], isFavoritePlayer(this.state, this.state.playerList[0]))]
      : [];
    const rowSource = visibleRows.length ? visibleRows : fallbackRow;
    const tableData = _.map(visibleRows, (row) => _.values(row));

    const header = _.keys(rowSource[0] || {});
    this.adjustTableColumnWidths(header);
    this.state.suppressSelectionEvents = true;
    this.widgets.table.setData({ data: tableData, headers: header });
    const preferredIndex = this.findPlayerIndexByName(preferredPlayerName);
    const selectedIndex = preferredIndex >= 0 ? preferredIndex : 0;
    if (this.state.filteredPlayerList.length) {
      this.widgets.table.rows.select(selectedIndex);
    }
    this.state.suppressSelectionEvents = false;

    if (this.state.filteredPlayerList.length) {
      this.scheduleScorecardLoad(selectedIndex);
    } else {
      this.widgets.scorecardBox.setContent(getEmptyPlayerViewMessage(this.state.playerViewMode));
    }

    this.updateTopInfoBar();
    this.updateShortcutBar();
    this.widgets.screen.render();
  }

  private adjustTableColumnWidths(headers: string[]): void {
    if (!Array.isArray(headers)) {
      return;
    }
    this.widgets.table.options.columnWidth = headers.map(() => 8);
    const favoriteColumnIndex = headers.indexOf('FAV');
    if (favoriteColumnIndex >= 0) {
      this.widgets.table.options.columnWidth[favoriteColumnIndex] = 3;
    }
    const playerColumnIndex = headers.indexOf('PLAYER');
    if (playerColumnIndex >= 0) {
      this.widgets.table.options.columnWidth[playerColumnIndex] = 24;
    }
  }

  private scheduleScorecardLoad(index: number): void {
    if (this.state.scorecardCollapsed) {
      return;
    }
    if (this.state.scorecardSelectionTimeout) {
      clearTimeout(this.state.scorecardSelectionTimeout);
    }
    this.state.scorecardSelectionTimeout = setTimeout(() => this.showScorecard(index), 200);
  }

  private jumpToTopLeaderboard(): void {
    if (!this.state.filteredPlayerList.length) {
      return;
    }

    if (this.state.scorecardSelectionTimeout) {
      clearTimeout(this.state.scorecardSelectionTimeout);
      this.state.scorecardSelectionTimeout = null;
    }

    this.widgets.table.rows.select(0);
    this.widgets.table.focus();
    this.scheduleScorecardLoad(0);
    this.widgets.screen.render();
  }

  private getSelectedPlayerName(): string {
    if (!this.state.filteredPlayerList.length) {
      return '';
    }
    const selectedIndex = this.widgets.table.rows.selected || 0;
    return _.get(this.state.filteredPlayerList[selectedIndex], 'PLAYER', '');
  }

  private handlePlayerJumpKeypress(ch: string, key: any): void {
    if (!this.state.filteredPlayerList.length || this.widgets.screen.focused !== this.widgets.table.rows) {
      return;
    }

    if (key && (key.name === 'backspace' || key.name === 'delete')) {
      this.state.playerJumpBuffer = this.state.playerJumpBuffer.slice(0, -1);
      this.jumpToPlayerByPrefix(this.state.playerJumpBuffer);
      this.resetPlayerJumpTimer();
      return;
    }

    if (!ch || !/^[a-zA-Z '\.-]$/.test(ch)) {
      return;
    }

    this.state.playerJumpBuffer += ch;
    this.jumpToPlayerByPrefix(this.state.playerJumpBuffer);
    this.resetPlayerJumpTimer();
  }

  private resetPlayerJumpTimer(): void {
    if (this.state.playerJumpTimeout) {
      clearTimeout(this.state.playerJumpTimeout);
    }
    this.state.playerJumpTimeout = setTimeout(() => {
      this.state.playerJumpBuffer = '';
      this.state.playerJumpTimeout = null;
    }, playerJumpResetMillis);
  }

  private jumpToPlayerByPrefix(prefix: string): void {
    if (!prefix) {
      return;
    }

    const normalizedPrefix = normalizeName(prefix);
    const currentIndex = this.widgets.table.rows.selected || 0;

    let targetIndex = this.findPlayerIndexByPrefix(normalizedPrefix, currentIndex + 1, this.state.filteredPlayerList.length);
    if (targetIndex === -1) {
      targetIndex = this.findPlayerIndexByPrefix(normalizedPrefix, 0, currentIndex + 1);
    }

    if (targetIndex === -1) {
      return;
    }

    this.widgets.table.rows.select(targetIndex);
    this.scheduleScorecardLoad(targetIndex);
    this.widgets.screen.render();
  }

  private findPlayerIndexByPrefix(normalizedPrefix: string, startIndex: number, endIndex: number): number {
    for (let index = startIndex; index < endIndex; index += 1) {
      const playerName = _.get(this.state.filteredPlayerList[index], 'PLAYER', '');
      if (normalizeName(playerName).indexOf(normalizedPrefix) === 0) {
        return index;
      }
    }
    return -1;
  }

  private findPlayerIndexByName(playerName: string): number {
    if (!playerName) {
      return -1;
    }
    const normalizedName = normalizeName(playerName);
    for (let index = 0; index < this.state.filteredPlayerList.length; index += 1) {
      const listName = _.get(this.state.filteredPlayerList[index], 'PLAYER', '');
      if (normalizeName(listName) === normalizedName) {
        return index;
      }
    }
    return -1;
  }

  private showScorecard(index: number): void {
    if (this.state.scorecardCollapsed) {
      return;
    }

    const selected = this.state.filteredPlayerList[index];
    if (!selected?.PLAYER) {
      return;
    }

    const competitor = findCompetitorForPlayerRow(this.state, selected);
    if (!competitor?.id || !this.state.leaderboardMeta) {
      this.widgets.scorecardBox.setContent(`No scorecard data found for ${selected.PLAYER}.`);
      this.widgets.screen.render();
      return;
    }

    const cacheKey = `${this.state.leaderboardMeta.id}:${competitor.id}`;
    if (this.state.scorecardCache[cacheKey]) {
      this.widgets.scorecardBox.setContent(formatCompactScorecard(selected, this.state.scorecardCache[cacheKey]));
      this.widgets.screen.render();
      return;
    }

    this.widgets.scorecardBox.setContent(`Loading ${selected.PLAYER} scorecard...`);
    this.widgets.screen.render();

    fetchCompetitorSummary(
      this.state.leaderboardMeta.tour,
      this.state.leaderboardMeta.id,
      competitor.id,
      this.state.selectedEvent?.tour
    )
      .then((summary) => {
        this.state.scorecardCache[cacheKey] = summary;
        this.widgets.scorecardBox.setContent(formatCompactScorecard(selected, summary));
        this.widgets.screen.render();
      })
      .catch(() => {
        this.widgets.scorecardBox.setContent(`Unable to load scorecard for ${selected.PLAYER}.`);
        this.widgets.screen.render();
      });
  }

  private openDetailView(index: number): void {
    const selected = this.state.filteredPlayerList[index];
    if (!selected?.PLAYER) {
      return;
    }

    const competitor = findCompetitorForPlayerRow(this.state, selected);
    if (!competitor?.id || !this.state.leaderboardMeta) {
      this.showDetail({
        header: buildDetailHeader(selected, this.getDetailRenderWidth()),
        body: `No detail data found for ${selected.PLAYER}.`
      });
      return;
    }

    this.showDetail({
      header: buildDetailHeader(selected, this.getDetailRenderWidth()),
      body: `Loading full detail for ${selected.PLAYER}...`
    });

    const cacheKey = `${this.state.leaderboardMeta.id}:${competitor.id}`;
    if (this.state.scorecardCache[cacheKey]) {
      this.showDetail(formatFullScreenDetail(selected, this.state.scorecardCache[cacheKey], this.getDetailRenderWidth()));
      return;
    }

    fetchCompetitorSummary(
      this.state.leaderboardMeta.tour,
      this.state.leaderboardMeta.id,
      competitor.id,
      this.state.selectedEvent?.tour
    )
      .then((summary) => {
        this.state.scorecardCache[cacheKey] = summary;
        this.showDetail(formatFullScreenDetail(selected, summary, this.getDetailRenderWidth()));
      })
      .catch(() => {
        this.showDetail({
          header: buildDetailHeader(selected, this.getDetailRenderWidth()),
          body: `Unable to load full detail for ${selected.PLAYER}.`
        });
      });
  }

  private showDetail(content: DetailContent): void {
    openDetailOverlay(this.widgets, this.state);
    applyResponsiveLayout(this.widgets, this.state);
    this.updateShortcutBar();
    setDetailContent(this.widgets, content);
    this.widgets.screen.render();
  }

  private closeDetailView(): void {
    if (!this.state.detailViewOpen) {
      return;
    }
    closeDetailOverlay(this.widgets, this.state);
    applyResponsiveLayout(this.widgets, this.state);
    this.updateShortcutBar();
    this.widgets.screen.render();
  }

  private cyclePlayerViewMode(): void {
    const currentIndex = PLAYER_VIEW_MODES.indexOf(this.state.playerViewMode);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % PLAYER_VIEW_MODES.length;
    this.state.playerViewMode = PLAYER_VIEW_MODES[nextIndex];
    this.refilter('');
  }

  private toggleFavoriteForSelectedPlayer(): void {
    if (!this.state.filteredPlayerList.length || !this.state.leaderboardMeta) {
      return;
    }

    const selected = this.state.filteredPlayerList[this.widgets.table.rows.selected || 0];
    if (!selected) {
      return;
    }

    toggleFavoritePlayer(this.state, selected);
    this.refilter('');
  }

  private getDetailRenderWidth(): number {
    const width = this.widgets.screen && typeof this.widgets.screen.width === 'number' ? this.widgets.screen.width : 120;
    return Math.max(40, width - 6);
  }
}

export function main(): void {
  new AppController().init();
}

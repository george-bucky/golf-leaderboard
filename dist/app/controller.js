"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("../config/constants");
const espn_1 = require("../data/espn");
const leaderboard_1 = require("../format/leaderboard");
const scorecard_1 = require("../format/scorecard");
const store_1 = require("../state/store");
const resize_1 = require("./resize");
const playerTable_1 = require("./playerTable");
const playerSummary_1 = require("./playerSummary");
const detailView_1 = require("../ui/detailView");
const bars_1 = require("../ui/bars");
const eventSelector_1 = require("../ui/eventSelector");
const layout_1 = require("../ui/layout");
const text_1 = require("../utils/text");
class AppController {
    constructor() {
        this.state = (0, store_1.createAppState)();
        this.widgets = (0, layout_1.createLayout)({
            onCloseDetail: () => this.closeDetailView(),
            onTableSelect: (index) => this.onTableSelect(index),
            onTableAction: (index) => this.onTableAction(index),
            onTableKeypress: (ch, key) => this.handlePlayerJumpKeypress(ch, key)
        });
    }
    init() {
        this.bindKeys();
        (0, layout_1.applyResponsiveLayout)(this.widgets, this.state);
        this.updateShortcutBar();
        this.widgets.eventSelectorBox.focus();
        this.widgets.screen.render();
        this.widgets.screen.on('resize', () => {
            (0, resize_1.handleScreenResize)(this.widgets, this.state, {
                applyLayout: () => (0, layout_1.applyResponsiveLayout)(this.widgets, this.state),
                updateTopInfoBar: () => this.updateTopInfoBar(),
                updateShortcutBar: () => this.updateShortcutBar(),
                renderEventSelector: () => this.renderEventSelector(),
                scheduleScorecardLoad: (index) => this.scheduleScorecardLoad(index)
            });
        });
        if (!this.isNodeVersionSupported()) {
            this.showNodeVersionMessage();
            return;
        }
        this.openEventSelector();
    }
    bindKeys() {
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
    isNodeVersionSupported() {
        const major = parseInt(`${lodash_1.default.get(process, 'versions.node', '0')}`.split('.')[0], 10);
        return Number.isInteger(major) && major >= constants_1.minimumSupportedNodeMajor;
    }
    showNodeVersionMessage() {
        const version = `${process.version || 'unknown'}`;
        this.widgets.topInfoBar.setContent(`Node ${version} is too old. Use Node ${constants_1.minimumSupportedNodeMajor}+.`);
        this.widgets.scorecardBox.setContent('Please switch to Node 20+ (example: nvm use 20), then restart.');
        this.widgets.screen.render();
    }
    onTableSelect(index) {
        if (this.state.suppressSelectionEvents) {
            return;
        }
        this.scheduleScorecardLoad(index);
    }
    onTableAction(index) {
        if (this.state.scorecardSelectionTimeout) {
            clearTimeout(this.state.scorecardSelectionTimeout);
            this.state.scorecardSelectionTimeout = null;
        }
        this.openDetailView(index);
    }
    updateTopInfoBar() {
        (0, bars_1.updateTopInfoBar)(this.widgets, this.state);
    }
    updateShortcutBar() {
        (0, bars_1.updateShortcutBar)(this.widgets, this.state);
    }
    renderEventSelector() {
        (0, eventSelector_1.renderEventSelector)(this.widgets, this.state);
    }
    updateLeaderboard() {
        const selectedPlayerNameBeforeUpdate = this.getSelectedPlayerName();
        this.state.isUpdatingLeaderboard = true;
        (0, espn_1.fetchLeaderboardData)(this.state.selectedEvent || undefined)
            .then((response) => {
            this.state.leaderboardMeta = response.meta;
            this.state.selectedEvent = {
                id: response.meta.id,
                tour: response.meta.tour,
                name: response.meta.name
            };
            this.state.currentRefreshIntervalMillis = this.getRefreshIntervalMillis(response.meta);
            this.state.playerList = response.rows || [];
            (0, store_1.clearScorecardCache)(this.state);
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
            this.state.currentRefreshIntervalMillis = constants_1.idleUpdateFrequencyMillis;
            const hasExistingRows = this.state.playerList.length > 0;
            const hasExistingMeta = !!this.state.leaderboardMeta;
            this.widgets.scorecardBox.setContent(hasExistingRows ? 'Refresh failed. Showing last successful leaderboard.' : 'Unable to refresh leaderboard right now.');
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
    requestLeaderboardUpdate() {
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
    scheduleNextRefresh() {
        if (this.state.refreshTimer) {
            clearTimeout(this.state.refreshTimer);
        }
        this.state.refreshTimer = setTimeout(() => {
            this.state.refreshTimer = null;
            this.requestLeaderboardUpdate();
        }, this.state.currentRefreshIntervalMillis);
    }
    getRefreshIntervalMillis(meta) {
        return meta?.isLive ? constants_1.liveUpdateFrequencyMillis : constants_1.idleUpdateFrequencyMillis;
    }
    openEventSelector() {
        this.state.eventSelectorOpen = true;
        if (this.state.refreshTimer) {
            clearTimeout(this.state.refreshTimer);
            this.state.refreshTimer = null;
        }
        (0, layout_1.applyResponsiveLayout)(this.widgets, this.state);
        this.updateTopInfoBar();
        this.updateShortcutBar();
        this.renderEventSelector();
        this.widgets.eventSelectorBox.focus();
        this.widgets.screen.render();
        this.loadEventSelectorOptions();
    }
    loadEventSelectorOptions(options) {
        const hasFreshCache = this.state.eventSelectorOptions.length > 0 &&
            (Date.now() - this.state.eventSelectorLastLoadedAt) < constants_1.eventSelectorCacheMillis;
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
        this.state.eventSelectorLoadPromise = (0, espn_1.fetchEventSelectorOptions)()
            .then((optionsList) => {
            this.state.eventSelectorOptions = optionsList || [];
            this.state.eventSelectorLastLoadedAt = Date.now();
            this.state.eventSelectorShowingLiveOnly = lodash_1.default.some(this.state.eventSelectorOptions, (entry) => !!entry.isLive);
            if (this.state.selectedEvent?.id) {
                const selectedIndex = lodash_1.default.findIndex(this.state.eventSelectorOptions, (entry) => `${entry.id}` === `${this.state.selectedEvent?.id}`);
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
    moveEventSelectorHorizontal(delta) {
        if (!this.state.eventSelectorOpen || !this.state.eventSelectorOptions.length) {
            return;
        }
        (0, eventSelector_1.moveEventSelectorSelection)(this.widgets, this.state, this.state.selectedEventSelectorIndex + delta);
    }
    moveEventSelectorVertical(deltaRows) {
        if (!this.state.eventSelectorOpen || !this.state.eventSelectorOptions.length) {
            return;
        }
        const columns = Math.max(1, this.state.eventSelectorGridColumns || 1);
        (0, eventSelector_1.moveEventSelectorSelection)(this.widgets, this.state, this.state.selectedEventSelectorIndex + (deltaRows * columns));
    }
    activateSelectedEvent() {
        const chosen = this.state.eventSelectorOptions[this.state.selectedEventSelectorIndex];
        if (!chosen) {
            return;
        }
        this.state.selectedEvent = { id: chosen.id, eventId: chosen.id, tour: chosen.tour, name: chosen.name };
        this.state.playerViewMode = constants_1.PLAYER_VIEW_MODES[0];
        this.state.eventSelectorOpen = false;
        (0, eventSelector_1.clearEventSelectorCards)(this.state);
        (0, layout_1.applyResponsiveLayout)(this.widgets, this.state);
        this.updateTopInfoBar();
        this.updateShortcutBar();
        this.widgets.table.focus();
        this.widgets.screen.render();
        this.requestLeaderboardUpdate();
    }
    refilter(filterText, options) {
        const preferredPlayerName = options?.preferredPlayerName || this.getSelectedPlayerName();
        this.state.filteredPlayerList = (0, playerTable_1.filterPlayers)(this.state, filterText);
        const table = (0, playerTable_1.buildTableData)(this.state, this.state.filteredPlayerList);
        (0, playerTable_1.applyTableColumnWidths)(this.widgets.table, table.headers);
        this.state.suppressSelectionEvents = true;
        this.widgets.table.setData({ data: table.data, headers: table.headers });
        const preferredIndex = (0, playerTable_1.findPlayerIndexByName)(this.state.filteredPlayerList, preferredPlayerName);
        const selectedIndex = preferredIndex >= 0 ? preferredIndex : 0;
        if (this.state.filteredPlayerList.length) {
            this.widgets.table.rows.select(selectedIndex);
        }
        this.state.suppressSelectionEvents = false;
        if (this.state.filteredPlayerList.length) {
            this.scheduleScorecardLoad(selectedIndex);
        }
        else {
            this.widgets.scorecardBox.setContent((0, leaderboard_1.getEmptyPlayerViewMessage)(this.state.playerViewMode));
        }
        this.updateTopInfoBar();
        this.updateShortcutBar();
        this.widgets.screen.render();
    }
    scheduleScorecardLoad(index) {
        if (this.state.scorecardCollapsed) {
            return;
        }
        if (this.state.scorecardSelectionTimeout) {
            clearTimeout(this.state.scorecardSelectionTimeout);
        }
        this.state.scorecardSelectionTimeout = setTimeout(() => this.showScorecard(index), 200);
    }
    jumpToTopLeaderboard() {
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
    getSelectedPlayerName() {
        const selectedIndex = this.widgets.table.rows.selected || 0;
        return (0, playerTable_1.getSelectedPlayerName)(this.state.filteredPlayerList, selectedIndex);
    }
    handlePlayerJumpKeypress(ch, key) {
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
    resetPlayerJumpTimer() {
        if (this.state.playerJumpTimeout) {
            clearTimeout(this.state.playerJumpTimeout);
        }
        this.state.playerJumpTimeout = setTimeout(() => {
            this.state.playerJumpBuffer = '';
            this.state.playerJumpTimeout = null;
        }, constants_1.playerJumpResetMillis);
    }
    jumpToPlayerByPrefix(prefix) {
        if (!prefix) {
            return;
        }
        const normalizedPrefix = (0, text_1.normalizeName)(prefix);
        const currentIndex = this.widgets.table.rows.selected || 0;
        let targetIndex = (0, playerTable_1.findPlayerIndexByPrefix)(this.state.filteredPlayerList, normalizedPrefix, currentIndex + 1, this.state.filteredPlayerList.length);
        if (targetIndex === -1) {
            targetIndex = (0, playerTable_1.findPlayerIndexByPrefix)(this.state.filteredPlayerList, normalizedPrefix, 0, currentIndex + 1);
        }
        if (targetIndex === -1) {
            return;
        }
        this.widgets.table.rows.select(targetIndex);
        this.scheduleScorecardLoad(targetIndex);
        this.widgets.screen.render();
    }
    showScorecard(index) {
        if (this.state.scorecardCollapsed) {
            return;
        }
        const selected = this.state.filteredPlayerList[index];
        if (!selected?.PLAYER) {
            return;
        }
        const target = (0, playerSummary_1.getPlayerSummaryTarget)(this.state, selected);
        if (!target) {
            this.widgets.scorecardBox.setContent(`No scorecard data found for ${selected.PLAYER}.`);
            this.widgets.screen.render();
            return;
        }
        const cachedSummary = (0, playerSummary_1.getCachedPlayerSummary)(this.state, target);
        if (cachedSummary) {
            this.widgets.scorecardBox.setContent((0, scorecard_1.formatCompactScorecard)(selected, cachedSummary));
            this.widgets.screen.render();
            return;
        }
        this.widgets.scorecardBox.setContent(`Loading ${selected.PLAYER} scorecard...`);
        this.widgets.screen.render();
        (0, playerSummary_1.loadPlayerSummary)(this.state, target)
            .then((summary) => {
            this.widgets.scorecardBox.setContent((0, scorecard_1.formatCompactScorecard)(selected, summary));
            this.widgets.screen.render();
        })
            .catch(() => {
            this.widgets.scorecardBox.setContent(`Unable to load scorecard for ${selected.PLAYER}.`);
            this.widgets.screen.render();
        });
    }
    openDetailView(index) {
        const selected = this.state.filteredPlayerList[index];
        if (!selected?.PLAYER) {
            return;
        }
        const target = (0, playerSummary_1.getPlayerSummaryTarget)(this.state, selected);
        if (!target) {
            this.showDetail({
                header: (0, scorecard_1.buildDetailHeader)(selected, this.getDetailRenderWidth()),
                body: `No detail data found for ${selected.PLAYER}.`
            });
            return;
        }
        this.showDetail({
            header: (0, scorecard_1.buildDetailHeader)(selected, this.getDetailRenderWidth()),
            body: `Loading full detail for ${selected.PLAYER}...`
        });
        const cachedSummary = (0, playerSummary_1.getCachedPlayerSummary)(this.state, target);
        if (cachedSummary) {
            this.showDetail((0, scorecard_1.formatFullScreenDetail)(selected, cachedSummary, this.getDetailRenderWidth()));
            return;
        }
        (0, playerSummary_1.loadPlayerSummary)(this.state, target)
            .then((summary) => {
            this.showDetail((0, scorecard_1.formatFullScreenDetail)(selected, summary, this.getDetailRenderWidth()));
        })
            .catch(() => {
            this.showDetail({
                header: (0, scorecard_1.buildDetailHeader)(selected, this.getDetailRenderWidth()),
                body: `Unable to load full detail for ${selected.PLAYER}.`
            });
        });
    }
    showDetail(content) {
        (0, detailView_1.openDetailOverlay)(this.widgets, this.state);
        (0, layout_1.applyResponsiveLayout)(this.widgets, this.state);
        this.updateShortcutBar();
        (0, detailView_1.showDetailContent)(this.widgets, content);
        this.widgets.screen.render();
    }
    closeDetailView() {
        if (!this.state.detailViewOpen) {
            return;
        }
        (0, detailView_1.closeDetailOverlay)(this.widgets, this.state);
        (0, layout_1.applyResponsiveLayout)(this.widgets, this.state);
        this.updateShortcutBar();
        this.widgets.screen.render();
    }
    cyclePlayerViewMode() {
        const currentIndex = constants_1.PLAYER_VIEW_MODES.indexOf(this.state.playerViewMode);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % constants_1.PLAYER_VIEW_MODES.length;
        this.state.playerViewMode = constants_1.PLAYER_VIEW_MODES[nextIndex];
        this.refilter('');
    }
    toggleFavoriteForSelectedPlayer() {
        if (!this.state.filteredPlayerList.length || !this.state.leaderboardMeta) {
            return;
        }
        const selected = this.state.filteredPlayerList[this.widgets.table.rows.selected || 0];
        if (!selected) {
            return;
        }
        (0, store_1.toggleFavoritePlayer)(this.state, selected);
        this.refilter('');
    }
    getDetailRenderWidth() {
        const width = this.widgets.screen && typeof this.widgets.screen.width === 'number' ? this.widgets.screen.width : 120;
        return Math.max(40, width - 6);
    }
}
function main() {
    new AppController().init();
}

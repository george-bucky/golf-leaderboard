"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateShortcutBar = updateShortcutBar;
exports.updateTopInfoBar = updateTopInfoBar;
const leaderboard_1 = require("../format/leaderboard");
const store_1 = require("../state/store");
function updateShortcutBar(widgets, state) {
    if (state.eventSelectorOpen) {
        const selectorHint = state.eventSelectorShowingLiveOnly ? 'Showing live events first' : 'No live events right now';
        widgets.shortcutBar.setContent(`{bold}[Event Selector]{/bold}  {bold}Arrows{/bold}:Move  {bold}Enter{/bold}:Open  {bold}\`{/bold}:Refresh  {bold}1{/bold}:Events  {bold}C-c{/bold}:Quit  {light-gray-fg}${selectorHint}{/light-gray-fg}`);
        return;
    }
    const viewLabel = (0, leaderboard_1.getPlayerViewModeLabel)(state.playerViewMode);
    const scorecardHint = state.scorecardCollapsed ? '  {light-gray-fg}Scorecard:Hidden (widen terminal){/light-gray-fg}' : '';
    const mainShortcuts = `{bold}[Leaderboard]{/bold}  {bold}1{/bold}:Events  {bold}Esc{/bold}:Top  {bold}\`{/bold}:Refresh  {bold}/{/bold}:View ${viewLabel}  {bold};{/bold}:Favorite  {bold}Enter{/bold}:Player Detail  {bold}A-Z{/bold}:Jump Search  {bold}C-c{/bold}:Quit${scorecardHint}`;
    const detailShortcuts = '{bold}[Player Detail]{/bold}  {bold}L{/bold}:Back  {bold}1{/bold}:Events  {bold}Esc{/bold}:Back + Top  {bold}C-c{/bold}:Quit';
    widgets.shortcutBar.setContent(state.detailViewOpen ? detailShortcuts : mainShortcuts);
}
function updateTopInfoBar(widgets, state) {
    if (state.eventSelectorOpen) {
        if (state.isLoadingEventSelector) {
            widgets.topInfoBar.setContent('Loading live events (PGA, LPGA, DP World, LIV)...');
            return;
        }
        const total = state.eventSelectorOptions.length;
        const modeText = state.eventSelectorShowingLiveOnly ? 'live first' : 'latest only';
        widgets.topInfoBar.setContent(`Select event to open leaderboard (${total} events, ${modeText})`);
        return;
    }
    if (!state.leaderboardMeta) {
        widgets.topInfoBar.setContent('Loading event info...');
        return;
    }
    const width = widgets.topInfoBar.width && Number(widgets.topInfoBar.width) > 0 ? Number(widgets.topInfoBar.width) : 80;
    const viewText = (0, leaderboard_1.buildPlayerViewText)(state.playerViewMode, (0, store_1.getFavoriteCountForSelectedEvent)(state));
    widgets.topInfoBar.setContent((0, leaderboard_1.buildTopInfoText)(state.leaderboardMeta, width, viewText));
}

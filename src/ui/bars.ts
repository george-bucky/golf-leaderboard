import { buildPlayerViewText, buildTopInfoText, getPlayerViewModeLabel } from '../format/leaderboard';
import { getFavoriteCountForSelectedEvent } from '../state/store';
import { AppState, Widgets } from '../types';

export function updateShortcutBar(widgets: Widgets, state: AppState): void {
  if (state.eventSelectorOpen) {
    const selectorHint = state.eventSelectorShowingLiveOnly ? 'Showing live events first' : 'No live events right now';
    widgets.shortcutBar.setContent(`{bold}[Event Selector]{/bold}  {bold}Arrows{/bold}:Move  {bold}Enter{/bold}:Open  {bold}\`{/bold}:Refresh  {bold}1{/bold}:Events  {bold}C-c{/bold}:Quit  {light-gray-fg}${selectorHint}{/light-gray-fg}`);
    return;
  }
  const viewLabel = getPlayerViewModeLabel(state.playerViewMode);
  const scorecardHint = state.scorecardCollapsed ? '  {light-gray-fg}Scorecard:Hidden (widen terminal){/light-gray-fg}' : '';
  const mainShortcuts = `{bold}[Leaderboard]{/bold}  {bold}1{/bold}:Events  {bold}Esc{/bold}:Top  {bold}\`{/bold}:Refresh  {bold}/{/bold}:View ${viewLabel}  {bold};{/bold}:Favorite  {bold}Enter{/bold}:Player Detail  {bold}A-Z{/bold}:Jump Search  {bold}C-c{/bold}:Quit${scorecardHint}`;
  const detailShortcuts = '{bold}[Player Detail]{/bold}  {bold}L{/bold}:Back  {bold}1{/bold}:Events  {bold}Esc{/bold}:Back + Top  {bold}C-c{/bold}:Quit';
  widgets.shortcutBar.setContent(state.detailViewOpen ? detailShortcuts : mainShortcuts);
}

export function updateTopInfoBar(widgets: Widgets, state: AppState): void {
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
  const viewText = buildPlayerViewText(state.playerViewMode, getFavoriteCountForSelectedEvent(state));
  widgets.topInfoBar.setContent(buildTopInfoText(state.leaderboardMeta, width, viewText));
}

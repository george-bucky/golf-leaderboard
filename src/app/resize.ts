import { AppState, Widgets } from '../types';

export function handleScreenResize(
  widgets: Widgets,
  state: AppState,
  callbacks: {
    applyLayout: () => void;
    updateTopInfoBar: () => void;
    updateShortcutBar: () => void;
    renderEventSelector: () => void;
    scheduleScorecardLoad: (index: number) => void;
  }
): void {
  callbacks.applyLayout();
  callbacks.updateTopInfoBar();
  callbacks.updateShortcutBar();

  if (state.eventSelectorOpen) {
    callbacks.renderEventSelector();
  } else if (!state.scorecardCollapsed && state.filteredPlayerList.length) {
    callbacks.scheduleScorecardLoad(widgets.table.rows.selected || 0);
  }

  widgets.screen.render();
}

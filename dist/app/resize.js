"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleScreenResize = handleScreenResize;
function handleScreenResize(widgets, state, callbacks) {
    callbacks.applyLayout();
    callbacks.updateTopInfoBar();
    callbacks.updateShortcutBar();
    if (state.eventSelectorOpen) {
        callbacks.renderEventSelector();
    }
    else if (!state.scorecardCollapsed && state.filteredPlayerList.length) {
        callbacks.scheduleScorecardLoad(widgets.table.rows.selected || 0);
    }
    widgets.screen.render();
}

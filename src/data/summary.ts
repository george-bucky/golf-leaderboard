import _ from 'lodash';
import { siteApiBase } from '../config/constants';
import { fetchJson } from './http';

export function fetchCompetitorSummary(
  tour: string,
  eventId: string,
  competitorId: string,
  selectedTour?: string
): Promise<any> {
  const tourCandidates = _.uniq([`${tour || ''}`.toLowerCase(), `${selectedTour || ''}`.toLowerCase()].filter(Boolean));

  const tryFetch = (index: number): Promise<any> => {
    if (index >= tourCandidates.length) {
      return Promise.reject(new Error('No competitor summary found for selected event'));
    }
    const tourSlug = tourCandidates[index];
    const summaryUrl = `${siteApiBase}/${encodeURIComponent(tourSlug)}/leaderboard/${encodeURIComponent(eventId)}/competitorsummary/${encodeURIComponent(competitorId)}?region=us&lang=en`;
    return fetchJson(summaryUrl).catch(() => tryFetch(index + 1));
  };

  return tryFetch(0);
}

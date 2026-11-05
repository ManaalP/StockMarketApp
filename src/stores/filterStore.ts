import { useSyncExternalStore } from 'react';
import type { SortField, SortDirection, HoldingCategoryFilter } from '../domain/calcs';

export interface FilterState {
  readonly filter: HoldingCategoryFilter;
  readonly sortBy: SortField;
  readonly direction: SortDirection;
  readonly isModalOpen: boolean;
}

const DEFAULT_STATE: FilterState = {
  filter: 'all',
  sortBy: 'name',
  direction: 'asc',
  isModalOpen: false,
};

export function createFilterStore() {
  let state: FilterState = { ...DEFAULT_STATE };
  const subscribers = new Set<() => void>();

  const notify = () => {
    for (const sub of subscribers) {
      sub();
    }
  };

  const getState = (): FilterState => state;

  const setCategoryFilter = (filter: HoldingCategoryFilter) => {
    if (state.filter === filter) return;
    state = { ...state, filter };
    notify();
  };

  const setSort = (sortBy: SortField, direction: SortDirection) => {
    state = { ...state, sortBy, direction };
    notify();
  };

  const toggleSort = (field: SortField) => {
    if (state.sortBy === field) {
      const nextDir = state.direction === 'asc' ? 'desc' : 'asc';
      state = { ...state, direction: nextDir };
    } else {
      state = { ...state, sortBy: field, direction: field === 'name' ? 'asc' : 'desc' };
    }
    notify();
  };

  const openModal = () => {
    state = { ...state, isModalOpen: true };
    notify();
  };

  const closeModal = () => {
    state = { ...state, isModalOpen: false };
    notify();
  };

  const reset = () => {
    state = { ...DEFAULT_STATE };
    notify();
  };

  const hasActiveFilter = (): boolean => {
    return state.filter !== 'all' || state.sortBy !== 'name' || state.direction !== 'asc';
  };

  const subscribe = (cb: () => void) => {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  };

  return {
    getState,
    setCategoryFilter,
    setSort,
    toggleSort,
    openModal,
    closeModal,
    reset,
    hasActiveFilter,
    subscribe,
  };
}

export const filterStore = createFilterStore();

export function useFilterStore(): FilterState {
  return useSyncExternalStore(
    filterStore.subscribe,
    filterStore.getState,
    filterStore.getState
  );
}

import { filterStore } from '../../src/stores/filterStore';

describe('filterStore', () => {
  beforeEach(() => {
    filterStore.reset();
  });

  afterEach(() => {
    filterStore.reset();
  });

  test('defaults to all holdings, sorted by name asc, modal closed', () => {
    const state = filterStore.getState();
    expect(state.filter).toBe('all');
    expect(state.sortBy).toBe('name');
    expect(state.direction).toBe('asc');
    expect(state.isModalOpen).toBe(false);
    expect(filterStore.hasActiveFilter()).toBe(false);
  });

  test('updates category filter and detects active filter', () => {
    filterStore.setCategoryFilter('gainers');
    expect(filterStore.getState().filter).toBe('gainers');
    expect(filterStore.hasActiveFilter()).toBe(true);

    filterStore.reset();
    expect(filterStore.getState().filter).toBe('all');
    expect(filterStore.hasActiveFilter()).toBe(false);
  });

  test('opens and closes modal', () => {
    filterStore.openModal();
    expect(filterStore.getState().isModalOpen).toBe(true);

    filterStore.closeModal();
    expect(filterStore.getState().isModalOpen).toBe(false);
  });

  test('toggles sort field and direction', () => {
    filterStore.setSort('value', 'desc');
    expect(filterStore.getState().sortBy).toBe('value');
    expect(filterStore.getState().direction).toBe('desc');

    filterStore.toggleSort('value');
    expect(filterStore.getState().direction).toBe('asc');
  });
});

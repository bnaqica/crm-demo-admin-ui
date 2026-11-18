import { act, fireEvent } from '@testing-library/react';
import { fakeAuth, renderWithProviders } from '../test/fakeAuth';
import { IDLE_TIMEOUT_MS, IdleTimeout } from './IdleTimeout';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('signs the admin out after the idle timeout with no activity', () => {
  const auth = fakeAuth();
  renderWithProviders(<IdleTimeout />, { auth });
  act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1));
  expect(auth.signoutRedirect).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(auth.signoutRedirect).toHaveBeenCalledTimes(1);
});

test('activity restarts the idle timer', () => {
  const auth = fakeAuth();
  renderWithProviders(<IdleTimeout />, { auth });
  act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000));
  fireEvent.keyDown(window);
  act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000));
  expect(auth.signoutRedirect).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1000));
  expect(auth.signoutRedirect).toHaveBeenCalledTimes(1);
});

test('matches the crm-admin realm SSO idle timeout of 15 minutes', () => {
  expect(IDLE_TIMEOUT_MS).toBe(15 * 60 * 1000);
});

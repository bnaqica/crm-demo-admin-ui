import { render, screen } from '@testing-library/react';
import { ApiError, GENERIC_ERROR_MESSAGE } from './client';
import { ApiErrorAlert } from './ApiErrorAlert';

test('shows a ProblemDetail title and detail', () => {
  render(
    <ApiErrorAlert
      error={new ApiError({ status: 409, title: 'Conflict', detail: 'Email already in use' })}
    />,
  );
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent('Conflict');
  expect(alert).toHaveTextContent('Email already in use');
});

test('shows the generic message for anything that is not an ApiError, never its stack', () => {
  const error = new TypeError('x is undefined');
  render(<ApiErrorAlert error={error} />);
  expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
  expect(screen.queryByText(/undefined|at /)).not.toBeInTheDocument();
});

test('renders nothing without an error', () => {
  const { container } = render(<ApiErrorAlert error={null} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders problem text as text, not HTML', () => {
  render(
    <ApiErrorAlert
      error={new ApiError({ status: 400, title: 'Bad', detail: '<img src=x onerror=alert(1)>' })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('<img src=x onerror=alert(1)>');
  expect(document.querySelector('img')).toBeNull();
});

import { formatDuration } from '../time';

it.each([
  [0, '0:00'],
  [5, '0:05'],
  [45, '0:45'],
  [90, '1:30'],
  [600, '10:00'],
  [3725, '1:02:05'],
  [59.9, '0:59'],
  [-3, '0:00'],
  [undefined, '0:00'],
])('formats %p seconds as %s', (seconds, text) => {
  expect(formatDuration(seconds)).toBe(text);
});

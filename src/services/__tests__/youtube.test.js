import { parseYouTubeUrl, youTubeWatchUrl, youTubeEmbedHtml } from '../youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}&feature=share`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `youtube.com/watch?v=${ID}`,
    `  https://youtu.be/${ID}  `,
  ])('finds the video in %s', (link) => {
    expect(parseYouTubeUrl(link)).toEqual({ id: ID, start: 0 });
  });

  it.each([
    [`https://youtu.be/${ID}?t=90`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=1m30s`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=95s`, 95],
    [`https://www.youtube.com/embed/${ID}?start=42`, 42],
  ])('reads the start time from %s', (link, start) => {
    expect(parseYouTubeUrl(link).start).toBe(start);
  });

  it.each([
    '',
    null,
    'not a link',
    'https://vimeo.com/123456',
    'https://www.youtube.com/@somechannel',
    'https://www.youtube.com/watch?v=tooShort',
    'https://www.youtube.com/playlist?list=PL123',
  ])('rejects %p', (link) => {
    expect(parseYouTubeUrl(link)).toBeNull();
  });
});

it('builds a watch link that keeps the start time', () => {
  expect(youTubeWatchUrl({ id: ID, start: 90 })).toBe(`https://www.youtube.com/watch?v=${ID}&t=90s`);
  expect(youTubeWatchUrl({ id: ID, start: 0 })).toBe(`https://www.youtube.com/watch?v=${ID}`);
});

it('embeds with the app as origin so YouTube agrees to play it', () => {
  const html = youTubeEmbedHtml({ id: ID, start: 30 });

  expect(html).toContain(`https://www.youtube.com/embed/${ID}?`);
  expect(html).toContain('start=30');
  expect(html).toContain('origin=https%3A%2F%2Fcom.rahulkannan.workoutcycle');
});

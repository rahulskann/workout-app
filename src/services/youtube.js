import { Linking } from 'react-native';

// Exercises can have a YouTube link (videoUrl) as well as, or instead of, a
// video file saved on the phone. These helpers turn whatever link people
// paste into something the app can show and play.

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// Returns { id, start } for the usual YouTube link shapes -- watch?v=,
// youtu.be/, /shorts/, /embed/, /live/, with or without a start time
// (t=90, t=1m30s, start=90) -- or null if it isn't a YouTube video link.
export function parseYouTubeUrl(input) {
  if (!input) return null;
  let url;
  try {
    url = new URL(input.trim().match(/^https?:\/\//i) ? input.trim() : `https://${input.trim()}`);
  } catch (e) {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = url.pathname.split('/');
    id = first === 'watch' ? url.searchParams.get('v') : ['shorts', 'embed', 'live', 'v'].includes(first) ? second : null;
  }
  if (!id || !ID_PATTERN.test(id)) return null;
  return { id, start: parseStart(url.searchParams.get('t') || url.searchParams.get('start')) };
}

// "90", "90s", "1m30s", "1h2m3s" -> seconds
function parseStart(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return 0;
  const [, h = 0, m = 0, s = 0] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function youTubeThumbnail({ id }) {
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

export function youTubeWatchUrl({ id, start }) {
  return `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`;
}

// Opens the YouTube app (or the browser if it isn't installed).
export function openInYouTube(video) {
  return Linking.openURL(youTubeWatchUrl(video));
}

// YouTube's embedded player wants to know which site or app is showing it,
// and refuses to play ("Error 153") without a referrer, so the page is
// loaded with the app's ID as its origin.
export const EMBED_ORIGIN = 'https://com.rahulkannan.splitcycle';

export function youTubeEmbedHtml({ id, start }) {
  const params = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    rel: '0',
    start: String(start || 0),
    origin: EMBED_ORIGIN,
  });
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
</head><body>
<iframe src="https://www.youtube.com/embed/${id}?${params}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</body></html>`;
}

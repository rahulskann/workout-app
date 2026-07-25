const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Creates a new spreadsheet owned by the signed-in user, with a header row.
// Under drive.file scope this is the only way to get write access to a
// sheet -- the app can't touch spreadsheets it didn't create itself.
export async function createWorkoutSpreadsheet({ accessToken, title = 'Workout Cycle Log' }) {
  const createRes = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties: { title } }),
  });
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`Sheets API create error ${createRes.status}: ${text}`);
  }
  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;

  // Header row, best-effort -- don't fail the whole create if this hiccups.
  try {
    await appendRowToSheet({
      accessToken,
      spreadsheetId,
      range: 'Sheet1!A1',
      values: ['Date', 'Routine', 'Exercise', 'Top Weight', 'Sets (weight x reps)'],
    });
  } catch (e) {
    // non-fatal
  }

  return { spreadsheetId, spreadsheetUrl: created.spreadsheetUrl };
}

// Appends one row of values to the given spreadsheet/range using an
// already-obtained OAuth access token (scope: spreadsheets).
export async function appendRowToSheet({ accessToken, spreadsheetId, range, values }) {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }
  return res.json();
}

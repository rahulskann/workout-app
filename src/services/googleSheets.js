const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

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

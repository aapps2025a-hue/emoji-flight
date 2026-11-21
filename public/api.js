// Shared response handling for authentication and saves.
window.flightRequest = async function (path, options = {}) {
  let response;
  try {
    response = await fetch(path, {cache: 'no-store', ...options});
  } catch (_) {
    throw new Error('Cannot reach the account server. Run START.cmd, keep its window open, and reload http://127.0.0.1:18943/.');
  }
  const type = response.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) {
    throw new Error('The account API returned a web page instead of data (HTTP ' + response.status + '). Run START.cmd and open http://127.0.0.1:18943/. GitHub Pages alone cannot run accounts or database saves.');
  }
  let result;
  try { result = await response.json(); }
  catch (_) { throw new Error('The account server returned invalid data. Please restart it and try again.'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('The account server returned an unexpected response.');
  }
  if (!response.ok) {
    const error = new Error(typeof result.error === 'string' ? result.error : 'Account request failed (HTTP ' + response.status + ').');
    error.status = response.status;
    throw error;
  }
  return result;
};

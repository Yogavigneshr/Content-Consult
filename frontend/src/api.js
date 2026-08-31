import axios from 'axios';

export const API_ROOT = 'http://localhost:8000/api/v1';
export const ACCOUNTS_ROOT = 'http://localhost:8000/api/accounts';

const token = () => sessionStorage.getItem('niftybot_token');

const defaultApi = axios.create({ baseURL: API_ROOT });

defaultApi.interceptors.request.use((config) => {
  const value = token();
  if (value) config.headers.Authorization = `Token ${value}`;
  return config;
});

defaultApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('niftybot_token');
      sessionStorage.removeItem('niftybot_user');
      if (window.location.pathname !== '/login')
        window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const accountsApi = axios.create({ baseURL: ACCOUNTS_ROOT });
accountsApi.interceptors.request.use((config) => {
  const value = token();
  if (value) config.headers.Authorization = `Token ${value}`;
  return config;
});
accountsApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('niftybot_token');
      sessionStorage.removeItem('niftybot_user');
      if (window.location.pathname !== '/login')
        window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
export async function login(identifier, password) {
  const { data } = await accountsApi.post('/login/', { identifier, password });
  // The server already authenticated the user at this point (this request
  // succeeded). Anything that throws below is NOT a "wrong credentials"
  // problem — it's a client-side issue (e.g. storage blocked by private
  // browsing, cookie settings, or an embedding iframe). Keep that distinct
  // so the login screen doesn't lie to the user about bad credentials.
  if (!data?.token || !data?.user) {
    throw new Error('Signed in, but the server response was missing session data. Please try again.');
  }
  try {
    sessionStorage.setItem('niftybot_token', data.token);
    sessionStorage.setItem('niftybot_user', JSON.stringify(data.user));
  } catch (storageError) {
    console.error('Login succeeded but session storage failed:', storageError);
    throw new Error('Signed in, but your browser is blocking site storage (private browsing, blocked cookies, or an embedded frame). Allow storage for this site and try again.');
  }
  return data;
}

export function logout() {
  sessionStorage.removeItem('niftybot_token');
  sessionStorage.removeItem('niftybot_user');
  window.location.href = '/login';
}

export function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem('niftybot_user') || 'null');
  } catch {
    return null;
  }
}

export async function getMe() {
  return (await accountsApi.get('/me/')).data;
}
export async function changePassword(payload) {
  const data = (await accountsApi.post('/password/change/', payload)).data;
  if (data.token) sessionStorage.setItem('niftybot_token', data.token);
  return data;
}
export async function confirmPasswordReset(payload) {
  return (await accountsApi.post('/password/reset/confirm/', payload)).data;
}
export async function requestPasswordReset(email) {
  return (await accountsApi.post('/password/reset/request/', { email })).data;
}
export async function adminResetUserPassword(id, password) {
  return (await accountsApi.post(`/admin/users/${id}/password/`, { password }))
    .data;
}
export async function updateAdminUserBudget(id, cost_limit_usd) {
  return (
    await accountsApi.patch(`/admin/users/${id}/budget/`, { cost_limit_usd })
  ).data;
}

export async function getAIProviders() {
  return (await defaultApi.get('/providers/')).data.providers || [];
}

export async function generateAI(payload) {
  const client = payload.apiBaseUrl
    ? axios.create({ baseURL: payload.apiBaseUrl.replace(/\/$/, '') })
    : defaultApi;
  const { apiBaseUrl, api_key, provider_api_key, ...body } = payload;
  const headers = api_key
    ? { 'X-API-Key': api_key }
    : { Authorization: `Token ${token()}` };
  return (await client.post('/generate/', body, { headers })).data;
}

export async function getSites() {
  return (await defaultApi.get('/sites/')).data;
}
export async function saveDraft(payload) {
  return (await defaultApi.post('/drafts/', payload)).data;
}
export async function getDrafts() {
  return (await defaultApi.get('/drafts/')).data;
}
export async function deleteDraft(id) {
  return defaultApi.delete(`/drafts/?id=${encodeURIComponent(id)}`);
}

export async function downloadDraft(id, format) {
  const response = await defaultApi.get(`/drafts/${id}/${format}/`, {
    responseType: 'blob',
  });
  return saveBlob(
    response.data,
    getFilename(
      response.headers['content-disposition'],
      `niftybot-draft-${id}.${format === 'word' ? 'docx' : 'pdf'}`
    )
  );
}

export async function getAdminDashboard(params = {}) {
  return (await accountsApi.get('/admin/dashboard/', { params })).data;
}
export async function getAdminUsers() {
  return (await accountsApi.get('/admin/users/')).data;
}
export async function getAdminUserReport(id) {
  return (await accountsApi.get(`/admin/users/${id}/report/`)).data;
}
export async function downloadAdminUserReport(id, section = 'all') {
  const response = await accountsApi.get(
    `/admin/export/user-report/?user_id=${encodeURIComponent(
      id
    )}&section=${encodeURIComponent(section)}`,
    { responseType: 'blob' }
  );
  const filename = getFilename(
    response.headers['content-disposition'],
    `niftybot-user-${id}-${section}-report.csv`
  );
  await saveBlob(response.data, filename);
}
export async function createAdminUser(payload) {
  return (await accountsApi.post('/admin/users/', payload)).data;
}
export async function deleteAdminUser(id) {
  return accountsApi.delete(`/admin/users/${id}/`);
}
export async function toggleAdminUser(id, isActive) {
  return (
    await accountsApi.patch(`/admin/users/${id}/`, { is_active: isActive })
  ).data;
}
export async function getAdminActivity(params = {}) {
  return (await accountsApi.get('/admin/activity/', { params })).data;
}
export async function getAdminContent(params = {}) {
  return (await accountsApi.get('/admin/content/', { params })).data;
}
export async function deleteAdminContent(id) {
  return accountsApi.delete(`/admin/content/${id}/`);
}
export async function getAdminSites() {
  return (await accountsApi.get('/admin/sites/')).data;
}
export async function getAdminSystem() {
  return (await accountsApi.get('/admin/system/')).data;
}
export async function getAdminAIUsage() {
  return (await accountsApi.get('/admin/ai-usage/')).data;
}
export async function clearAdminAIUsage() {
  return accountsApi.delete('/admin/ai-usage/');
}
export async function setAdminAIProvider(
  provider,
  apiKey = '',
  clearApiKey = false
) {
  return (
    await accountsApi.patch('/admin/system/', {
      provider,
      ...(apiKey ? { api_key: apiKey } : {}),
      // Clearing a key must never switch which provider is active for users —
      // set_active: false keeps this a pure "remove the stored key" action.
      ...(clearApiKey
        ? { api_key: '', clear_api_key: true, set_active: false }
        : {}),
    })
  ).data;
}
export async function downloadAdminAllExport() {
  const response = await accountsApi.get('/admin/export/all/', {
    responseType: 'blob',
  });
  const filename = getFilename(
    response.headers['content-disposition'],
    'niftybot-admin-export.zip'
  );
  await saveBlob(response.data, filename);
}

export async function downloadAdminExport(kind, userId = '') {
  let path;
  let fallback;
  if (kind === 'users') {
    path = '/admin/export/users/';
    fallback = 'niftybot-users.csv';
  } else if (kind === 'activity') {
    path = '/admin/export/activity/';
    fallback = 'niftybot-activity.csv';
  } else if (kind === 'searches') {
    path = '/admin/export/searches/';
    if (userId) path += `?user_id=${encodeURIComponent(userId)}`;
    fallback = userId
      ? `niftybot-user-${userId}-content.csv`
      : 'niftybot-user-search-data.csv';
  } else {
    throw new Error('Unknown export type.');
  }

  try {
    const response = await accountsApi.get(path, { responseType: 'blob' });
    const filename = getFilename(
      response.headers['content-disposition'],
      fallback
    );
    await saveBlob(response.data, filename);
  } catch (error) {
    // Axios exposes non-2xx blob responses as Blob objects. Convert them back
    // to JSON/text so the admin UI can show the real Django error.
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const parsed = JSON.parse(text);
        error.response.data = parsed;
      } catch {
        /* keep the original error */
      }
    }
    throw error;
  }
}

function getFilename(contentDisposition, fallback) {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(
    /filename[^;=]*=(?:UTF-8''|"|')?([^"';]+)/i
  );
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

function saveBlob(data, filename) {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Do not revoke synchronously: Chrome/Edge can cancel the download if the
  // object URL disappears before the browser has started reading it.
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

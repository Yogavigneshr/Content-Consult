import React, { useEffect, useMemo, useState } from 'react';
import { AppHeader, AppFooter } from './components/AppChrome';
import {
  createAdminUser,
  deleteAdminUser,
  deleteAdminContent,
  downloadAdminAllExport,
  downloadAdminExport,
  getAdminActivity,
  getAdminContent,
  getAdminDashboard,
  getAdminSites,
  getAdminSystem,
  getAdminAIUsage,
  clearAdminAIUsage,
  login,
  setAdminAIProvider,
  getAdminUsers,
  getAdminUserReport,
  downloadAdminUserReport,
  getStoredUser,
  logout,
  toggleAdminUser,
  adminResetUserPassword,
  updateAdminUserBudget,
} from './api';
import ComparisonResult from './components/ComparisonResult';
import { CONTENT_CATALOG, CONTENT_FORMATS } from './contentCatalog';

/**
 * Admin workspace
 *
 * Structure:
 * 1. Admin header
 * 2. Clickable metrics
 * 3. Active management panel
 *    - Users
 *    - Content
 *    - Activity
 *    - System
 * 4. Modals
 *
 * There is intentionally no secondary Overview/Quick Overview block.
 * The metric cards are the primary admin dashboard shortcuts.
 */
export default function AdminPage() {
  const [activePanel, setActivePanel] = useState(() => {
    const path = window.location.pathname;
    if (path === '/admin/users' || path.startsWith('/admin/users/'))
      return 'users';
    if (path === '/admin/content') return 'content';
    if (path === '/admin/activity') return 'activity';
    if (path === '/admin/system') return 'system';
    return 'dashboard';
  });
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState([]);
  const [activity, setActivity] = useState([]);
  const [sites, setSites] = useState([]);
  const [system, setSystem] = useState(null);
  const [aiUsage, setAIUsage] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [viewContent, setViewContent] = useState(null);
  const [userReport, setUserReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(() => {
    const match = window.location.pathname.match(/^\/admin\/users\/(\d+)$/);
    return match ? Number(match[1]) : null;
  });
  const [activityPage, setActivityPage] = useState(1);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [userSort, setUserSort] = useState({
    key: 'date_joined',
    direction: 'desc',
  });
  const [userPage, setUserPage] = useState(1);
  const [budgetUser, setBudgetUser] = useState(null);
  const [budgetValue, setBudgetValue] = useState('');

  const [userSearch, setUserSearch] = useState('');
  const [userStatus, setUserStatus] = useState('all');
  const [contentSearch, setContentSearch] = useState('');
  const [contentType, setContentType] = useState('all');
  const [contentStatus, setContentStatus] = useState('all');
  const [activityAction, setActivityAction] = useState('all');
  const [activityUser, setActivityUser] = useState('all');

  const [form, setForm] = useState({
    username: '',
    email: '',
    send_credentials: true,
  });

  const admin = getStoredUser();

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (selectedUserId && users.length && !userReport) {
      const target = users.find(
        (item) => Number(item.id) === Number(selectedUserId)
      );
      if (target) openUserReport(target);
    }
  }, [selectedUserId, users, userReport]);

  function notify(text, type = 'success') {
    setMessage(text);
    setMessageType(type);
    window.clearTimeout(window.__adminToast);
    const duration = String(text).includes('temporary password') ? 20000 : 5000;
    window.__adminToast = window.setTimeout(() => setMessage(''), duration);
  }

  async function loadAdminData() {
    setLoading(true);

    try {
      const [
        dashboard,
        adminUsers,
        adminActivity,
        adminContent,
        adminSites,
        adminSystem,
        adminAIUsage,
      ] = await Promise.all([
        getAdminDashboard().catch(() => ({})),
        getAdminUsers(),
        getAdminActivity(),
        getAdminContent(),
        getAdminSites(),
        getAdminSystem(),
        getAdminAIUsage().catch(() => null),
      ]);

      setStats(dashboard || {});
      setUsers(adminUsers || []);
      setActivity(adminActivity || []);
      setContent(adminContent || []);
      setSites(adminSites || []);
      setSystem(adminSystem || null);
      setAIUsage(adminAIUsage || null);
    } catch (error) {
      notify(
        error.response?.data?.detail ||
          'Could not load admin data. Make sure Django is running.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }

  function openPanel(panel) {
    setActivePanel(panel);
    const href = panel === 'dashboard' ? '/admin' : `/admin/${panel}`;
    if (window.location.pathname !== href)
      window.history.pushState({ panel }, '', href);
    window.setTimeout(() => {
      document
        .querySelector('.admin-content-area')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 20);
  }

  useEffect(() => {
    const syncPath = () => {
      const path = window.location.pathname;
      const userMatch = path.match(/^\/admin\/users\/(\d+)$/);
      const next = path.startsWith('/admin/users')
        ? 'users'
        : path === '/admin/content'
        ? 'content'
        : path === '/admin/activity'
        ? 'activity'
        : path === '/admin/system'
        ? 'system'
        : 'dashboard';
      setActivePanel(next);
      setSelectedUserId(userMatch ? Number(userMatch[1]) : null);
    };
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  async function createUser(event) {
    event.preventDefault();
    setBusy('create');

    try {
      const response = await createAdminUser(form);
      const username = response.user?.username || form.username;

      if (response.email_sent) {
        notify(`User ${username} created and credentials emailed.`);
      } else if (response.temporary_password) {
        notify(
          `User ${username} created. Email failed — temporary password: ${response.temporary_password}`
        );
        try {
          await navigator.clipboard.writeText(response.temporary_password);
        } catch (_) {
          /* ignore clipboard failures */
        }
      } else {
        notify(`User ${username} created.`);
      }

      setForm({
        username: '',
        email: '',
        send_credentials: true,
      });
      setShowCreate(false);
      await loadAdminData();
    } catch (error) {
      notify(
        error.response?.data?.detail ||
          Object.values(error.response?.data || {})
            .flat()
            .join(' ') ||
          'Could not create user.',
        'error'
      );
    } finally {
      setBusy('');
    }
  }

  async function openUserReport(user) {
    setReportLoading(true);
    setSelectedUserId(user.id);
    setUserReport({ loading: true, user });
    window.history.pushState(
      { userId: user.id },
      '',
      `/admin/users/${user.id}`
    );
    try {
      const report = await getAdminUserReport(user.id);
      setUserReport(report);
    } catch (error) {
      setUserReport(null);
      setSelectedUserId(null);
      window.history.pushState({}, '', '/admin/users');
      notify(
        error.response?.data?.detail || 'Could not load user report.',
        'error'
      );
    } finally {
      setReportLoading(false);
    }
  }

  function closeUserReport() {
    setSelectedUserId(null);
    setUserReport(null);
    window.history.pushState({}, '', '/admin/users');
  }

  async function resetPasswordForUser(event) {
    event.preventDefault();
    if (!resetUser || resetPassword.length < 8) {
      notify('Use at least 8 characters for the new password.', 'error');
      return;
    }
    setBusy(`reset-password-${resetUser.id}`);
    try {
      await adminResetUserPassword(resetUser.id, resetPassword);
      notify(`Password reset for ${resetUser.username}.`);
      setResetUser(null);
      setResetPassword('');
    } catch (error) {
      notify(
        error.response?.data?.detail || 'Could not reset password.',
        'error'
      );
    } finally {
      setBusy('');
    }
  }

  async function saveUserBudget(event) {
    event.preventDefault();
    if (!budgetUser) return;
    const value = Number(budgetValue);
    if (!Number.isFinite(value) || value < 0) {
      notify('Enter a valid non-negative USD cost limit.', 'error');
      return;
    }
    setBusy(`budget-${budgetUser.id}`);
    try {
      await updateAdminUserBudget(budgetUser.id, value.toFixed(4));
      notify(`AI cost limit updated for ${budgetUser.username}.`);
      setBudgetUser(null);
      await loadAdminData();
    } catch (error) {
      notify(
        error.response?.data?.detail || 'Could not update the cost limit.',
        'error'
      );
    } finally {
      setBusy('');
    }
  }

  async function removeUser(id, name) {
    if (
      !window.confirm(
        `Delete ${name}? This permanently removes the account and its owned content.`
      )
    ) {
      return;
    }

    setBusy(`delete-user-${id}`);

    try {
      await deleteAdminUser(id);
      notify(`User ${name} deleted.`);
      await loadAdminData();
    } catch (error) {
      notify(error.response?.data?.detail || 'Could not delete user.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function toggleUser(id, name, active) {
    setBusy(`toggle-${id}`);

    try {
      await toggleAdminUser(id, !active);
      notify(`${name} is now ${active ? 'inactive' : 'active'}.`);
      await loadAdminData();
    } catch (error) {
      notify(
        error.response?.data?.detail || 'Could not update user status.',
        'error'
      );
    } finally {
      setBusy('');
    }
  }

  async function removeContent(id, title) {
    if (
      !window.confirm(
        `Delete “${title || 'Untitled content'}”? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusy(`content-${id}`);

    try {
      await deleteAdminContent(id);
      notify('Content deleted.');
      setViewContent(null);
      await loadAdminData();
    } catch (error) {
      notify(
        error.response?.data?.detail || 'Could not delete content.',
        'error'
      );
    } finally {
      setBusy('');
    }
  }

  async function clearApiConsumption() {
    requestPasswordConfirm("Are you sure you want to clear all AI consumption data? This cannot be undone.", async () => {
      setPasswordModal({ open: false, message: "", onConfirm: null });
      setBusy("clear-usage");
      try {
        await clearAdminAIUsage();
        notify("AI usage history cleared.");
        loadAdminData(); // Refresh data
      } catch (error) {
        notify(error.response?.data?.detail || 'Could not clear AI usage.', 'error');
      } finally {
        setBusy(false);
      }
    });
  }
  
  async function changeAIProvider(provider, apiKey = '', clearApiKey = false) {
    setBusy('provider-global');
    try {
      await setAdminAIProvider(provider, apiKey, clearApiKey);
      const labels = {
        gemini: 'Gemini',
        openai: 'ChatGPT / OpenAI',
        anthropic: 'Claude',
        xai: 'Grok / xAI',
      };
      notify(
        clearApiKey
          ? `${labels[provider] || provider} API key removed.`
          : `${labels[provider] || provider} is now active for users.`
      );
      await loadAdminData();
    } catch (error) {
      notify(
        error.response?.data?.detail || 'Could not update AI provider.',
        'error'
      );
    } finally {
      setBusy('');
    }
  }

  function downloadClientCsv(filename, headers, rows) {
    const escape = (value) => {
      const text = value == null ? '' : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [headers.map(escape).join(',')].concat(
      rows.map((row) => row.map(escape).join(','))
    );
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportData(kind, userId = '') {
    setBusy(`export-${kind}-${userId}`);

    try {
      if (kind === 'users') {
        // Export currently filtered users (or all if no filters)
        const rows = filteredUsers.map((u) => [
          u.id,
          u.username,
          u.email,
          u.first_name || '',
          u.last_name || '',
          u.is_active ? 'Active' : 'Inactive',
          u.date_joined ? new Date(u.date_joined).toISOString() : '',
          u.activity_count ?? 0,
          u.cost_limit_usd ?? '',
        ]);
        downloadClientCsv(
          'niftybot-users.csv',
          [
            'ID',
            'Username',
            'Email',
            'First name',
            'Last name',
            'Status',
            'Joined',
            'Activity',
            'Cost limit (USD)',
          ],
          rows
        );
        notify(
          userSearch || userStatus !== 'all'
            ? `Exported ${rows.length} filtered user(s).`
            : 'Export downloaded successfully.'
        );
      } else if (kind === 'searches' && !userId) {
        // Content library export respects type/status/search filters
        const rows = filteredContent.map((item) => [
          item.id,
          item.user,
          item.content_type,
          item.topic || '',
          item.title || '',
          item.status || '',
          item.word_count ?? '',
          item.created_at ? new Date(item.created_at).toISOString() : '',
        ]);
        downloadClientCsv(
          'niftybot-content.csv',
          [
            'ID',
            'User',
            'Content type',
            'Topic',
            'Title',
            'Status',
            'Words',
            'Created at',
          ],
          rows
        );
        notify(
          contentSearch || contentType !== 'all' || contentStatus !== 'all'
            ? `Exported ${rows.length} filtered content item(s).`
            : 'Export downloaded successfully.'
        );
      } else {
        await downloadAdminExport(kind, userId);
        notify('Export downloaded successfully.');
      }
    } catch (error) {
      notify(
        error.response?.data?.detail || 'Export failed. Check the backend.',
        'error'
      );
    } finally {
      setBusy('');
    }
  }

  async function exportAll() {
    setBusy('export-all');

    try {
      await downloadAdminAllExport();
      notify('Complete admin archive downloaded.');
    } catch (error) {
      notify(error.response?.data?.detail || 'Archive export failed.', 'error');
    } finally {
      setBusy('');
    }
  }

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    const rows = users.filter((user) => {
      const matchesSearch =
        !query ||
        [user.username, user.email, user.first_name, user.last_name]
          .join(' ')
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        userStatus === 'all' ||
        (userStatus === 'active' ? user.is_active : !user.is_active);
      return matchesSearch && matchesStatus;
    });
    const value = (user, key) => {
      if (key === 'status') return user.is_active ? 1 : 0;
      if (key === 'activity') return Number(user.activity_count || 0);
      if (key === 'cost') return Number(user.cost_limit_usd || 0);
      if (key === 'date_joined')
        return user.date_joined ? new Date(user.date_joined).getTime() : 0;
      return String(user[key] || '').toLowerCase();
    };
    rows.sort((a, b) => {
      const av = value(a, userSort.key);
      const bv = value(b, userSort.key);
      if (av < bv) return userSort.direction === 'asc' ? -1 : 1;
      if (av > bv) return userSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [users, userSearch, userStatus, userSort]);

  const USERS_PER_PAGE = 10;
  const userPageCount = Math.max(
    1,
    Math.ceil(filteredUsers.length / USERS_PER_PAGE)
  );
  const visibleUsers = filteredUsers.slice(
    (userPage - 1) * USERS_PER_PAGE,
    userPage * USERS_PER_PAGE
  );

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userStatus, userSort]);

  const filteredContent = useMemo(() => {
    const query = contentSearch.trim().toLowerCase();

    return content.filter((item) => {
      const matchesSearch =
        !query ||
        [item.title, item.topic, item.user]
          .join(' ')
          .toLowerCase()
          .includes(query);

      const matchesType =
        contentType === 'all' || item.content_type === contentType;

      const matchesStatus =
        contentStatus === 'all' || item.status === contentStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [content, contentSearch, contentType, contentStatus]);

  const filteredActivity = useMemo(() => {
    return activity.filter((item) => {
      const matchesAction =
        activityAction === 'all' || item.action_key === activityAction;
      const matchesUser =
        activityUser === 'all' || String(item.user_id) === activityUser;

      return matchesAction && matchesUser;
    });
  }, [activity, activityAction, activityUser]);

  const ACTIVITY_PER_PAGE = 10;
  const activityPageCount = Math.max(
    1,
    Math.ceil(filteredActivity.length / ACTIVITY_PER_PAGE)
  );
  const visibleActivity = filteredActivity.slice(
    (activityPage - 1) * ACTIVITY_PER_PAGE,
    activityPage * ACTIVITY_PER_PAGE
  );
  useEffect(() => {
    setActivityPage(1);
  }, [activityAction, activityUser]);

  return (
    <main className='admin-page admin-pro'>
      <AppHeader admin subtitle='Administration' />

      <div className='admin-shell admin-shell-pro'>
        <AdminTitle
          activePanel={activePanel}
          onSelect={openPanel}
          onCreate={() => {
            setUserStatus('all');
            openPanel('users');
          }}
          onSystem={() => openPanel('system')}
        />

        {message && (
          <AdminMessage
            message={message}
            type={messageType}
            onClose={() => setMessage('')}
          />
        )}

        <div className='admin-layout-pro'>
          <AdminSidebar activePanel={activePanel} onSelect={openPanel} />

          <div className='admin-content-area'>
            {activePanel === 'dashboard' && (
              <>
                <AdminMetrics
                  stats={stats}
                  activePanel={activePanel}
                  onUsers={() => openPanel('users')}
                  onActiveUsers={() => {
                    setUserStatus('active');
                    openPanel('users');
                  }}
                  onContent={() => openPanel('content')}
                  onActivity={() => openPanel('activity')}
                />
                <AIUsageStrip usage={aiUsage} onClearUsage={clearApiConsumption} busy={busy} />
              </>
            )}
            {loading ? (
              <LoadingPanel />
            ) : (
              <>
                {activePanel === 'users' &&
                  (selectedUserId && userReport ? (
                    <UserDetailPage
                      report={userReport}
                      loading={reportLoading}
                      system={system}
                      busy={busy}
                      onBack={closeUserReport}
                      onToggle={toggleUser}
                      onDelete={removeUser}
                      onResetPassword={(user) => {
                        setResetUser(user);
                        setResetPassword('');
                      }}
                      onBudget={(user) => {
                        setBudgetUser(user);
                        setBudgetValue(String(user.cost_limit_usd ?? '0.0000'));
                      }}
                      onExport={async (section) => {
                        const id = userReport?.user?.id;
                        if (!id) return;
                        setBusy(`report-export-${id}-${section}`);
                        try {
                          await downloadAdminUserReport(id, section);
                          notify(
                            section === 'all'
                              ? 'Full user report exported.'
                              : `${section} report exported.`
                          );
                        } catch (error) {
                          notify(
                            error.response?.data?.detail ||
                              'Report export failed.',
                            'error'
                          );
                        } finally {
                          setBusy('');
                        }
                      }}
                    />
                  ) : (
                    <UsersPanel
                      users={filteredUsers}
                      search={userSearch}
                      setSearch={setUserSearch}
                      status={userStatus}
                      setStatus={setUserStatus}
                      busy={busy}
                      onCreate={() => setShowCreate(true)}
                      onToggle={toggleUser}
                      onDelete={removeUser}
                      onResetPassword={(user) => {
                        setResetUser(user);
                        setResetPassword('');
                      }}
                      onReport={openUserReport}
                      onExport={exportData}
                      onSort={(key) =>
                        setUserSort((current) =>
                          current.key === key
                            ? {
                                key,
                                direction:
                                  current.direction === 'asc' ? 'desc' : 'asc',
                              }
                            : { key, direction: 'asc' }
                        )
                      }
                      sort={userSort}
                      page={userPage}
                      pageCount={userPageCount}
                      onPage={setUserPage}
                      onBudget={(user) => {
                        setBudgetUser(user);
                        setBudgetValue(String(user.cost_limit_usd ?? '0.0000'));
                      }}
                      onExportReport={async (user, section) => {
                        setBusy(`report-export-${user.id}-${section}`);
                        try {
                          await downloadAdminUserReport(user.id, section);
                          notify(
                            section === 'all'
                              ? 'Full user report exported.'
                              : `${section} report exported.`
                          );
                        } catch (error) {
                          notify(
                            error.response?.data?.detail ||
                              'Report export failed.',
                            'error'
                          );
                        } finally {
                          setBusy('');
                        }
                      }}
                      system={system}
                    />
                  ))}

                {activePanel === 'content' && (
                  <ContentPanel
                    content={filteredContent}
                    search={contentSearch}
                    setSearch={setContentSearch}
                    type={contentType}
                    setType={setContentType}
                    status={contentStatus}
                    setStatus={setContentStatus}
                    busy={busy}
                    onView={setViewContent}
                    onDelete={removeContent}
                    onExport={() => exportData('searches')}
                  />
                )}

                {activePanel === 'activity' && (
                  <ActivityPanel
                    activity={visibleActivity}
                    totalActivity={filteredActivity.length}
                    page={activityPage}
                    pageCount={activityPageCount}
                    onPage={setActivityPage}
                    users={users}
                    action={activityAction}
                    setAction={setActivityAction}
                    user={activityUser}
                    setUser={setActivityUser}
                    busy={busy}
                    onExport={() => exportData('activity')}
                  />
                )}

                {activePanel === 'system' && (
                  <SystemPanel
                    system={system}
                    sites={sites}
                    onExport={exportAll}
                    busy={busy}
                    onProviderChange={changeAIProvider}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateModal
          form={form}
          setForm={setForm}
          busy={busy}
          onClose={() => setShowCreate(false)}
          onSubmit={createUser}
        />
      )}

      {budgetUser && (
        <BudgetModal
          user={budgetUser}
          value={budgetValue}
          setValue={setBudgetValue}
          busy={busy === `budget-${budgetUser.id}`}
          onClose={() => setBudgetUser(null)}
          onSubmit={saveUserBudget}
        />
      )}

      {resetUser && (
        <PasswordResetModal
          user={resetUser}
          password={resetPassword}
          setPassword={setResetPassword}
          busy={busy === `reset-password-${resetUser.id}`}
          onClose={() => {
            setResetUser(null);
            setResetPassword('');
          }}
          onSubmit={resetPasswordForUser}
        />
      )}

      {viewContent && (
        <ContentModal
          item={viewContent}
          onClose={() => setViewContent(null)}
          onDelete={removeContent}
          busy={busy}
        />
      )}
      <AppFooter />
    </main>
  );
}

function AdminSidebar({ activePanel, onSelect }) {
  const items = [
    ['dashboard', 'Dashboard', ''],
    ['workspace', 'Workspace', ''],
    ['users', 'Users', ''],
    ['content', 'Content', ''],
    ['activity', 'Audit log', ''],
    ['system', 'AI & API', ''],
  ];
  return (
    <aside className='admin-sidebar' aria-label='Admin navigation'>
      <div className='admin-sidebar-label'>ADMIN</div>
      <nav>
        {items.map(([id, label, icon]) => (
          <button
            key={id}
            type='button'
            className={activePanel === id ? 'active' : ''}
            onClick={() =>
              id === 'workspace'
                ? (window.location.href = '/workspace')
                : onSelect(id)
            }
          >
            <span className='admin-sidebar-icon'>{icon}</span>
            <span>{label}</span>
            {activePanel === id && <i />}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function AdminTitle({ activePanel, onSelect, onCreate, onSystem }) {
  return (
    <div className='admin-title admin-title-pro'>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '6px',
        }}
      >
        {activePanel !== 'dashboard' && (
          <button
            type='button'
            onClick={() => onSelect('dashboard')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '11px',
              padding: 0,
              fontWeight: 700,
            }}
          >
            ← Back to dashboard
          </button>
        )}
        <span className='auth-eyebrow'>ADMIN WORKSPACE</span>
        <h1>
          {activePanel === 'dashboard'
            ? 'Control center'
            : activePanel === 'users'
            ? 'Users'
            : activePanel === 'content'
            ? 'Content library'
            : activePanel === 'activity'
            ? 'Audit log'
            : 'AI & API'}
        </h1>
        <p>
          {activePanel === 'users'
            ? 'Manage accounts, reports, API limits and user-specific exports.'
            : 'Manage accounts, generated content, activity, AI configuration and exports from one workspace.'}
        </p>
      </div>

      <div className='title-actions'>
        <button
          type='button'
          className='secondary-button admin-title-nav'
          onClick={onSystem}
        >
          AI & API settings
        </button>
        <button type='button' className='primary-button' onClick={onCreate}>
          ＋ Create user
        </button>
      </div>
    </div>
  );
}

function AdminMessage({ message, type, onClose }) {
  return (
    <div className={`admin-message ${type}`}>
      <span>{type === 'error' ? '!' : ''}</span>
      <div>{message}</div>
      <button type='button' onClick={onClose} aria-label='Close notification'>
        ×
      </button>
    </div>
  );
}

function AdminMetrics({
  stats,
  activePanel,
  onUsers,
  onActiveUsers,
  onContent,
  onActivity,
}) {
  return (
    <section className='metric-grid admin-metrics' aria-label='Admin metrics'>
      <Metric
        label='Users'
        value={stats.users ?? 0}
        icon=''
        tone='violet'
        active={activePanel === 'users'}
        onClick={onUsers}
      />
      <Metric
        label='Active users'
        value={stats.active_users ?? 0}
        icon=''
        tone='green'
        active={activePanel === 'users'}
        onClick={onActiveUsers}
      />
      <Metric
        label='Content generated'
        value={stats.content_generations ?? 0}
        icon=''
        tone='blue'
        active={activePanel === 'content'}
        onClick={onContent}
      />
      <Metric
        label='Activity events'
        value={stats.activities ?? 0}
        icon=''
        tone='orange'
        active={activePanel === 'activity'}
        onClick={onActivity}
      />
    </section>
  );
}

function Metric({ label, value, icon, tone, active, onClick }) {
  return (
    <button
      type='button'
      className={`metric-card metric-${tone}${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <div className='metric-icon'>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Click to view</small>
      <b>→</b>
    </button>
  );
}

function money(value) {
  const n = Number(value || 0);
  return `$${n.toFixed(n >= 0.01 ? 4 : 6)}`;
}

function formatTokens(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat().format(n);
}

function AIUsageStrip({ usage, onClearUsage, busy }) {
  const today = usage?.today || {};
  const month = usage?.month || {};
  const chats = usage?.recent_chats || [];
  return (
    <section className='ai-usage-strip' aria-label='AI usage and cost'>
      <div className='ai-usage-head'>
        <div>
          <span>AI USAGE & COST</span>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
             <h2>API consumption</h2>
             <button type="button" className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={onClearUsage} disabled={busy === "clear-usage"}>
               {busy === "clear-usage" ? "Clearing..." : "Clear"}
             </button>
          </div>
        </div>
        <small>Costs are calculated from recorded provider token usage.</small>
      </div>
      <div className='ai-usage-metrics'>
        <div className='ai-usage-primary'>
          <span>Total consumption tokens</span>
          <strong>
            {formatTokens(
              usage?.all_time?.total_tokens ||
                (usage?.all_time?.input_tokens || 0) +
                  (usage?.all_time?.output_tokens || 0)
            )}
          </strong>
          <small>{usage?.all_time?.api_calls || 0} API calls · i/p + o/p</small>
        </div>
        <div>
          <span>Total cost</span>
          <strong>{money(usage?.all_time?.cost_usd)}</strong>
          <small>All recorded provider usage</small>
        </div>
        <div>
          <span>Input tokens</span>
          <strong>{formatTokens(usage?.all_time?.input_tokens)}</strong>
          <small>All time</small>
        </div>
        <div>
          <span>Output tokens</span>
          <strong>{formatTokens(usage?.all_time?.output_tokens)}</strong>
          <small>All time</small>
        </div>
      </div>
      {chats.length > 0 && (
        <div className='ai-chat-usage-wrap'>
          <div className='ai-chat-usage-title'>Recent chats</div>
          <div className='table-wrap'>
            <table>
              <thead>
                <tr>
                  <th>Chat</th>
                  <th>Messages</th>
                  <th>API calls</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Provider / model</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {chats.slice(0, 8).map((chat) => (
                  <tr key={chat.session_id}>
                    <td>
                      <strong>{chat.user}</strong>
                      <small>{chat.session_id.slice(0, 8)}…</small>
                    </td>
                    <td>{chat.messages}</td>
                    <td>{chat.api_calls}</td>
                    <td>{formatTokens(chat.input_tokens)}</td>
                    <td>{formatTokens(chat.output_tokens)}</td>
                    <td>
                      <strong>{chat.provider}</strong>
                      <small>{chat.model}</small>
                    </td>
                    <td>
                      <strong>{money(chat.cost_usd)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function LoadingPanel() {
  return (
    <section className='admin-card admin-loading-panel'>
      <div className='loading-spinner' aria-hidden='true' />
      <h2>Loading admin data…</h2>
      <p>Connecting to the Django admin API.</p>
    </section>
  );
}

function UsersPanel({
  users,
  search,
  setSearch,
  status,
  setStatus,
  busy,
  onCreate,
  onToggle,
  onDelete,
  onResetPassword,
  onReport,
  onExport,
  onSort,
  sort,
  page,
  pageCount,
  onPage,
  onBudget,
  onExportReport,
  system,
}) {
  return (
    <section className='admin-card'>
      <PanelHead
        eyebrow='ACCOUNT MANAGEMENT'
        title={`Users · ${users.length}`}
        actions={
          <>
            <button
              type='button'
              className='secondary-button'
              onClick={() => onExport('users')}
              disabled={!!busy}
            >
              Export CSV
            </button>
            <button type='button' className='primary-button' onClick={onCreate}>
              ＋ Create user
            </button>
          </>
        }
      />

      <div className='user-admin-summary'>
        <div>
          <span>Total users</span>
          <strong>{users.length}</strong>
          <small>All accounts</small>
        </div>
        <div>
          <span>Active users</span>
          <strong>{users.filter((u) => u.is_active).length}</strong>
          <small>Only active accounts</small>
        </div>
        <div>
          <span>AI cost limits</span>
          <strong>
            {users
              .reduce((sum, u) => sum + Number(u.cost_limit_usd || 0), 0)
              .toFixed(2)}
          </strong>
          <small>Combined USD limits</small>
        </div>
        <div className='user-active-api'>
          <span>Active API</span>
          <strong>
            {(system?.providers || []).find(
              (p) => p.id === system?.active_provider
            )?.label ||
              system?.active_provider ||
              'Not configured'}
          </strong>
          <small>
            {(system?.providers || []).find(
              (p) => p.id === system?.active_provider
            )?.configured
              ? 'Key configured'
              : 'No key configured'}
          </small>
        </div>
      </div>
      <div className='filters'>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder='Search username, email or name…'
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value='all'>All statuses</option>
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
        </select>
      </div>

      <div className='table-wrap'>
        <table className='users-management-table'>
          <thead>
            <tr>
              <SortableTh
                label='User'
                sortKey='username'
                sort={sort}
                onSort={onSort}
              />
              <SortableTh
                label='Status'
                sortKey='status'
                sort={sort}
                onSort={onSort}
              />
              <th aria-label='User actions'></th>
            </tr>
          </thead>
          <tbody>
            {users.slice((page - 1) * 10, page * 10).map((user) => (
              <tr key={user.id}>
                <td>
                  <button
                    type='button'
                    className='user-cell user-cell-link'
                    onClick={() => onReport(user)}
                    disabled={!!busy}
                    aria-label={`Open ${user.username}'s account page`}
                  >
                    <span
                      className='user-profile-dot'
                      style={{ background: profileColor(user.id) }}
                    >
                      {(user.username || 'U').charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{user.username}</strong>
                      <small>{user.email}</small>
                    </div>
                  </button>
                </td>
                <td>
                  <span
                    className={`status-chip ${
                      user.is_active ? 'active' : 'inactive'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className='row-actions user-management-actions'>
                    <button
                      type='button'
                      className='status-button'
                      onClick={() =>
                        onToggle(user.id, user.username, user.is_active)
                      }
                      disabled={busy === `toggle-${user.id}`}
                    >
                      {user.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type='button'
                      className='status-button'
                      onClick={() => onResetPassword(user)}
                      disabled={!!busy}
                    >
                      Password
                    </button>

                    <button
                      type='button'
                      className='danger-button'
                      onClick={() => onDelete(user.id, user.username)}
                      disabled={busy === `delete-user-${user.id}`}
                    >
                      {busy === `delete-user-${user.id}` ? '…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!users.length && (
              <tr>
                <td colSpan='3' className='empty'>
                  No matching users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className='admin-pagination'>
          <button
            type='button'
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            ← Previous
          </button>
          <span>
            Page <b>{page}</b> of <b>{pageCount}</b>
          </span>
          <button
            type='button'
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}

function SortableTh({ label, sortKey, sort, onSort }) {
  const active = sort?.key === sortKey;
  return (
    <th>
      <button
        type='button'
        className={`sort-head${active ? ' active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        {label}{' '}
        <span>{active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
}

function profileColor(id) {
  const palette = [
    '#0b7bd5',
    '#7c3aed',
    '#0f9f7f',
    '#e06b1f',
    '#d33f7f',
    '#3156c9',
    '#0e8fa3',
    '#8a5a00',
    '#4c6fff',
    '#9b3dc6',
    '#167c4a',
    '#c0392b',
  ];
  return palette[Math.abs(Number(id || 0)) % palette.length];
}

function BudgetModal({ user, value, setValue, busy, onClose, onSubmit }) {
  return (
    <div
      className='modal-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className='modal-card budget-modal' onSubmit={onSubmit}>
        <div className='modal-head'>
          <div>
            <span className='auth-eyebrow'>ACCOUNT BUDGET</span>
            <h2>AI cost limit</h2>
            <p>
              {user.username} · {user.email}
            </p>
          </div>
          <button type='button' className='modal-close' onClick={onClose}>
            ×
          </button>
        </div>
        <label className='field-label'>
          Maximum AI spend (USD)
          <input
            type='number'
            min='0'
            step='0.0001'
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </label>
        <p className='budget-help'>
          Current limit: <b>${Number(user.cost_limit_usd || 0).toFixed(4)}</b>.
          Once recorded AI spend reaches this amount, new AI requests are
          blocked until an administrator increases the limit.
        </p>
        <div className='modal-actions'>
          <button type='button' className='secondary-button' onClick={onClose}>
            Cancel
          </button>
          <button className='primary-button' disabled={busy}>
            {busy ? 'Saving…' : 'Save limit'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ContentPanel({
  content,
  search,
  setSearch,
  type,
  setType,
  status,
  setStatus,
  busy,
  onView,
  onDelete,
  onExport,
}) {
  return (
    <section className='admin-card'>
      <PanelHead
        eyebrow='CONTENT LIBRARY'
        title={`Generated content · ${content.length}`}
        actions={
          <button
            type='button'
            className='secondary-button'
            onClick={onExport}
            disabled={!!busy}
          >
            Export CSV
          </button>
        }
      />

      <div className='filters'>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder='Search title, topic or user…'
        />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value='all'>All types</option>
          {CONTENT_CATALOG.flatMap((category) =>
            category.formats.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))
          )}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value='all'>All statuses</option>
          <option value='draft'>Draft</option>
          <option value='approved'>Approved</option>
        </select>
      </div>

      <div className='content-admin-grid'>
        {content.map((item) => (
          <article className='content-admin-card' key={item.id}>
            <div className='content-card-top'>
              <span className={`draft-type ${item.content_type}`}>
                {item.metadata?.format_label ||
                  CONTENT_FORMATS[item.content_type]?.label ||
                  item.content_type.replaceAll('_', ' ')}
              </span>
              <span>{new Date(item.created_at).toLocaleDateString()}</span>
            </div>

            <h3>{item.title || 'Untitled'}</h3>
            <p>{item.body_preview || item.topic}</p>

            <div className='content-meta'>
              <span>
                <b>Created by</b> {item.user || 'Unknown'}
              </span>
              <span>{item.word_count} words</span>
            </div>

            <div className='content-actions'>
              <button
                type='button'
                className='primary-button'
                onClick={() => onView(item)}
              >
                View
              </button>
              <button
                type='button'
                className='danger-button'
                onClick={() => onDelete(item.id, item.title)}
                disabled={busy === `content-${item.id}`}
              >
                {busy === `content-${item.id}` ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </article>
        ))}

        {!content.length && (
          <div className='empty content-empty'>
            No generated content matches these filters.
          </div>
        )}
      </div>
    </section>
  );
}

function ActivityPanel({
  activity,
  totalActivity,
  page,
  pageCount,
  onPage,
  users,
  action,
  setAction,
  user,
  setUser,
  busy,
  onExport,
}) {
  const actions = [
    ...new Map(
      activity.map((item) => [item.action_key, item.action])
    ).entries(),
  ];

  return (
    <section className='admin-card'>
      <PanelHead
        eyebrow='AUDIT LOG'
        title={`Activity · ${totalActivity}`}
        actions={
          <button
            type='button'
            className='secondary-button'
            onClick={onExport}
            disabled={!!busy}
          >
            Export CSV
          </button>
        }
      />

      <div className='filters'>
        <select
          value={action}
          onChange={(event) => setAction(event.target.value)}
        >
          <option value='all'>All actions</option>
          {actions.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select value={user} onChange={(event) => setUser(event.target.value)}>
          <option value='all'>All users</option>
          {users.map((item) => (
            <option key={item.id} value={item.id}>
              {item.username}
            </option>
          ))}
        </select>
      </div>

      <div className='activity-list admin-activity-list'>
        {activity.map((item) => (
          <div className='activity-row' key={item.id}>
            <div className='activity-icon'>•</div>
            <div>
              <strong>{item.user}</strong>
              <span>{item.action}</span>
              <small>{item.description}</small>
            </div>
            <time>{new Date(item.created_at).toLocaleString()}</time>
          </div>
        ))}

        {!activity.length && (
          <div className='empty'>No activity matches these filters.</div>
        )}
      </div>

      {pageCount > 1 && (
        <div className='admin-pagination'>
          <button
            type='button'
            className='secondary-button'
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            ← Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            type='button'
            className='secondary-button'
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}

function SystemPanel({ system, sites, onExport, busy, onProviderChange }) {
  const [provider, setProvider] = useState(system?.active_provider || 'gemini');
  const [apiKeys, setApiKeys] = useState({
    gemini: '',
    openai: '',
    anthropic: '',
  });

  useEffect(() => {
    if (system?.active_provider) setProvider(system.active_provider);
  }, [system?.active_provider]);

  const selected = (system?.providers || []).find(
    (item) => item.id === provider
  );
  const save = () => {
    const key = apiKeys[provider] || '';
    if (!selected?.configured && !key) return;
    onProviderChange?.(provider, key);
    if (key) setApiKeys((prev) => ({ ...prev, [provider]: '' }));
  };
  const removeKey = () => {
    if (selected?.key_source !== 'database') return;
    onProviderChange?.(provider, '', true);
    setApiKeys((prev) => ({ ...prev, [provider]: '' }));
  };

  return (
    <div className='system-grid'>
      <section className='admin-card ai-provider-management-card'>
        <PanelHead
          eyebrow='AI USAGE & COST'
          title='AI provider management'
          actions={
            <button
              type='button'
              className='secondary-button'
              onClick={onExport}
              disabled={busy === 'export-all'}
            >
              Export all
            </button>
          }
        />
        <p className='admin-help'>
          Configure the provider credentials here. The selected provider is the
          one every user will use for AI generation and the AI assistant.
        </p>

        <div className='provider-switcher'>
          {(system?.providers || []).map((item) => (
            <button
              type='button'
              key={item.id}
              className={`provider-choice ${
                provider === item.id ? 'active' : ''
              }`}
              onClick={() => setProvider(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.model}</small>
              <b>{item.configured ? 'Configured' : 'Not configured'}</b>
            </button>
          ))}
        </div>

        <div className='provider-key-editor'>
          <label>API key for {selected?.label || provider}</label>
          <div className='provider-key-row'>
            <input
              type='password'
              autoComplete='new-password'
              value={apiKeys[provider] || ''}
              onChange={(e) =>
                setApiKeys((prev) => ({ ...prev, [provider]: e.target.value }))
              }
              placeholder={
                selected?.configured
                  ? 'Configured — enter a new key to replace it'
                  : 'Paste provider API key'
              }
            />
            <button
              type='button'
              className='primary-button'
              onClick={save}
              disabled={
                busy === 'provider-global' ||
                (!selected?.configured && !apiKeys[provider])
              }
            >
              {busy === 'provider-global'
                ? 'Saving…'
                : `Save & use ${selected?.label || provider}`}
            </button>
            {selected?.key_source === 'database' && (
              <button
                type='button'
                className='secondary-button danger-button'
                onClick={removeKey}
                disabled={busy === 'provider-global'}
              >
                Remove key
              </button>
            )}
          </div>
          <small>
            Keys are stored encrypted on the server and are never returned to
            the browser.
          </small>
          {selected?.key_source === 'database' && (
            <small>A key is currently stored for this provider.</small>
          )}
        </div>

        <div className='active-provider-banner'>
          <span>ACTIVE API KEY FOR USERS</span>
          <strong>
            {(system?.providers || []).find(
              (item) => item.id === system?.active_provider
            )?.label ||
              system?.active_provider ||
              'Not selected'}
          </strong>
          <small>
            {(system?.providers || []).find(
              (item) => item.id === system?.active_provider
            )?.configured
              ? 'Key configured'
              : 'No API key configured'}{' '}
            ·{' '}
            {(
              (system?.providers || []).find(
                (item) => item.id === system?.active_provider
              )?.key_source || 'none'
            )
              .replace('database', 'Stored securely')
              .replace('environment', 'Environment')}
          </small>
        </div>

        <div className='provider-admin-list compact-provider-list'>
          {(system?.providers || []).map((item) => (
            <div
              className={`provider-admin${item.is_active ? ' is-active' : ''}`}
              key={item.id}
            >
              <div>
                <strong>{item.label}</strong>
                <small>{item.model}</small>
              </div>
              <span
                className={
                  item.is_active || item.configured ? 'configured' : 'missing'
                }
              >
                {item.is_active
                  ? 'Active'
                  : item.configured
                  ? 'Configured'
                  : 'Not configured'}
              </span>
              <small>
                {item.speed_label} · ${item.input_price}/1M input · $
                {item.output_price}/1M output
              </small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PanelHead({ eyebrow, title, actions }) {
  return (
    <div className='section-head'>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <div className='panel-actions'>{actions}</div>
    </div>
  );
}

function PasswordResetModal({
  user,
  password,
  setPassword,
  busy,
  onClose,
  onSubmit,
}) {
  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='modal-card password-admin-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Reset user password'
      >
        <div className='modal-head'>
          <div>
            <span className='auth-eyebrow'>ACCOUNT SECURITY</span>
            <h2>Reset password</h2>
            <p>Set a new password for {user.username}.</p>
          </div>
          <button className='modal-close' type='button' onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <label>
            New password
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoFocus
              required
              placeholder='At least 8 characters'
            />
          </label>
          <div className='modal-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
            >
              Cancel
            </button>
            <button type='submit' className='primary-button' disabled={busy}>
              {busy ? 'Saving…' : 'Reset password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CreateModal({ form, setForm, busy, onClose, onSubmit }) {
  return (
    <div
      className='modal-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className='modal-card admin-modal-pro' onSubmit={onSubmit}>
        <div className='modal-head'>
          <div>
            <span className='auth-eyebrow'>NEW ACCOUNT</span>
            <h2>Create user</h2>
          </div>
          <button type='button' className='modal-close' onClick={onClose}>
            ×
          </button>
        </div>

        <p>
          A temporary password is generated automatically. Credentials can be
          emailed through SMTP when configured.
        </p>

        <label>
          USERNAME
          <input
            required
            value={form.username}
            onChange={(event) =>
              setForm({ ...form, username: event.target.value })
            }
          />
        </label>

        <label>
          EMAIL
          <input
            required
            type='email'
            placeholder='name@example.com'
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
          />
        </label>

        <label className='checkbox'>
          <input
            type='checkbox'
            checked={form.send_credentials}
            onChange={(event) =>
              setForm({ ...form, send_credentials: event.target.checked })
            }
          />
          <span>Send login credentials by email</span>
        </label>

        <div className='modal-actions'>
          <button type='button' className='secondary-button' onClick={onClose}>
            Cancel
          </button>
          <button
            className='primary-button'
            disabled={!form.username || !form.email || busy === 'create'}
          >
            {busy === 'create' ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  );
}

function UserDetailPage({
  report,
  loading,
  system,
  busy,
  onBack,
  onToggle,
  onDelete,
  onResetPassword,
  onBudget,
  onExport,
}) {
  const user = report?.user || {};
  const summary = report?.summary || {};
  const content = report?.recent_content || [];
  const activity = report?.recent_activity || [];
  const usage = report?.recent_usage || [];
  const byType = report?.content_by_type || [];
  const byProvider = report?.usage_by_provider || [];
  const [tab, setTab] = useState('content');
  const number = (v) => new Intl.NumberFormat().format(Number(v || 0));
  const money = (v) => `$${Number(v || 0).toFixed(4)}`;
  const date = (v) => (v ? new Date(v).toLocaleString() : '—');
  const activeProvider = (system?.providers || []).find(
    (p) => p.id === system?.active_provider
  );
  const tabs = [
    ['content', 'Content by type'],
    ['providers', 'AI usage by provider'],
    ['generated', 'Recent generated content'],
    ['activity', 'Recent activity'],
    ['usage', 'Recent AI usage'],
  ];

  if (loading)
    return (
      <section className='admin-card user-detail-page'>
        <div className='report-loading'>
          <div className='loading-spinner' />
          <strong>Building user report…</strong>
          <span>Collecting content, activity and AI usage.</span>
        </div>
      </section>
    );

  return (
    <section className='admin-card user-detail-page'>
      <div className='user-detail-top'>
        <button type='button' className='secondary-button' onClick={onBack}>
          ← Back to Users
        </button>
        <div className='user-detail-actions'>
          <button
            type='button'
            className='secondary-button'
            onClick={() => onExport(tab)}
            disabled={!!busy}
          >
            Export section
          </button>
          <button
            type='button'
            className='primary-button'
            onClick={() => onExport('all')}
            disabled={!!busy}
          >
            Export full report
          </button>
        </div>
      </div>
      <div className='user-detail-hero'>
        <div className='report-user-identity'>
          <span
            className='user-profile-dot report-profile-dot'
            style={{ background: profileColor(user.id) }}
          >
            {(user.username || 'U').charAt(0).toUpperCase()}
          </span>
          <div>
            <span className='auth-eyebrow'>USER ACCOUNT</span>
            <h2>{user.username}</h2>
            <p>
              {user.email} ·{' '}
              <span
                className={`status-chip ${
                  user.is_active ? 'active' : 'inactive'
                }`}
              >
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </p>
          </div>
        </div>
        <div className='user-detail-actions'>
          <button
            type='button'
            className='secondary-button'
            onClick={() => onBudget(user)}
          >
            API limit
          </button>
          <button
            type='button'
            className='secondary-button'
            onClick={() => onResetPassword(user)}
          >
            Password
          </button>
          <button
            type='button'
            className='status-button'
            onClick={() => onToggle(user.id, user.username, user.is_active)}
          >
            {user.is_active ? 'Disable' : 'Enable'}
          </button>
          <button
            type='button'
            className='danger-button'
            onClick={() => onDelete(user.id, user.username)}
          >
            Delete
          </button>
        </div>
      </div>

      <div className='user-detail-info-grid'>
        <div>
          <span>Joined</span>
          <strong>{date(user.date_joined)}</strong>
        </div>
        <div>
          <span>Cost limit</span>
          <strong>{money(user.cost_limit_usd)}</strong>
        </div>
        <div>
          <span>Current AI spend</span>
          <strong>{money(summary.cost_usd)}</strong>
        </div>
        <div>
          <span>Active API</span>
          <strong>
            {activeProvider?.label ||
              system?.active_provider ||
              'Not configured'}
          </strong>
          <small>
            {activeProvider?.configured
              ? 'Key configured'
              : 'No key configured'}
          </small>
        </div>
      </div>

      <div className='report-stat-grid'>
        <div>
          <span>Content</span>
          <strong>{number(summary.content_total)}</strong>
          <small>
            {number(summary.drafts)} drafts · {number(summary.approved)}{' '}
            approved
          </small>
        </div>
        <div>
          <span>Total words</span>
          <strong>{number(summary.total_words)}</strong>
          <small>Across generated content</small>
        </div>
        <div>
          <span>Activity</span>
          <strong>{number(summary.activity_total)}</strong>
          <small>{number(summary.chat_sessions)} chat sessions</small>
        </div>
        <div>
          <span>AI calls</span>
          <strong>{number(summary.ai_api_calls)}</strong>
          <small>{number(summary.total_tokens)} total tokens</small>
        </div>
      </div>

      <div className='report-tabs' role='tablist'>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type='button'
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'content' && (
        <div className='report-section report-tab-panel'>
          <div className='report-section-head'>
            <strong>Content by type</strong>
          </div>
          {byType.length ? (
            byType.map((item) => (
              <div className='report-line' key={item.content_type}>
                <span>
                  {String(item.content_type || 'Other').replaceAll('_', ' ')}
                </span>
                <b>{number(item.count)}</b>
                <small>{number(item.words)} words</small>
              </div>
            ))
          ) : (
            <div className='report-empty'>No generated content.</div>
          )}
        </div>
      )}
      {tab === 'providers' && (
        <div className='report-section report-tab-panel'>
          <div className='report-section-head'>
            <strong>AI usage by provider</strong>
          </div>
          {byProvider.length ? (
            byProvider.map((item) => (
              <div className='report-line' key={item.provider}>
                <span>{item.provider || 'Unknown'}</span>
                <b>{number(item.api_calls)} calls</b>
                <small>{money(item.cost_usd)}</small>
              </div>
            ))
          ) : (
            <div className='report-empty'>No AI usage recorded.</div>
          )}
        </div>
      )}
      {tab === 'generated' && (
        <div className='report-section report-tab-panel'>
          <div className='report-section-head'>
            <strong>Recent generated content</strong>
            <span>Last 10</span>
          </div>
          <div className='table-wrap'>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Words</th>
                  <th>Query</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {content.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title || 'Untitled'}</strong>
                    </td>
                    <td>
                      {String(item.content_type || '').replaceAll('_', ' ')}
                    </td>
                    <td>{item.status}</td>
                    <td>{number(item.word_count)}</td>
                    <td>{item.topic || '—'}</td>
                    <td>{date(item.created_at)}</td>
                  </tr>
                ))}
                {!content.length && (
                  <tr>
                    <td colSpan='6' className='empty'>
                      No content generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'activity' && (
        <div className='report-section report-tab-panel'>
          <div className='report-section-head'>
            <strong>Recent activity</strong>
            <span>Last 15</span>
          </div>
          <div className='report-activity-list'>
            {activity.map((item) => (
              <div className='report-activity' key={item.id}>
                <div>
                  <strong>{item.action}</strong>
                  <small>{item.description || ''}</small>
                </div>
                <time>{date(item.created_at)}</time>
              </div>
            ))}
            {!activity.length && (
              <div className='report-empty'>No activity yet.</div>
            )}
          </div>
        </div>
      )}
      {tab === 'usage' && (
        <div className='report-section report-tab-panel'>
          <div className='report-section-head'>
            <strong>Recent AI usage</strong>
            <span>Last 10</span>
          </div>
          <div className='report-activity-list'>
            {usage.map((item) => (
              <div className='report-activity' key={item.id}>
                <div>
                  <strong>
                    {item.feature} · {item.provider}
                  </strong>
                  <small>
                    {number(item.total_tokens)} tokens · {money(item.cost_usd)}
                  </small>
                </div>
                <time>{date(item.created_at)}</time>
              </div>
            ))}
            {!usage.length && (
              <div className='report-empty'>No AI usage yet.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function UserReportModal({ report, loading, onClose, onExport, exportBusy }) {
  const user = report?.user || {};
  const summary = report?.summary || {};
  const content = report?.recent_content || [];
  const activity = report?.recent_activity || [];
  const usage = report?.recent_usage || [];
  const byType = report?.content_by_type || [];
  const byProvider = report?.usage_by_provider || [];
  const [tab, setTab] = useState('content');

  const number = (value) => new Intl.NumberFormat().format(Number(value || 0));
  const money = (value) => `$${Number(value || 0).toFixed(4)}`;
  const date = (value, fallback = '—') =>
    value ? new Date(value).toLocaleString() : fallback;
  const tabs = [
    ['content', 'Content by type'],
    ['providers', 'AI usage by provider'],
    ['generated', 'Recent generated content'],
    ['activity', 'Recent activity'],
    ['usage', 'Recent AI usage'],
  ];

  return (
    <div
      className='modal-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className='modal-card user-report-modal'
        role='dialog'
        aria-modal='true'
        aria-label='User report'
      >
        <div className='modal-head report-user-head'>
          <div className='report-user-identity'>
            <span
              className='user-profile-dot report-profile-dot'
              style={{ background: profileColor(user.id) }}
            >
              {(user.username || 'U').charAt(0).toUpperCase()}
            </span>
            <div>
              <span className='auth-eyebrow'>USER REPORT</span>
              <h2>{user.username || 'User'}</h2>
              <p>
                {user.email || 'No email'} ·{' '}
                {user.is_active ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
          <div className='report-head-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={() => onExport?.(tab)}
              disabled={!!exportBusy}
            >
              Export this section
            </button>
            <button
              type='button'
              className='primary-button'
              onClick={() => onExport?.('all')}
              disabled={!!exportBusy}
            >
              Export full report
            </button>
            <button type='button' className='modal-close' onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        {loading ? (
          <div className='report-loading'>
            <div className='loading-spinner' />
            <strong>Building user report…</strong>
            <span>Collecting content, activity and AI usage.</span>
          </div>
        ) : (
          <>
            <div className='report-account-meta'>
              <span>
                <b>Username</b>
                {user.username || '—'}
              </span>
              <span>
                <b>Joined</b>
                {date(user.date_joined)}
              </span>
              <span>
                <b>AI cost limit</b>$
                {Number(
                  summary.cost_limit_usd || user.cost_limit_usd || 0
                ).toFixed(4)}
              </span>
              <span>
                <b>Current AI spend</b>
                {money(summary.cost_usd)}
              </span>
            </div>

            <div className='report-stat-grid'>
              <div>
                <span>Content</span>
                <strong>{number(summary.content_total)}</strong>
                <small>
                  {number(summary.drafts)} drafts · {number(summary.approved)}{' '}
                  approved
                </small>
              </div>
              <div>
                <span>Total words</span>
                <strong>{number(summary.total_words)}</strong>
                <small>Across generated content</small>
              </div>
              <div>
                <span>Activity</span>
                <strong>{number(summary.activity_total)}</strong>
                <small>{number(summary.chat_sessions)} chat sessions</small>
              </div>
              <div>
                <span>AI cost</span>
                <strong>{money(summary.cost_usd)}</strong>
                <small>{number(summary.ai_api_calls)} API calls</small>
              </div>
              <div>
                <span>Total tokens</span>
                <strong>{number(summary.total_tokens)}</strong>
                <small>
                  {number(summary.input_tokens)} in ·{' '}
                  {number(summary.output_tokens)} out
                </small>
              </div>
              <div>
                <span>Chat messages</span>
                <strong>{number(summary.chat_messages)}</strong>
                <small>User messages across chats</small>
              </div>
            </div>

            <div
              className='report-tabs'
              role='tablist'
              aria-label='User report sections'
            >
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  type='button'
                  role='tab'
                  aria-selected={tab === id}
                  className={tab === id ? 'active' : ''}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'content' && (
              <div className='report-section report-tab-panel'>
                <div className='report-section-head'>
                  <strong>Content by type</strong>
                </div>
                {byType.length ? (
                  byType.map((item) => (
                    <div className='report-line' key={item.content_type}>
                      <span>
                        {String(item.content_type || 'Other').replaceAll(
                          '_',
                          ' '
                        )}
                      </span>
                      <b>{number(item.count)}</b>
                      <small>{number(item.words)} words</small>
                    </div>
                  ))
                ) : (
                  <div className='report-empty'>No generated content.</div>
                )}
              </div>
            )}

            {tab === 'providers' && (
              <div className='report-section report-tab-panel'>
                <div className='report-section-head'>
                  <strong>AI usage by provider</strong>
                </div>
                {byProvider.length ? (
                  byProvider.map((item) => (
                    <div className='report-line' key={item.provider}>
                      <span>{item.provider || 'Unknown'}</span>
                      <b>{number(item.api_calls)} calls</b>
                      <small>{money(item.cost_usd)}</small>
                    </div>
                  ))
                ) : (
                  <div className='report-empty'>No AI usage recorded.</div>
                )}
              </div>
            )}

            {tab === 'generated' && (
              <div className='report-section report-tab-panel'>
                <div className='report-section-head'>
                  <strong>Recent generated content</strong>
                  <span>Last 10</span>
                </div>
                <div className='table-wrap'>
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Words</th>
                        <th>Query</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.title || 'Untitled'}</strong>
                          </td>
                          <td>
                            {String(item.content_type || '').replaceAll(
                              '_',
                              ' '
                            )}
                          </td>
                          <td>{item.status}</td>
                          <td>{number(item.word_count)}</td>
                          <td>{item.topic || '—'}</td>
                          <td>{date(item.created_at)}</td>
                        </tr>
                      ))}
                      {!content.length && (
                        <tr>
                          <td colSpan='6' className='empty'>
                            No content generated yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'activity' && (
              <div className='report-section report-tab-panel'>
                <div className='report-section-head'>
                  <strong>Recent activity</strong>
                  <span>Last 15</span>
                </div>
                <div className='report-activity-list'>
                  {activity.map((item) => (
                    <div className='report-activity' key={item.id}>
                      <div>
                        <strong>{item.action}</strong>
                        <small>{item.description || ''}</small>
                      </div>
                      <time>{date(item.created_at)}</time>
                    </div>
                  ))}
                  {!activity.length && (
                    <div className='report-empty'>No activity yet.</div>
                  )}
                </div>
              </div>
            )}

            {tab === 'usage' && (
              <div className='report-section report-tab-panel'>
                <div className='report-section-head'>
                  <strong>Recent AI usage</strong>
                  <span>Last 10</span>
                </div>
                <div className='report-activity-list'>
                  {usage.map((item) => (
                    <div className='report-activity' key={item.id}>
                      <div>
                        <strong>
                          {item.feature} · {item.provider}
                        </strong>
                        <small>
                          {number(item.total_tokens)} tokens ·{' '}
                          {money(item.cost_usd)}
                        </small>
                      </div>
                      <time>{date(item.created_at)}</time>
                    </div>
                  ))}
                  {!usage.length && (
                    <div className='report-empty'>No AI usage yet.</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ContentModal({ item, onClose, onDelete, busy }) {
  const exportContentAsWord = (item) => {
    const text =
      (item.title ? item.title + '\n\n' : '') +
      (item.body || item.body_preview || item.topic || '');
    const blob = new Blob([text], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${item.title || 'document'}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportContentAsPDF = (item) => {
    const titleHtml = item.title ? `<h1>${item.title}</h1>` : '';
    const text = item.body || item.body_preview || item.topic || '';
    const win = window.open('', '_blank');
    win.document.write(
      `<html><head><title>${
        item.title || 'Document'
      }</title></head><body style="font-family:sans-serif;padding:20px;white-space:pre-wrap;">${titleHtml}${text}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div
      className='modal-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className='modal-card content-view-modal'>
        <div className='modal-head'>
          <div>
            <span className='auth-eyebrow'>CONTENT #{item.id}</span>
            <h2>{item.title || 'Untitled'}</h2>
          </div>
          <button type='button' className='modal-close' onClick={onClose}>
            ×
          </button>
        </div>

        <div className='content-view-meta'>
          <span>
            {item.metadata?.format_label ||
              CONTENT_FORMATS[item.content_type]?.label ||
              item.content_type}
          </span>
          <span>{item.user}</span>
          <span>{item.word_count} words</span>
        </div>

        <div className='content-view-body'>
          {item.content_type === 'comparator' ? (
            <>
              <ComparisonResult data={item} />
              {item.body &&
                !(
                  item.metadata?.comparison_rows?.length ||
                  item.comparison_rows?.length
                ) && (
                  <p style={{ whiteSpace: 'pre-line', marginTop: 12 }}>
                    {item.body}
                  </p>
                )}
            </>
          ) : (
            <p style={{ whiteSpace: 'pre-line' }}>
              {item.body ||
                item.body_preview ||
                item.topic ||
                'No content body.'}
            </p>
          )}
        </div>

        <div className='modal-actions'>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type='button'
              className='secondary-button'
              onClick={() => exportContentAsWord(item)}
            >
              Export Word
            </button>
            <button
              type='button'
              className='secondary-button'
              onClick={() => exportContentAsPDF(item)}
            >
              Export PDF
            </button>
          </div>
          <button type='button' className='secondary-button' onClick={onClose}>
            Close
          </button>
          <button
            type='button'
            className='danger-button'
            onClick={() => onDelete(item.id, item.title)}
            disabled={!!busy}
          >
            Delete content
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPasswordConfirmModal({ isOpen, onClose, onConfirm, busy, message }) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  
  // React to open state changes to reset form
  React.useEffect(() => {
    if (isOpen) {
      setPassword("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const user = getStoredUser();
    try {
      await login(user.email || user.username, password);
      onConfirm();
    } catch (err) {
      setError("Incorrect password.");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card password-admin-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="auth-eyebrow">SECURITY CONFIRMATION</span>
            <h2>Confirm Action</h2>
            <p>{message}</p>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            ADMIN PASSWORD
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
              placeholder="Enter your admin password"
            />
          </label>
          {error && <div className="auth-error auth-error-dark"><span>!</span><div>{error}</div></div>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button danger-button" disabled={busy}>
              {busy ? "Processing..." : "Confirm"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

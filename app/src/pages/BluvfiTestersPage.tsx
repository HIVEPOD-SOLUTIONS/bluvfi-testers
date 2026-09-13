import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import './BluvfiTestersPage.css'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
const STORAGE_KEY = 'bluvfiTesterToken'

type TesterUser = {
  id: string
  email: string
  fullName: string | null
  xHandle: string | null
  telegramHandle: string | null
  referralCode: string
  status: 'ACTIVE' | 'INACTIVE' | 'REMOVED'
  isSelected: boolean
  selectedAt: string | null
  removedFromSelectedAt: string | null
  removedFromSelectedReason: string | null
  lastActiveAt: string | null
  createdAt: string
  _count: {
    referrals: number
    activities: number
  }
}

type AdminTesterUser = TesterUser & {
  referredBy?: {
    email: string
    fullName: string | null
    referralCode: string
  } | null
}

type LeaderboardRow = {
  id: string
  name: string
  xHandle: string | null
  referralCode: string
  downlineCount: number
  activeDownlineCount: number
  selectedDownlineCount: number
  score: number
  lastActiveAt: string | null
}

type TesterStats = {
  registered: number
  selected: number
  selectedLimit: number
  selectedSlotsOpen: number
  active: number
  inactiveRemoved: number
}

type AuthMode = 'register' | 'login'

const emptyStats: TesterStats = {
  registered: 0,
  selected: 0,
  selectedLimit: 60,
  selectedSlotsOpen: 60,
  active: 0,
  inactiveRemoved: 0,
}

const formatDate = (value: string | null) => {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const readError = async (response: Response) => {
  try {
    const body = await response.json()
    return body.error || 'Request failed.'
  } catch {
    return 'Request failed.'
  }
}

export function BluvfiTestersPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('register')
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [user, setUser] = useState<TesterUser | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [stats, setStats] = useState<TesterStats>(emptyStats)
  const [adminUsers, setAdminUsers] = useState<AdminTesterUser[]>([])
  const [adminToken, setAdminToken] = useState('')
  const [adminReason, setAdminReason] = useState('No activity during the sprint.')
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [activityLoading, setActivityLoading] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    xHandle: '',
    telegramHandle: '',
    referralCode: '',
  })

  const referralUrl = useMemo(() => {
    if (!user?.referralCode) return ''
    const url = new URL(window.location.href)
    url.pathname = '/bluvfi-testers'
    url.searchParams.set('ref', user.referralCode)
    return url.toString()
  }, [user?.referralCode])

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      return (await response.json()) as T
    },
    [token],
  )

  const loadLeaderboard = useCallback(async () => {
    const data = await request<{
      leaderboard: LeaderboardRow[]
      stats: TesterStats
    }>('/api/bluvfi-testers/leaderboard')
    setLeaderboard(data.leaderboard)
    setStats(data.stats)
  }, [request])

  const loadMe = useCallback(async () => {
    if (!token) return
    const data = await request<{ user: TesterUser }>('/api/bluvfi-testers/me')
    setUser(data.user)
  }, [request, token])

  const loadPage = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadLeaderboard(), loadMe()])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load tester data.')
      if (token) {
        localStorage.removeItem(STORAGE_KEY)
        setToken('')
      }
    } finally {
      setLoading(false)
    }
  }, [loadLeaderboard, loadMe, token])

  useEffect(() => {
    const referralCode = new URLSearchParams(window.location.search).get('ref')
    if (referralCode) {
      setForm((current) => ({ ...current, referralCode }))
    }
  }, [])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setError('')
    setSuccess('')

    try {
      const path = authMode === 'register' ? '/register' : '/login'
      const payload =
        authMode === 'register'
          ? form
          : {
              email: form.email,
              password: form.password,
            }
      const data = await request<{ user: TesterUser; token: string }>(
        `/api/bluvfi-testers${path}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )

      localStorage.setItem(STORAGE_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
      setSuccess(authMode === 'register' ? 'Account created. You are now in the registered tester pool.' : 'Signed in.')
      await loadLeaderboard()
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  const markActivity = async () => {
    setActivityLoading(true)
    setError('')
    setSuccess('')

    try {
      const data = await request<{ user: TesterUser }>('/api/bluvfi-testers/activity', {
        method: 'POST',
        body: JSON.stringify({ note: 'Tester confirmed activity from the Bluvfi page.' }),
      })
      setUser(data.user)
      setSuccess('Activity recorded.')
      await loadLeaderboard()
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : 'Could not record activity.')
    } finally {
      setActivityLoading(false)
    }
  }

  const loadAdminUsers = async () => {
    setAdminLoading(true)
    setError('')

    try {
      const data = await request<{ users: AdminTesterUser[]; stats: TesterStats }>(
        '/api/bluvfi-testers/admin/users',
        {
          headers: { 'x-admin-token': adminToken.trim() },
        },
      )
      setAdminUsers(data.users)
      setStats(data.stats)
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : 'Could not load admin users.')
    } finally {
      setAdminLoading(false)
    }
  }

  const selectUser = async (id: string) => {
    setSelectingId(id)
    setError('')
    setSuccess('')

    try {
      const data = await request<{ stats: TesterStats }>(
        `/api/bluvfi-testers/admin/users/${id}/select`,
        {
          method: 'PATCH',
          headers: { 'x-admin-token': adminToken.trim() },
        },
      )
      setStats(data.stats)
      setSuccess('Tester added to the selected 60.')
      await Promise.all([loadAdminUsers(), loadLeaderboard()])
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : 'Could not select tester.')
    } finally {
      setSelectingId(null)
    }
  }
  const removeFromSelected = async (id: string) => {
    setRemovingId(id)
    setError('')
    setSuccess('')

    try {
      const data = await request<{ stats: TesterStats }>(
        `/api/bluvfi-testers/admin/users/${id}/remove-selection`,
        {
          method: 'PATCH',
          headers: { 'x-admin-token': adminToken.trim() },
          body: JSON.stringify({ reason: adminReason }),
        },
      )
      setStats(data.stats)
      setSuccess('Tester removed from the selected 60.')
      await Promise.all([loadAdminUsers(), loadLeaderboard()])
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove tester.')
    } finally {
      setRemovingId(null)
    }
  }

  const copyReferral = async () => {
    if (!referralUrl) return
    await navigator.clipboard.writeText(referralUrl)
    setSuccess('Referral link copied.')
  }

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken('')
    setUser(null)
    setSuccess('Signed out.')
  }

  return (
    <main className="bluvfi-page">
      <section className="bluvfi-hero" aria-labelledby="bluvfi-title">
        <div className="bluvfi-hero-copy">
          <p className="bluvfi-kicker">9 Prize rewards. Seven days. Android closed testing.</p>
          <h1 id="bluvfi-title">Bluvfi Closed Testers</h1>
          <p>
            Register for the September 14 to September 21 test sprint, track referrals, and
            help the Bluvfi team select 60 active testers from the registered pool.
          </p>
          <div className="bluvfi-actions" aria-label="Community links">
            <a className="bluvfi-button primary" href="#tester-account">
              Create account
            </a>
            <a
              className="bluvfi-button secondary"
              href="https://play.google.com/store/apps/details?id=com.bluvfi.xyz"
              target="_blank"
              rel="noreferrer"
            >
              Android app
            </a>
            <a
              className="bluvfi-button secondary"
              href="https://bluvfi.xyz"
              target="_blank"
              rel="noreferrer"
            >
              Bluvfi website
            </a>
            <a
              className="bluvfi-button secondary"
              href="https://app.notion.com/p/Bluvfi-Closed-Testers-App-Testing-3d7410fd0e648057a725f153215f8844?source=copy_link"
              target="_blank"
              rel="noreferrer"
            >
              Full guide
            </a>
            <a className="bluvfi-button secondary" href="https://t.me/+KXpDSUAnfg44MTg0">
              Telegram
            </a>
            <a
              className="bluvfi-button secondary"
              href="https://chat.whatsapp.com/HeYL6tc6Vl865T2lUhKg83?s=cl&p=a&mlu=4&ilr=4"
            >
              WhatsApp
            </a>
          </div>
          <p className="bluvfi-install-note">
            Already joined the closed test? Uninstall the closed test version first, then install
            the production Bluvfi app from Google Play.
          </p>
        </div>

        <div className="bluvfi-summary-panel" aria-label="Tester sprint summary">
          <div>
            <span>Rewards</span>
            <strong>9 prize rewards</strong>
          </div>
          <div>
            <span>Selected testers</span>
            <strong>
              {stats.selected}/{stats.selectedLimit}
            </strong>
          </div>
          <div>
            <span>Open slots</span>
            <strong>{stats.selectedSlotsOpen}</strong>
          </div>
          <div>
            <span>Submissions</span>
            <strong>Sept 21, 09:00-12:00 WAT</strong>
          </div>
        </div>
      </section>

      {error && (
        <div className="bluvfi-alert error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="bluvfi-alert success" role="status">
          {success}
        </div>
      )}

      {loading ? (
        <section className="bluvfi-grid" aria-label="Loading tester data">
          <div className="bluvfi-skeleton" />
          <div className="bluvfi-skeleton" />
        </section>
      ) : (
        <section className="bluvfi-grid">
          <div className="bluvfi-panel" id="tester-account">
            <div className="bluvfi-panel-header">
              <div>
                <p className="bluvfi-eyebrow">Tester account</p>
                <h2>{user ? 'Your tester profile' : 'Register or sign in'}</h2>
              </div>
              {user && (
                <button className="bluvfi-link-button" type="button" onClick={signOut}>
                  Sign out
                </button>
              )}
            </div>

            {user ? (
              <div className="bluvfi-profile">
                <div className="bluvfi-profile-card">
                  <span>Status</span>
                  <strong>{user.isSelected ? 'Selected tester' : 'Registered pool'}</strong>
                  <p>{user.status.toLowerCase()} · {user._count.referrals} referrals</p>
                </div>
                <div className="bluvfi-referral-box">
                  <label htmlFor="referral-link">Your referral link</label>
                  <input id="referral-link" readOnly value={referralUrl} />
                  <button className="bluvfi-button primary" type="button" onClick={copyReferral}>
                    Copy link
                  </button>
                </div>
                <button
                  className="bluvfi-button secondary"
                  type="button"
                  onClick={markActivity}
                  disabled={activityLoading}
                  aria-busy={activityLoading}
                >
                  {activityLoading ? 'Recording...' : 'Mark today active'}
                </button>
                <p className="bluvfi-muted">Last activity: {formatDate(user.lastActiveAt)}</p>
              </div>
            ) : (
              <>
                <div className="bluvfi-segmented" role="tablist" aria-label="Account mode">
                  <button
                    type="button"
                    className={authMode === 'register' ? 'active' : ''}
                    onClick={() => setAuthMode('register')}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    className={authMode === 'login' ? 'active' : ''}
                    onClick={() => setAuthMode('login')}
                  >
                    Sign in
                  </button>
                </div>

                <form className="bluvfi-form" onSubmit={handleAuth}>
                  {authMode === 'register' && (
                    <>
                      <div className="bluvfi-field">
                        <label htmlFor="fullName">Full name *</label>
                        <input
                          id="fullName"
                          value={form.fullName}
                          autoComplete="name"
                          onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                          required
                        />
                      </div>
                      <div className="bluvfi-field">
                        <label htmlFor="xHandle">X handle</label>
                        <input
                          id="xHandle"
                          value={form.xHandle}
                          placeholder="@yourhandle"
                          spellCheck={false}
                          onChange={(event) => setForm({ ...form, xHandle: event.target.value })}
                        />
                      </div>
                      <div className="bluvfi-field">
                        <label htmlFor="telegramHandle">Telegram handle</label>
                        <input
                          id="telegramHandle"
                          value={form.telegramHandle}
                          placeholder="@yourtelegram"
                          spellCheck={false}
                          onChange={(event) =>
                            setForm({ ...form, telegramHandle: event.target.value })
                          }
                        />
                      </div>
                    </>
                  )}

                  <div className="bluvfi-field">
                    <label htmlFor="email">Email *</label>
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      autoComplete="email"
                      spellCheck={false}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      required
                    />
                  </div>

                  <div className="bluvfi-field">
                    <label htmlFor="password">Password *</label>
                    <div className="bluvfi-password-row">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                        minLength={8}
                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="bluvfi-icon-button"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p>Password must be at least 8 characters.</p>
                  </div>

                  {authMode === 'register' && (
                    <div className="bluvfi-field">
                      <label htmlFor="referralCode">Referral code</label>
                      <input
                        id="referralCode"
                        value={form.referralCode}
                        spellCheck={false}
                        onChange={(event) => setForm({ ...form, referralCode: event.target.value })}
                      />
                    </div>
                  )}

                  <button
                    className="bluvfi-button primary"
                    type="submit"
                    disabled={authLoading}
                    aria-busy={authLoading}
                  >
                    {authLoading ? 'Please wait...' : authMode === 'register' ? 'Create account' : 'Sign in'}
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="bluvfi-panel">
            <div className="bluvfi-panel-header">
              <div>
                <p className="bluvfi-eyebrow">Leaderboard</p>
                <h2>Referral ranking</h2>
              </div>
              <button className="bluvfi-link-button" type="button" onClick={loadLeaderboard}>
                Refresh
              </button>
            </div>

            {leaderboard.length === 0 ? (
              <div className="bluvfi-empty">
                <strong>No referrals yet</strong>
                <p>Selected testers will appear here once they start inviting downlines.</p>
              </div>
            ) : (
              <ol className="bluvfi-leaderboard">
                {leaderboard.map((row, index) => (
                  <li key={row.id}>
                    <span className="bluvfi-rank">{index + 1}</span>
                    <div>
                      <strong>{row.name}</strong>
                      <p>{row.xHandle || row.referralCode}</p>
                    </div>
                    <dl>
                      <div>
                        <dt>Active</dt>
                        <dd>{row.activeDownlineCount}</dd>
                      </div>
                      <div>
                        <dt>Total</dt>
                        <dd>{row.downlineCount}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      <section className="bluvfi-panel bluvfi-admin" aria-labelledby="admin-title">
        <div className="bluvfi-panel-header">
          <div>
            <p className="bluvfi-eyebrow">Admin</p>
            <h2 id="admin-title">Registered testers</h2>
          </div>
          <div className="bluvfi-admin-controls">
            <label htmlFor="adminToken">Admin token</label>
            <input
              id="adminToken"
              type="password"
              value={adminToken}
              autoComplete="current-password"
              onChange={(event) => setAdminToken(event.target.value)}
            />
            <button
              className="bluvfi-button secondary"
              type="button"
              onClick={loadAdminUsers}
              disabled={adminLoading || !adminToken}
              aria-busy={adminLoading}
            >
              {adminLoading ? 'Loading...' : 'Load users'}
            </button>
          </div>
        </div>

        <div className="bluvfi-field bluvfi-reason">
          <label htmlFor="removeReason">Removal reason</label>
          <input
            id="removeReason"
            value={adminReason}
            onChange={(event) => setAdminReason(event.target.value)}
          />
        </div>

        {adminUsers.length === 0 ? (
          <div className="bluvfi-empty">
            <strong>No admin data loaded</strong>
            <p>Enter the backend admin token to see registered users, select the 60 testers, and remove inactive selected users.</p>
          </div>
        ) : (
          <div className="bluvfi-table-wrap">
            <table className="bluvfi-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Selected</th>
                  <th>Referrals</th>
                  <th>Last active</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((tester) => (
                  <tr key={tester.id}>
                    <td>
                      <strong>{tester.fullName || 'Unnamed tester'}</strong>
                      <span>{tester.xHandle || tester.telegramHandle || tester.referralCode}</span>
                    </td>
                    <td>{tester.email}</td>
                    <td>{tester.isSelected ? 'Selected' : 'Not selected'}</td>
                    <td>{tester._count.referrals}</td>
                    <td>{formatDate(tester.lastActiveAt)}</td>
                    <td>
                      <div className="bluvfi-table-actions">
                        <button
                          className="bluvfi-button secondary"
                          type="button"
                          onClick={() => selectUser(tester.id)}
                          disabled={tester.isSelected || selectingId === tester.id || stats.selected >= stats.selectedLimit}
                          aria-busy={selectingId === tester.id}
                        >
                          {selectingId === tester.id ? 'Selecting...' : 'Select'}
                        </button>
                        <button
                          className="bluvfi-button danger"
                          type="button"
                          onClick={() => removeFromSelected(tester.id)}
                          disabled={!tester.isSelected || removingId === tester.id}
                          aria-busy={removingId === tester.id}
                        >
                          {removingId === tester.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

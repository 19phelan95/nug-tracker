import { useState } from 'react'
import { useAuth } from '../../lib/supabase/auth.context'
import { useAppState } from '../../state/appState.context'

/**
 * Account + cloud sync controls. Renders nothing unless Supabase is configured
 * (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY present), so the local-first UI is
 * unchanged when cloud is off.
 */
export function AccountPanel() {
  const { configured, session, signIn, signUp, signOut } = useAuth()
  const { syncToCloud, loadFromCloud, pushFeedback } = useAppState()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (!configured) return null

  async function handleAuth(kind: 'in' | 'up') {
    if (!email || !password) {
      pushFeedback('Enter an email and password.', 'warn')
      return
    }
    setBusy(true)
    const result = kind === 'in' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (!result.ok) {
      pushFeedback(result.error ?? 'Authentication failed.', 'warn')
      return
    }
    setPassword('')
    pushFeedback(
      kind === 'in' ? 'Signed in.' : 'Account created. Check your email if confirmation is required.',
      'success',
    )
  }

  async function withBusy(action: () => Promise<void>) {
    setBusy(true)
    await action()
    setBusy(false)
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
      <div className="text-lg font-semibold text-white">Account &amp; cloud sync</div>
      <div className="mt-1 text-sm text-white/50">
        Sign in to sync your work sessions, life entries, and settings across devices. Your data is always saved
        locally too.
      </div>

      {session ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3 text-sm">
            <span className="text-white/55">Signed in as </span>
            <span className="font-medium text-white">{session.user.email ?? 'your account'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void withBusy(syncToCloud)}
              disabled={busy}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40"
            >
              Push this device → cloud
            </button>
            <button
              onClick={() => void withBusy(loadFromCloud)}
              disabled={busy}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-40"
            >
              Pull cloud → this device
            </button>
            <button
              onClick={() => void withBusy(async () => { await signOut(); pushFeedback('Signed out.', 'neutral') })}
              disabled={busy}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-40"
            >
              Sign out
            </button>
          </div>
          <div className="text-xs text-white/40">
            Changes sync automatically while signed in. Use “Pull” on a second device to load this account’s data.
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-white/60">
              <div className="mb-1">Email</div>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/25"
              />
            </label>
            <label className="text-sm text-white/60">
              <div className="mb-1">Password</div>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/25"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleAuth('in')}
              disabled={busy}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40"
            >
              Sign in
            </button>
            <button
              onClick={() => void handleAuth('up')}
              disabled={busy}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-40"
            >
              Create account
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

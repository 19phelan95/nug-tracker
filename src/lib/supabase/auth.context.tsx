import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './client'

export interface AuthResult {
  ok: boolean
  error?: string
}

interface AuthContextValue {
  /** Whether Supabase env vars are present. When false the app is local-only. */
  configured: boolean
  /** True once the initial session check has resolved (always true if unconfigured). */
  ready: boolean
  session: Session | null
  user: User | null
  signUp: (email: string, password: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // If cloud is not configured there is nothing to wait for.
  const [ready, setReady] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      ready,
      session,
      user: session?.user ?? null,
      async signUp(email, password) {
        if (!supabase) return { ok: false, error: 'Cloud sync is not configured.' }
        const { error } = await supabase.auth.signUp({ email, password })
        return error ? { ok: false, error: error.message } : { ok: true }
      },
      async signIn(email, password) {
        if (!supabase) return { ok: false, error: 'Cloud sync is not configured.' }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? { ok: false, error: error.message } : { ok: true }
      },
      async signOut() {
        if (!supabase) return
        await supabase.auth.signOut()
      },
    }),
    [ready, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

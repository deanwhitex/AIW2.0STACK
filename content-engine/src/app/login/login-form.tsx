"use client"

import { useActionState } from "react"
import { signIn, signUp, type AuthState } from "./actions"

const initialState: AuthState = {}

export function LoginForm({
  mode,
  next,
}: {
  mode: "sign-in" | "sign-up" | "locked"
  next: string
}) {
  const action = mode === "sign-up" ? signUp : signIn
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="text-xs font-medium text-[color:var(--color-secondary)]"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="text-xs font-medium text-[color:var(--color-secondary)]"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          required
          minLength={8}
          className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
        />
        {mode === "sign-up" ? (
          <p className="text-[11px] text-[color:var(--color-muted)]">
            At least 8 characters. Save it somewhere safe.
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p className="rounded-md border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/10 px-3 py-2 text-xs text-[color:var(--color-danger)]">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[color:var(--color-accent)] px-3 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending
          ? mode === "sign-up"
            ? "Creating owner account..."
            : "Signing in..."
          : mode === "sign-up"
            ? "Create owner account"
            : "Sign in"}
      </button>
    </form>
  )
}

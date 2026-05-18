"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Input, Label, Textarea } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type Business = {
  niche: string
  avatar_description: string
  offer_description: string
  lead_magnet: string
  default_comment_keyword: string
  geographic_focus: string
}

type Voice = {
  tone_descriptor: string
  catchphrases: string
  do_not_use_phrases: string
  sample_transcripts: string[]
}

type SecretStatus = { configured: boolean; source: "env" | "db" | null }

export function SettingsClient() {
  const [loaded, setLoaded] = useState(false)
  const [secrets, setSecrets] = useState<Record<string, SecretStatus>>({})
  const [biz, setBiz] = useState<Business>({
    niche: "",
    avatar_description: "",
    offer_description: "",
    lead_magnet: "",
    default_comment_keyword: "",
    geographic_focus: "",
  })
  const [voice, setVoice] = useState<Voice>({
    tone_descriptor: "",
    catchphrases: "",
    do_not_use_phrases: "",
    sample_transcripts: [],
  })

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/setup/state")
      if (res.ok) {
        const json = await res.json()
        setSecrets(json.secrets ?? {})
        if (json.business) {
          setBiz({
            niche: json.business.niche ?? "",
            avatar_description: json.business.avatar_description ?? "",
            offer_description: json.business.offer_description ?? "",
            lead_magnet: json.business.lead_magnet ?? "",
            default_comment_keyword: json.business.default_comment_keyword ?? "",
            geographic_focus: json.business.geographic_focus ?? "",
          })
        }
        if (json.voice) {
          setVoice({
            tone_descriptor: json.voice.tone_descriptor ?? "",
            catchphrases: (json.voice.catchphrases ?? []).join(", "),
            do_not_use_phrases: (json.voice.do_not_use_phrases ?? []).join(", "),
            sample_transcripts: json.voice.sample_transcripts ?? [],
          })
        }
      }
      setLoaded(true)
    })()
  }, [])

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[color:var(--color-muted)]" />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <header className="space-y-1">
        <h1 className="aiw-wordmark text-display text-[color:var(--color-foreground)]">Settings</h1>
        <p className="text-sm text-[color:var(--color-secondary)]">
          API keys, business profile, voice profile.
        </p>
      </header>

      <ApiKeysCard
        secrets={secrets}
        onChange={(s) => setSecrets(s)}
      />
      <BusinessCard biz={biz} setBiz={setBiz} />
      <VoiceCard voice={voice} setVoice={setVoice} />

      <Card>
        <CardContent className="flex items-center justify-between pt-5">
          <div>
            <CardTitle>Account</CardTitle>
            <CardDescription>Re-run onboarding or sign out.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/setup">Re-run onboarding</Link>
            </Button>
            <form action="/api/auth/signout" method="post">
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function ApiKeysCard({
  secrets,
  onChange,
}: {
  secrets: Record<string, SecretStatus>
  onChange: (s: Record<string, SecretStatus>) => void
}) {
  const [a, setA] = useState("")
  const [p, setP] = useState("")
  const [as, setAs] = useState("")
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const res = await fetch("/api/setup/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          anthropic_api_key: a || undefined,
          apify_api_token: p || undefined,
          assemblyai_api_key: as || undefined,
        }),
      })
      if (!res.ok) throw new Error("save failed")
      toast.success("Keys saved")
      const stateRes = await fetch("/api/setup/state")
      const json = await stateRes.json().catch(() => null)
      if (json?.secrets) onChange(json.secrets)
      setA("")
      setP("")
      setAs("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <CardTitle>API keys</CardTitle>
          <CardDescription className="m-0">Stored in Supabase, encrypted via service role.</CardDescription>
        </div>
        <KeyRow
          label="Anthropic"
          value={a}
          onChange={setA}
          status={secrets.anthropic_api_key}
        />
        <KeyRow label="Apify" value={p} onChange={setP} status={secrets.apify_api_token} />
        <KeyRow
          label="AssemblyAI"
          value={as}
          onChange={setAs}
          status={secrets.assemblyai_api_key}
        />
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy || (!a && !p && !as)}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {busy ? "Saving..." : "Save keys"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function KeyRow({
  label,
  value,
  onChange,
  status,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  status?: SecretStatus
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Badge tone={status?.configured ? "success" : "warning"}>
          {status?.configured ? (status.source === "env" ? "via env var" : "saved") : "not set"}
        </Badge>
      </div>
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={status?.configured ? "Replace existing key" : "Paste key"}
      />
    </div>
  )
}

function BusinessCard({
  biz,
  setBiz,
}: {
  biz: Business
  setBiz: (b: Business) => void
}) {
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      const res = await fetch("/api/setup/business", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          niche: biz.niche || null,
          avatar_description: biz.avatar_description || null,
          offer_description: biz.offer_description || null,
          lead_magnet: biz.lead_magnet || null,
          default_comment_keyword: biz.default_comment_keyword
            ? biz.default_comment_keyword.toUpperCase()
            : null,
          geographic_focus: biz.geographic_focus || null,
        }),
      })
      if (!res.ok) throw new Error("save failed")
      toast.success("Business profile saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <CardTitle>Business profile</CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Niche</Label>
            <Input value={biz.niche} onChange={(e) => setBiz({ ...biz, niche: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Avatar</Label>
            <Textarea
              rows={3}
              value={biz.avatar_description}
              onChange={(e) => setBiz({ ...biz, avatar_description: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Offer</Label>
            <Textarea
              rows={2}
              value={biz.offer_description}
              onChange={(e) => setBiz({ ...biz, offer_description: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Lead magnet</Label>
            <Input
              value={biz.lead_magnet}
              onChange={(e) => setBiz({ ...biz, lead_magnet: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Default keyword</Label>
            <Input
              value={biz.default_comment_keyword}
              onChange={(e) =>
                setBiz({ ...biz, default_comment_keyword: e.target.value.toUpperCase() })
              }
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Geographic focus</Label>
            <Input
              value={biz.geographic_focus}
              onChange={(e) => setBiz({ ...biz, geographic_focus: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save business profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function VoiceCard({
  voice,
  setVoice,
}: {
  voice: Voice
  setVoice: (v: Voice) => void
}) {
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const res = await fetch("/api/setup/voice", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tone_descriptor: voice.tone_descriptor || null,
          catchphrases: voice.catchphrases.split(",").map((s) => s.trim()).filter(Boolean),
          do_not_use_phrases: voice.do_not_use_phrases
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          sample_transcripts: voice.sample_transcripts.filter((s) => s && s.trim().length > 0),
        }),
      })
      if (!res.ok) throw new Error("save failed")
      toast.success("Voice profile saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <CardTitle>Voice profile</CardTitle>
        <div className="space-y-1">
          <Label>Tone descriptor</Label>
          <Input
            value={voice.tone_descriptor}
            onChange={(e) => setVoice({ ...voice, tone_descriptor: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Catchphrases (comma-separated)</Label>
            <Input
              value={voice.catchphrases}
              onChange={(e) => setVoice({ ...voice, catchphrases: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Do not use (comma-separated)</Label>
            <Input
              value={voice.do_not_use_phrases}
              onChange={(e) => setVoice({ ...voice, do_not_use_phrases: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Sample transcripts</Label>
          {voice.sample_transcripts.map((s, i) => (
            <Textarea
              key={i}
              rows={3}
              value={s}
              onChange={(e) => {
                const next = voice.sample_transcripts.slice()
                next[i] = e.target.value
                setVoice({ ...voice, sample_transcripts: next })
              }}
            />
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setVoice({
                ...voice,
                sample_transcripts: [...voice.sample_transcripts, ""],
              })
            }
          >
            Add sample
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save voice profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

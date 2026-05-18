"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Input, Label, Textarea } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type SecretStatus = { configured: boolean; source: "env" | "db" | null }

type State = {
  step: number
  loaded: boolean
  secrets: Record<string, SecretStatus>
  business: {
    niche: string | null
    avatar_description: string | null
    offer_description: string | null
    lead_magnet: string | null
    default_comment_keyword: string | null
    geographic_focus: string | null
  }
  voice: {
    tone_descriptor: string | null
    catchphrases: string[]
    do_not_use_phrases: string[]
    sample_transcripts: string[]
  }
  has_watch: boolean
}

const NICHE_QUESTIONS = [
  "What kind of business have you built before, even small ones?",
  "What are you genuinely good at — skills, knowledge, things people ask you about?",
  "Who do you most enjoy helping?",
  "What problem do you find yourself solving over and over for people?",
  "What industry have you worked in or been around the most?",
  "What's a result you've personally achieved that others would want?",
  "Where are you geographically based?",
  "What's your dream version of this business in 12 months?",
]

export function SetupWizard() {
  const router = useRouter()
  const [state, setState] = useState<State>({
    step: 0,
    loaded: false,
    secrets: {},
    business: {
      niche: null,
      avatar_description: null,
      offer_description: null,
      lead_magnet: null,
      default_comment_keyword: null,
      geographic_focus: null,
    },
    voice: {
      tone_descriptor: null,
      catchphrases: [],
      do_not_use_phrases: [],
      sample_transcripts: [],
    },
    has_watch: false,
  })

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/setup/state")
        if (!res.ok) throw new Error("failed")
        const json = await res.json()
        setState((s) => ({
          ...s,
          loaded: true,
          step: json.onboarding_step ?? 0,
          secrets: json.secrets ?? {},
          business: json.business ? { ...s.business, ...json.business } : s.business,
          voice: json.voice ? { ...s.voice, ...json.voice } : s.voice,
          has_watch: json.has_watch ?? false,
        }))
      } catch {
        setState((s) => ({ ...s, loaded: true }))
      }
    })()
  }, [])

  function setStep(step: number) {
    setState((s) => ({ ...s, step }))
    void fetch("/api/setup/business", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ onboarding_step: step }),
    })
  }

  if (!state.loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[color:var(--color-muted)]" />
      </div>
    )
  }

  const TOTAL = 6
  const stepTitles = [
    "API keys",
    "Niche & avatar",
    "Voice capture",
    "Radar seed",
    "Expert Brain seed",
    "First generation",
  ]

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
          Setup · {state.step + 1} / {TOTAL}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{stepTitles[state.step]}</h1>
      </header>

      <ProgressDots step={state.step} total={TOTAL} />

      {state.step === 0 ? (
        <StepKeys
          secrets={state.secrets}
          onDone={() => setStep(1)}
        />
      ) : null}
      {state.step === 1 ? (
        <StepNiche
          business={state.business}
          onProposalApplied={(business) => {
            setState((s) => ({ ...s, business: { ...s.business, ...business } }))
            setStep(2)
          }}
          onBack={() => setStep(0)}
        />
      ) : null}
      {state.step === 2 ? (
        <StepVoice
          voice={state.voice}
          onSaved={(voice) => {
            setState((s) => ({ ...s, voice: { ...s.voice, ...voice } }))
            setStep(3)
          }}
          onBack={() => setStep(1)}
        />
      ) : null}
      {state.step === 3 ? (
        <StepRadar
          niche={state.business.niche ?? ""}
          avatar={state.business.avatar_description ?? null}
          offer={state.business.offer_description ?? null}
          onApplied={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      ) : null}
      {state.step === 4 ? (
        <StepExpertBrain
          niche={state.business.niche ?? ""}
          avatar={state.business.avatar_description ?? null}
          onApplied={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      ) : null}
      {state.step === 5 ? (
        <StepFirstGeneration
          business={state.business}
          onComplete={() => {
            void fetch("/api/setup/business", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                onboarding_step: TOTAL,
                onboarding_completed_at: new Date().toISOString(),
              }),
            })
            router.push("/")
            router.refresh()
          }}
          onBack={() => setStep(4)}
        />
      ) : null}
    </main>
  )
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-1 flex-1 rounded-full transition-colors"
          style={{
            background:
              i <= step ? "var(--color-accent)" : "var(--color-border)",
          }}
        />
      ))}
    </div>
  )
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled,
  busy,
  hideBack,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  busy?: boolean
  hideBack?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      {!hideBack && onBack ? (
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={onNext} disabled={nextDisabled || busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {nextLabel} <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ============================================================================
// Step 0 — API keys
// ============================================================================

function StepKeys({
  secrets,
  onDone,
}: {
  secrets: Record<string, SecretStatus>
  onDone: () => void
}) {
  const [anthropic, setAnthropic] = useState("")
  const [apify, setApify] = useState("")
  const [assembly, setAssembly] = useState("")
  const [busy, setBusy] = useState(false)

  function statusLabel(s?: SecretStatus): string {
    if (!s?.configured) return "not set"
    return s.source === "env" ? "set via env var" : "saved"
  }

  async function save() {
    setBusy(true)
    try {
      const res = await fetch("/api/setup/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          anthropic_api_key: anthropic || undefined,
          apify_api_token: apify || undefined,
          assemblyai_api_key: assembly || undefined,
        }),
      })
      if (!res.ok) throw new Error("save failed")
      toast.success("Keys saved")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <p className="text-xs text-[color:var(--color-secondary)]">
          Enter your three API keys. The app runs in demo mode with stub data until at least
          Anthropic is configured. Skip any key you don't have yet — you can come back via
          Settings.
        </p>

        <KeyField
          label="Anthropic API key"
          value={anthropic}
          onChange={setAnthropic}
          status={statusLabel(secrets.anthropic_api_key)}
          link="https://console.anthropic.com"
        />
        <KeyField
          label="Apify API token"
          value={apify}
          onChange={setApify}
          status={statusLabel(secrets.apify_api_token)}
          link="https://console.apify.com/account/integrations"
        />
        <KeyField
          label="AssemblyAI API key"
          value={assembly}
          onChange={setAssembly}
          status={statusLabel(secrets.assemblyai_api_key)}
          link="https://www.assemblyai.com/app/account"
        />

        <NavButtons
          onNext={save}
          nextLabel={busy ? "Saving..." : "Save & continue"}
          busy={busy}
          hideBack
        />
      </CardContent>
    </Card>
  )
}

function KeyField({
  label,
  value,
  onChange,
  status,
  link,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  status: string
  link: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Badge tone={status === "not set" ? "warning" : "success"}>{status}</Badge>
      </div>
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={status === "not set" ? "Paste here" : "Replace existing"}
      />
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="text-[10px] text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)]"
      >
        Get a key →
      </a>
    </div>
  )
}

// ============================================================================
// Step 1 — Niche interview + AI proposal
// ============================================================================

function StepNiche({
  business,
  onProposalApplied,
  onBack,
}: {
  business: State["business"]
  onProposalApplied: (b: Partial<State["business"]>) => void
  onBack: () => void
}) {
  const [answers, setAnswers] = useState<string[]>(NICHE_QUESTIONS.map(() => ""))
  const [proposal, setProposal] = useState<{
    niche: string
    avatar: string
    offer: string
    voice_tone: string
  } | null>(
    business.niche
      ? { niche: business.niche, avatar: business.avatar_description ?? "", offer: business.offer_description ?? "", voice_tone: "" }
      : null
  )
  const [busy, setBusy] = useState(false)
  const [niche, setNiche] = useState(business.niche ?? "")
  const [avatar, setAvatar] = useState(business.avatar_description ?? "")
  const [offer, setOffer] = useState(business.offer_description ?? "")
  const [keyword, setKeyword] = useState(business.default_comment_keyword ?? "")
  const [leadMagnet, setLeadMagnet] = useState(business.lead_magnet ?? "")

  async function propose() {
    setBusy(true)
    try {
      const map: Record<string, string> = {}
      NICHE_QUESTIONS.forEach((q, i) => {
        if (answers[i]?.trim()) map[q] = answers[i].trim()
      })
      const res = await fetch("/api/setup/propose-niche", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: map }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Proposal failed (${res.status})`)
      }
      const json = await res.json()
      setProposal(json.proposal)
      setNiche(json.proposal.niche)
      setAvatar(json.proposal.avatar)
      setOffer(json.proposal.offer)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!niche.trim()) {
      toast.error("Niche is required")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/setup/business", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          niche: niche.trim(),
          avatar_description: avatar.trim() || null,
          offer_description: offer.trim() || null,
          lead_magnet: leadMagnet.trim() || null,
          default_comment_keyword: keyword.trim().toUpperCase() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Save failed (${res.status})`)
      }
      const json = await res.json()
      onProposalApplied(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        {!proposal ? (
          <>
            <p className="text-xs text-[color:var(--color-secondary)]">
              Eight short answers. Skip any you can't answer. Claude turns this into a niche +
              avatar + offer hypothesis. You can edit before saving.
            </p>
            {NICHE_QUESTIONS.map((q, i) => (
              <div key={i} className="space-y-1">
                <Label>{q}</Label>
                <Textarea
                  rows={2}
                  value={answers[i]}
                  onChange={(e) => {
                    const next = answers.slice()
                    next[i] = e.target.value
                    setAnswers(next)
                  }}
                />
              </div>
            ))}
            <NavButtons
              onBack={onBack}
              onNext={propose}
              nextLabel="Propose"
              busy={busy}
            />
          </>
        ) : (
          <>
            <p className="text-xs text-[color:var(--color-secondary)]">
              Edit anything that's wrong. These power every script the engine writes.
            </p>
            <div className="space-y-1">
              <Label>Niche</Label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Avatar</Label>
              <Textarea
                rows={3}
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Offer</Label>
              <Textarea rows={2} value={offer} onChange={(e) => setOffer(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Lead magnet</Label>
                <Input
                  value={leadMagnet}
                  onChange={(e) => setLeadMagnet(e.target.value)}
                  placeholder="e.g. WEB checklist"
                />
              </div>
              <div className="space-y-1">
                <Label>Default comment keyword</Label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value.toUpperCase())}
                  placeholder="WEB"
                />
              </div>
            </div>
            <NavButtons onBack={onBack} onNext={save} nextLabel="Save & continue" busy={busy} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Step 2 — Voice capture
// ============================================================================

function StepVoice({
  voice,
  onSaved,
  onBack,
}: {
  voice: State["voice"]
  onSaved: (v: Partial<State["voice"]>) => void
  onBack: () => void
}) {
  const [tone, setTone] = useState(voice.tone_descriptor ?? "")
  const [samples, setSamples] = useState<string[]>(
    voice.sample_transcripts.length ? voice.sample_transcripts : ["", "", ""]
  )
  const [doNotUse, setDoNotUse] = useState((voice.do_not_use_phrases ?? []).join(", "))
  const [catchphrases, setCatchphrases] = useState((voice.catchphrases ?? []).join(", "))
  const [busy, setBusy] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)

  async function uploadAudio() {
    if (!audioFile) return
    const fd = new FormData()
    fd.append("file", audioFile)
    fd.append("bucket", "my_voice")
    fd.append("title", `Voice memo · ${new Date().toLocaleDateString()}`)
    setBusy(true)
    try {
      const res = await fetch("/api/context/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload failed")
      toast.success("Audio uploaded. We'll transcribe it in the background.")
      setAudioFile(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    const cleanSamples = samples.map((s) => s.trim()).filter(Boolean)
    if (cleanSamples.length === 0 && !audioFile) {
      toast.error("Paste at least one sample or upload an audio file")
      return
    }
    setBusy(true)
    try {
      if (audioFile) await uploadAudio()
      const res = await fetch("/api/setup/voice", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tone_descriptor: tone.trim() || null,
          sample_transcripts: cleanSamples,
          do_not_use_phrases: splitList(doNotUse),
          catchphrases: splitList(catchphrases),
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      const json = await res.json()
      onSaved(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <p className="text-xs text-[color:var(--color-secondary)]">
          The engine writes in your voice. Paste 3 captions you've written OR upload a voice memo
          and we transcribe it. Add catchphrases and phrases to ban (LinkedIn-isms, etc).
        </p>

        <div className="space-y-1">
          <Label>Tone descriptor</Label>
          <Input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Direct, profanity-friendly, lots of rhetorical questions, 5th-grade reading level"
          />
        </div>

        {samples.map((s, i) => (
          <div key={i} className="space-y-1">
            <Label>Sample {i + 1}</Label>
            <Textarea
              rows={3}
              value={s}
              onChange={(e) => {
                const next = samples.slice()
                next[i] = e.target.value
                setSamples(next)
              }}
              placeholder="Paste a caption, post, or paragraph of your writing"
            />
          </div>
        ))}

        <div className="space-y-1">
          <Label>Or upload a voice memo (optional)</Label>
          <input
            type="file"
            accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-[color:var(--color-secondary)] file:mr-2 file:rounded file:border-0 file:bg-[color:var(--color-surface-raised)] file:px-3 file:py-1.5 file:text-xs file:text-[color:var(--color-foreground)]"
          />
          {audioFile ? (
            <p className="text-[10px] text-[color:var(--color-muted)]">
              Selected: {audioFile.name}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Catchphrases (comma-separated)</Label>
            <Input
              value={catchphrases}
              onChange={(e) => setCatchphrases(e.target.value)}
              placeholder="let's go, no cap, honestly"
            />
          </div>
          <div className="space-y-1">
            <Label>Do not use (comma-separated)</Label>
            <Input
              value={doNotUse}
              onChange={(e) => setDoNotUse(e.target.value)}
              placeholder="leverage, synergy, delve"
            />
          </div>
        </div>

        <NavButtons onBack={onBack} onNext={save} nextLabel="Save & continue" busy={busy} />
      </CardContent>
    </Card>
  )
}

function splitList(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

// ============================================================================
// Step 3 — Radar seed
// ============================================================================

function StepRadar({
  niche,
  avatar,
  offer,
  onApplied,
  onBack,
}: {
  niche: string
  avatar: string | null
  offer: string | null
  onApplied: () => void
  onBack: () => void
}) {
  const [proposal, setProposal] = useState<{
    hashtags: { platform: string; value: string }[]
    creator_handles: { platform: string; value: string }[]
  } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!niche) return
    void (async () => {
      setBusy(true)
      try {
        const res = await fetch("/api/setup/propose-radar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "propose",
            niche,
            avatar: avatar ?? undefined,
            offer: offer ?? undefined,
          }),
        })
        if (!res.ok) throw new Error("Propose failed")
        const json = await res.json()
        setProposal(json.proposal)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed")
      } finally {
        setBusy(false)
      }
    })()
  }, [niche, avatar, offer])

  function toggle(kind: "hashtags" | "creator_handles", value: string) {
    if (!proposal) return
    setProposal({
      ...proposal,
      [kind]: proposal[kind].map((x) =>
        x.value === value ? { ...x, _excluded: !(x as { _excluded?: boolean })._excluded } : x
      ) as typeof proposal[typeof kind],
    })
  }

  async function apply() {
    if (!proposal) return
    setBusy(true)
    try {
      const filteredHashtags = proposal.hashtags.filter(
        (x) => !(x as { _excluded?: boolean })._excluded
      )
      const filteredHandles = proposal.creator_handles.filter(
        (x) => !(x as { _excluded?: boolean })._excluded
      )
      const res = await fetch("/api/setup/propose-radar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          hashtags: filteredHashtags,
          creator_handles: filteredHandles,
        }),
      })
      if (!res.ok) throw new Error("Apply failed")
      toast.success("Radar configured")
      onApplied()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <p className="text-xs text-[color:var(--color-secondary)]">
          The Radar watches these accounts and hashtags every 6 hours and surfaces what's
          spiking in your niche. Click any item to remove it from the watch.
        </p>

        {busy && !proposal ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-muted)]" />
          </div>
        ) : null}

        {proposal ? (
          <>
            <div className="space-y-2">
              <Label>Hashtags ({proposal.hashtags.length})</Label>
              <div className="flex flex-wrap gap-1.5">
                {proposal.hashtags.map((h) => {
                  const excl = (h as { _excluded?: boolean })._excluded
                  return (
                    <button
                      key={h.value}
                      onClick={() => toggle("hashtags", h.value)}
                      className={`rounded-full border px-2 py-1 text-[11px] transition-colors ${
                        excl
                          ? "border-[color:var(--color-border)] bg-transparent text-[color:var(--color-muted)] line-through"
                          : "border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]"
                      }`}
                    >
                      {h.value}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Creator handles ({proposal.creator_handles.length})</Label>
              <div className="flex flex-wrap gap-1.5">
                {proposal.creator_handles.map((c) => {
                  const excl = (c as { _excluded?: boolean })._excluded
                  return (
                    <button
                      key={c.value}
                      onClick={() => toggle("creator_handles", c.value)}
                      className={`rounded-full border px-2 py-1 text-[11px] transition-colors ${
                        excl
                          ? "border-[color:var(--color-border)] bg-transparent text-[color:var(--color-muted)] line-through"
                          : "border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]"
                      }`}
                    >
                      {c.value}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : null}

        <NavButtons
          onBack={onBack}
          onNext={apply}
          nextLabel="Apply & continue"
          busy={busy}
          nextDisabled={!proposal}
        />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Step 4 — Expert Brain seed
// ============================================================================

function StepExpertBrain({
  niche,
  avatar,
  onApplied,
  onBack,
}: {
  niche: string
  avatar: string | null
  onApplied: () => void
  onBack: () => void
}) {
  const [proposal, setProposal] = useState<{
    sources: { title: string; url: string; reason: string }[]
  } | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!niche) return
    void (async () => {
      setBusy(true)
      try {
        const res = await fetch("/api/setup/propose-expert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "propose",
            niche,
            avatar: avatar ?? undefined,
          }),
        })
        if (!res.ok) throw new Error("Propose failed")
        const json = await res.json()
        setProposal(json.proposal)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed")
      } finally {
        setBusy(false)
      }
    })()
  }, [niche, avatar])

  async function apply() {
    if (!proposal) return
    setBusy(true)
    try {
      const sources = proposal.sources.filter((s) => !excluded.has(s.url))
      const res = await fetch("/api/setup/propose-expert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "apply", sources }),
      })
      if (!res.ok) throw new Error("Apply failed")
      toast.success("Expert Brain seeded")
      onApplied()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <p className="text-xs text-[color:var(--color-secondary)]">
          Five foundational sources for your niche. Untick any you don't want. We'll ingest each
          one in the background.
        </p>

        {busy && !proposal ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-muted)]" />
          </div>
        ) : null}

        {proposal ? (
          <div className="space-y-2">
            {proposal.sources.map((s) => {
              const excl = excluded.has(s.url)
              return (
                <button
                  key={s.url}
                  onClick={() => {
                    const next = new Set(excluded)
                    if (excl) next.delete(s.url)
                    else next.add(s.url)
                    setExcluded(next)
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    excl
                      ? "border-[color:var(--color-border)] bg-transparent opacity-50"
                      : "border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent-soft)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[color:var(--color-foreground)]">
                        {s.title}
                      </p>
                      <p className="mt-1 text-[10px] text-[color:var(--color-secondary)]">
                        {s.reason}
                      </p>
                      <p className="mt-1 text-[10px] text-[color:var(--color-muted)]">
                        {s.url}
                      </p>
                    </div>
                    <Check
                      className={`h-3 w-3 shrink-0 ${excl ? "opacity-0" : "text-[color:var(--color-accent)]"}`}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}

        <NavButtons
          onBack={onBack}
          onNext={apply}
          nextLabel="Ingest & continue"
          busy={busy}
          nextDisabled={!proposal}
        />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Step 5 — First generation
// ============================================================================

function StepFirstGeneration({
  business,
  onComplete,
  onBack,
}: {
  business: State["business"]
  onComplete: () => void
  onBack: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const niche = business.niche ?? "creators"
      const prompt = `Make me 3 introduction reels for ${niche} that frame me, my offer, and the problem I solve.`
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          format: "reel",
          count: 3,
          source: "manual",
        }),
      })
      if (!res.ok) throw new Error("Generation failed")
      setDone(true)
      toast.success("3 reels created")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardTitle className="px-5 pt-5">Run your first generation</CardTitle>
      <CardDescription className="px-5">
        We'll write 3 introduction reels for {business.niche || "your niche"}, using your voice
        profile and the Expert Brain we just seeded.
      </CardDescription>
      <CardContent className="space-y-4 pt-5">
        {done ? (
          <div className="rounded-xl border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/5 p-4 text-xs text-[color:var(--color-success)]">
            Done. Three drafts are waiting for you in the Idea column.
          </div>
        ) : (
          <p className="text-xs text-[color:var(--color-secondary)]">
            Click below to generate. If you haven't entered an Anthropic key yet, demo-mode stub
            scripts are produced so you can still see the flow end to end.
          </p>
        )}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} disabled={busy}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          {done ? (
            <Button onClick={onComplete}>Open the workspace</Button>
          ) : (
            <Button onClick={run} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Writing..." : "Generate 3 reels"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import {
  ExternalLink,
  Sparkles,
  Quote,
  Target,
  TrendingUp,
  Lightbulb,
  Repeat,
  BookOpen,
  ListOrdered,
  Brain,
  Tag,
  AudioLines,
  MessageCircle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime } from "@/lib/utils"
import type { ContextItemRow } from "@/lib/content-engine/types"

type DeepAnalysis = {
  hook?: string
  hook_formula?: string
  body_summary?: string
  cta?: string
  why_it_works?: string
  key_findings?: string[]
  reusable_hook_template?: string
}

type ExpertFrameworks = {
  frameworks?: Array<{ name: string; steps: string[]; when_to_use: string }>
  principles?: string[]
  mental_models?: string[]
  key_terminology?: string[]
  case_studies?: Array<{ subject: string; outcome: string; what_caused_it: string }>
}

type VoiceSignature = {
  avg_sentence_length?: number
  sentence_rhythm?: string
  opening_patterns?: string[]
  closing_patterns?: string[]
  signature_phrases?: string[]
  filler_words?: string[]
  profanity_level?: "none" | "light" | "moderate" | "heavy"
  profanity_examples?: string[]
  register?: string
  distinctive_moves?: string[]
}

export function ItemBreakdown({
  item,
  onClose,
  inline = false,
}: {
  item: ContextItemRow | null
  onClose: () => void
  // When true, render the content without the Dialog chrome -- used inside
  // the BucketView slide-over so the breakdown shows in the right pane.
  inline?: boolean
}) {
  if (!item) return null

  const body = <ItemBreakdownBody item={item} />

  if (inline) {
    return <div className="space-y-4 px-5 py-5">{body}</div>
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  )
}

function ItemBreakdownBody({ item }: { item: ContextItemRow }) {
  const meta = (item.metadata ?? {}) as Record<string, unknown>
  const author = meta.reel_author as string | null | undefined
  const views = meta.reel_views as number | null | undefined
  const likes = meta.reel_likes as number | null | undefined
  const comments = meta.reel_comments as number | null | undefined
  const transcript = extractTranscript(item.processed_content)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-6">{item.title || "Untitled"}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
          <Badge tone="neutral" className="capitalize">
            {item.bucket.replace(/_/g, " ")}
          </Badge>
          {author ? (
            <span className="text-caption text-[color:var(--color-muted)]">
              @{author}
            </span>
          ) : null}
          <span className="text-caption text-[color:var(--color-muted)]">
            {item.source_type.replace("_", " ")}
          </span>
          <span className="text-caption text-[color:var(--color-muted)]">
            {formatRelativeTime(item.created_at)}
          </span>
          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-caption text-[color:var(--color-accent)] hover:underline"
            >
              Open source <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ) : null}
        </DialogDescription>
      </DialogHeader>

      {views || likes || comments ? (
        <div className="flex flex-wrap gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2">
          {views ? <Stat label="Views" value={views.toLocaleString()} /> : null}
          {likes ? <Stat label="Likes" value={likes.toLocaleString()} /> : null}
          {comments ? <Stat label="Comments" value={comments.toLocaleString()} /> : null}
          {views && likes && comments ? (
            <Stat
              label="Engagement"
              value={`${(((likes + comments) / views) * 100).toFixed(1)}%`}
            />
          ) : null}
        </div>
      ) : null}

      <BucketBody item={item} />

      {transcript ? (
        <details className="mt-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
          <summary className="cursor-pointer text-label font-medium text-[color:var(--color-secondary)]">
            Full transcript
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-caption leading-relaxed text-[color:var(--color-foreground)]">
            {transcript}
          </p>
        </details>
      ) : null}

      {item.summary && item.bucket !== "inspiration" ? (
        <details
          className="mt-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3"
          open
        >
          <summary className="cursor-pointer text-label font-medium text-[color:var(--color-secondary)]">
            Summary
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-caption leading-relaxed text-[color:var(--color-foreground)]">
            {item.summary}
          </p>
        </details>
      ) : null}

      {item.tags && item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {item.tags.map((t) => (
            <Badge key={t} tone="neutral" className="text-caption">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}
    </>
  )
}

function BucketBody({ item }: { item: ContextItemRow }) {
  const meta = (item.metadata ?? {}) as Record<string, unknown>

  if (item.bucket === "inspiration") {
    const analysis = (meta.deep_analysis ?? null) as DeepAnalysis | null
    if (!analysis) return <PendingBlock status={item.status} />
    return <InspirationView analysis={analysis} />
  }

  if (item.bucket === "expert_brain") {
    const frameworks = (meta.expert_frameworks ?? null) as ExpertFrameworks | null
    if (!frameworks) return <PendingBlock status={item.status} />
    return <ExpertBrainView frameworks={frameworks} />
  }

  if (item.bucket === "my_voice") {
    const signature = (meta.voice_signature ?? null) as VoiceSignature | null
    if (!signature) return <PendingBlock status={item.status} />
    return <VoiceView signature={signature} />
  }

  // Other buckets (my_business / Context, video_ideas, instructions, feedback)
  // intentionally have no extractor — their job is provide raw material, not
  // structured analysis. Show summary + tags + transcript only.
  return null
}

function InspirationView({ analysis }: { analysis: DeepAnalysis }) {
  return (
    <div className="space-y-4">
      {analysis.hook ? (
        <Section icon={<Quote className="h-3.5 w-3.5" />} title="Hook" tone="accent">
          <p className="text-sm italic text-[color:var(--color-foreground)]">
            &ldquo;{analysis.hook}&rdquo;
          </p>
          {analysis.hook_formula ? (
            <Badge tone="info" className="mt-2 capitalize">
              {analysis.hook_formula.replace(/_/g, " ")}
            </Badge>
          ) : null}
        </Section>
      ) : null}

      {analysis.body_summary ? (
        <Section icon={<Sparkles className="h-3.5 w-3.5" />} title="Body" tone="neutral">
          <p className="text-sm text-[color:var(--color-foreground)]">{analysis.body_summary}</p>
        </Section>
      ) : null}

      {analysis.cta && analysis.cta !== "none" ? (
        <Section icon={<Target className="h-3.5 w-3.5" />} title="Call to action" tone="neutral">
          <p className="text-sm text-[color:var(--color-foreground)]">{analysis.cta}</p>
        </Section>
      ) : null}

      {analysis.why_it_works ? (
        <Section icon={<TrendingUp className="h-3.5 w-3.5" />} title="Why it works" tone="success">
          <p className="text-sm text-[color:var(--color-foreground)]">{analysis.why_it_works}</p>
        </Section>
      ) : null}

      {analysis.key_findings && analysis.key_findings.length > 0 ? (
        <Section icon={<Lightbulb className="h-3.5 w-3.5" />} title="Key findings" tone="warning">
          <ul className="space-y-1.5">
            {analysis.key_findings.map((finding, i) => (
              <li
                key={i}
                className="text-sm text-[color:var(--color-foreground)] before:mr-2 before:text-[color:var(--color-muted)] before:content-['•']"
              >
                {finding}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {analysis.reusable_hook_template ? (
        <Section
          icon={<Repeat className="h-3.5 w-3.5" />}
          title="Reusable hook template"
          tone="accent"
        >
          <p className="font-mono text-sm text-[color:var(--color-foreground)]">
            {analysis.reusable_hook_template}
          </p>
        </Section>
      ) : null}
    </div>
  )
}

function ExpertBrainView({ frameworks }: { frameworks: ExpertFrameworks }) {
  const hasFrameworks = (frameworks.frameworks ?? []).length > 0
  const hasPrinciples = (frameworks.principles ?? []).length > 0
  const hasMentalModels = (frameworks.mental_models ?? []).length > 0
  const hasTerminology = (frameworks.key_terminology ?? []).length > 0
  const hasCaseStudies = (frameworks.case_studies ?? []).length > 0

  if (
    !hasFrameworks &&
    !hasPrinciples &&
    !hasMentalModels &&
    !hasTerminology &&
    !hasCaseStudies
  ) {
    return (
      <div className="rounded-lg border border-dashed border-[color:var(--color-border)] py-8 text-center text-xs text-[color:var(--color-muted)]">
        No teachable frameworks were extracted from this source. Reprocess to retry.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {hasFrameworks ? (
        <Section icon={<BookOpen className="h-3.5 w-3.5" />} title="Frameworks" tone="accent">
          <div className="space-y-3">
            {frameworks.frameworks!.map((f, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-sm font-semibold text-[color:var(--color-foreground)]">
                  {f.name}
                </p>
                {f.when_to_use ? (
                  <p className="text-[11px] italic text-[color:var(--color-secondary)]">
                    Use when: {f.when_to_use}
                  </p>
                ) : null}
                {f.steps && f.steps.length > 0 ? (
                  <ol className="space-y-1 pl-4 text-sm text-[color:var(--color-foreground)]">
                    {f.steps.map((step, j) => (
                      <li key={j} className="list-decimal">
                        {step}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {hasPrinciples ? (
        <Section icon={<Sparkles className="h-3.5 w-3.5" />} title="Principles" tone="neutral">
          <ul className="space-y-1.5">
            {frameworks.principles!.map((p, i) => (
              <li
                key={i}
                className="text-sm text-[color:var(--color-foreground)] before:mr-2 before:text-[color:var(--color-muted)] before:content-['•']"
              >
                {p}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hasMentalModels ? (
        <Section icon={<Brain className="h-3.5 w-3.5" />} title="Mental models" tone="warning">
          <ul className="space-y-1.5">
            {frameworks.mental_models!.map((m, i) => (
              <li
                key={i}
                className="text-sm text-[color:var(--color-foreground)] before:mr-2 before:text-[color:var(--color-muted)] before:content-['•']"
              >
                {m}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hasTerminology ? (
        <Section icon={<Tag className="h-3.5 w-3.5" />} title="Key terminology" tone="neutral">
          <div className="flex flex-wrap gap-1.5">
            {frameworks.key_terminology!.map((t, i) => (
              <Badge key={i} tone="info" className="text-[11px]">
                {t}
              </Badge>
            ))}
          </div>
        </Section>
      ) : null}

      {hasCaseStudies ? (
        <Section icon={<ListOrdered className="h-3.5 w-3.5" />} title="Case studies" tone="success">
          <div className="space-y-2.5">
            {frameworks.case_studies!.map((c, i) => (
              <div key={i} className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-2">
                <p className="text-sm font-semibold text-[color:var(--color-foreground)]">
                  {c.subject}
                </p>
                {c.outcome ? (
                  <p className="text-sm text-[color:var(--color-foreground)]">
                    Outcome: {c.outcome}
                  </p>
                ) : null}
                {c.what_caused_it ? (
                  <p className="text-[11px] italic text-[color:var(--color-secondary)]">
                    Cause: {c.what_caused_it}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  )
}

function VoiceView({ signature }: { signature: VoiceSignature }) {
  const hasOpenings = (signature.opening_patterns ?? []).length > 0
  const hasClosings = (signature.closing_patterns ?? []).length > 0
  const hasSignaturePhrases = (signature.signature_phrases ?? []).length > 0
  const hasFillers = (signature.filler_words ?? []).length > 0
  const hasMoves = (signature.distinctive_moves ?? []).length > 0
  const hasProfanityExamples = (signature.profanity_examples ?? []).length > 0

  return (
    <div className="space-y-4">
      <Section icon={<AudioLines className="h-3.5 w-3.5" />} title="Cadence" tone="accent">
        <div className="space-y-1.5 text-sm text-[color:var(--color-foreground)]">
          {signature.avg_sentence_length ? (
            <p>
              <span className="font-medium">Avg sentence length:</span>{" "}
              {signature.avg_sentence_length} words
            </p>
          ) : null}
          {signature.sentence_rhythm ? (
            <p>
              <span className="font-medium">Rhythm:</span> {signature.sentence_rhythm}
            </p>
          ) : null}
          {signature.register ? (
            <p>
              <span className="font-medium">Register:</span> {signature.register}
            </p>
          ) : null}
          {signature.profanity_level ? (
            <p>
              <span className="font-medium">Profanity level:</span> {signature.profanity_level}
              {hasProfanityExamples
                ? ` (${signature.profanity_examples!.slice(0, 3).join(", ")})`
                : ""}
            </p>
          ) : null}
        </div>
      </Section>

      {hasOpenings ? (
        <Section icon={<Quote className="h-3.5 w-3.5" />} title="Opening patterns" tone="neutral">
          <div className="flex flex-wrap gap-1.5">
            {signature.opening_patterns!.map((p, i) => (
              <Badge key={i} tone="info" className="text-[11px]">
                {p}
              </Badge>
            ))}
          </div>
        </Section>
      ) : null}

      {hasClosings ? (
        <Section icon={<Target className="h-3.5 w-3.5" />} title="Closing patterns" tone="neutral">
          <div className="flex flex-wrap gap-1.5">
            {signature.closing_patterns!.map((p, i) => (
              <Badge key={i} tone="info" className="text-[11px]">
                {p}
              </Badge>
            ))}
          </div>
        </Section>
      ) : null}

      {hasSignaturePhrases ? (
        <Section
          icon={<Sparkles className="h-3.5 w-3.5" />}
          title="Signature phrases"
          tone="success"
        >
          <ul className="space-y-1.5">
            {signature.signature_phrases!.map((p, i) => (
              <li
                key={i}
                className="text-sm text-[color:var(--color-foreground)] before:mr-2 before:text-[color:var(--color-muted)] before:content-['•']"
              >
                {p}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hasMoves ? (
        <Section icon={<Brain className="h-3.5 w-3.5" />} title="Distinctive moves" tone="warning">
          <ul className="space-y-1.5">
            {signature.distinctive_moves!.map((m, i) => (
              <li
                key={i}
                className="text-sm text-[color:var(--color-foreground)] before:mr-2 before:text-[color:var(--color-muted)] before:content-['•']"
              >
                {m}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hasFillers ? (
        <Section
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          title="Filler words"
          tone="neutral"
        >
          <div className="flex flex-wrap gap-1.5">
            {signature.filler_words!.map((f, i) => (
              <Badge key={i} tone="neutral" className="text-[11px]">
                {f}
              </Badge>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  )
}

function PendingBlock({ status }: { status: string }) {
  const pending = status === "transcribing" || status === "fetching" || status === "summarising"
  return (
    <div className="rounded-lg border border-dashed border-[color:var(--color-border)] py-8 text-center text-xs text-[color:var(--color-muted)]">
      {pending
        ? "Analysis pending — still processing."
        : "No structured analysis available yet. Try reprocess to generate one."}
    </div>
  )
}

function Section({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode
  title: string
  tone: "accent" | "success" | "warning" | "neutral"
  children: React.ReactNode
}) {
  const toneClass = {
    accent: "border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent-soft)]",
    success: "border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/5",
    warning: "border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/5",
    neutral: "border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
  }[tone]
  return (
    <div className={`rounded-lg border ${toneClass} p-3`}>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-secondary)]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-[color:var(--color-muted)]">
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums text-[color:var(--color-foreground)]">
        {value}
      </span>
    </div>
  )
}

function extractTranscript(content: string | null): string | null {
  if (!content) return null
  const idx = content.indexOf("Transcript:")
  if (idx === -1) return null
  return content.slice(idx + "Transcript:".length).trim()
}

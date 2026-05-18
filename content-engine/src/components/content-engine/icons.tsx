import {
  AudioLines,
  Brain,
  FolderOpen,
  Lightbulb,
  MessageSquare,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import type { Bucket } from "@/lib/content-engine/buckets"

export const BUCKET_ICONS: Record<Bucket, LucideIcon> = {
  video_ideas: Lightbulb,
  inspiration: Sparkles,
  expert_brain: Brain,
  my_voice: AudioLines,
  context: FolderOpen,
  instructions: Settings,
  feedback: MessageSquare,
}

export const BUCKET_COLOR_VAR: Record<Bucket, string> = {
  video_ideas: "--color-bucket-video-ideas",
  inspiration: "--color-bucket-inspiration",
  expert_brain: "--color-bucket-expert",
  my_voice: "--color-bucket-voice",
  context: "--color-bucket-business",
  instructions: "--color-bucket-instructions",
  feedback: "--color-bucket-feedback",
}

// Pre-computed soft tint variants — replaces runtime color-mix() in
// component styles. Each pair (icon color + soft tint) is defined in
// globals.css under :root.
export const BUCKET_SOFT_VAR: Record<Bucket, string> = {
  video_ideas: "--color-bucket-video-ideas-soft",
  inspiration: "--color-bucket-inspiration-soft",
  expert_brain: "--color-bucket-expert-soft",
  my_voice: "--color-bucket-voice-soft",
  context: "--color-bucket-business-soft",
  instructions: "--color-bucket-instructions-soft",
  feedback: "--color-bucket-feedback-soft",
}

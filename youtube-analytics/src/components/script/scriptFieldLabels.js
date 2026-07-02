import {
  Eye, Film, Video, Type, Sparkles, Volume2, Music, Scissors, TrendingUp,
} from 'lucide-react'

// Single source of truth for AI field keys → human labels + icons.
// Adding support for a new AI-returned field is a one-line change here.
// Unknown keys still render (with the raw key prettified), so the UI never
// breaks if the AI adds a field we haven't mapped yet.
export const FIELD_LABELS = {
  visualDirection: { label: 'Visual Direction', Icon: Eye },
  broll: { label: 'B-Roll', Icon: Film },
  bRoll: { label: 'B-Roll', Icon: Film },
  cameraDirection: { label: 'Camera Direction', Icon: Video },
  motionGraphics: { label: 'Motion Graphics', Icon: Sparkles },
  onScreenText: { label: 'On-Screen Text', Icon: Type },
  soundEffects: { label: 'Sound Effects', Icon: Volume2 },
  backgroundMusic: { label: 'Background Music', Icon: Music },
  editingNotes: { label: 'Editing Notes', Icon: Scissors },
  retentionTrigger: { label: 'Retention Trigger', Icon: TrendingUp },
}

// Keys promoted to the block header rather than rendered as a field row.
export const META_KEYS = new Set(['sectionName', 'timestamp'])

export function prettifyKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

import { motion } from 'framer-motion'
import {
  FileSearch, Sparkles, CheckCircle2, Hourglass, PenLine,
} from 'lucide-react'

// Friendly empty-state variants. The component picks one of five based on the
// `variant` prop (or auto-derives when only wordCount/status are given).
//
//   too-short      → script hasn't reached the 200-word threshold
//   no-claims      → script is long enough but no factual claims were detected
//   all-clear      → claims present, all verified, no suggestions
//   waiting        → first load, before analysis kicks in
//   custom         → caller provides title + subtitle directly
//
// All variants use the existing palette + lucide icons — no new colors.
const VARIANTS = {
  'too-short': {
    Icon: PenLine,
    iconWrap: 'bg-sky-50 text-sky-600',
    title: 'Write more script first',
    subtitle: (ctx) => {
      const remaining = Math.max(0, ctx.threshold - ctx.wordCount)
      return remaining > 0
        ? `Research kicks in once your script has substance. Add ~${remaining} more word${remaining === 1 ? '' : 's'} to begin.`
        : 'Save your work to begin.'
    },
  },
  'no-claims': {
    Icon: FileSearch,
    iconWrap: 'bg-gray-50 text-gray-600',
    title: 'No factual claims detected',
    subtitle: () => 'This script appears to be narrative or opinion. Nothing to fact-check — keep writing in your voice.',
  },
  'all-clear': {
    Icon: CheckCircle2,
    iconWrap: 'bg-emerald-50 text-emerald-600',
    title: 'Everything looks good',
    subtitle: () => 'No outstanding suggestions or unverified claims. Safe to proceed to the next step.',
  },
  'waiting': {
    Icon: Hourglass,
    iconWrap: 'bg-violet-50 text-violet-600',
    title: 'Waiting for analysis…',
    subtitle: () => 'Research will start automatically once your script is ready. This usually takes a few seconds.',
  },
  'custom': {
    Icon: Sparkles,
    iconWrap: 'bg-violet-50 text-violet-600',
    title: null,
    subtitle: null,
  },
}

export default function EmptyResearchState({
  variant,
  wordCount = 0,
  threshold = 200,
  title,
  subtitle,
}) {
  const key = variant || (wordCount < threshold ? 'too-short' : 'waiting')
  const cfg = VARIANTS[key] || VARIANTS.waiting
  const Icon = cfg.Icon
  const ctx = { wordCount, threshold }
  const finalTitle = title ?? cfg.title
  const finalSubtitle = subtitle ?? (typeof cfg.subtitle === 'function' ? cfg.subtitle(ctx) : cfg.subtitle)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white p-8 sm:p-10 text-center"
    >
      <div className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl mx-auto mb-3 ${cfg.iconWrap}`}>
        <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
      </div>
      {finalTitle && (
        <p className="text-[14px] sm:text-[15px] font-bold text-gray-900">{finalTitle}</p>
      )}
      {finalSubtitle && (
        <p className="text-[12px] sm:text-[12.5px] text-gray-500 mt-1.5 leading-relaxed max-w-md mx-auto">
          {finalSubtitle}
        </p>
      )}
    </motion.div>
  )
}

import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Undo2, Redo2, Wand2, Scissors, Maximize2, Flame, Heart, GraduationCap, BookOpen,
  Type, Zap, Anchor, FileText, Hash,
} from 'lucide-react'

const FIELDS = [
  { key: 'title',       label: 'Title',       icon: Type,      rows: 1, placeholder: 'CTR-optimized title under 70 chars' },
  { key: 'hook',        label: 'Hook',        icon: Zap,       rows: 2, placeholder: 'First 0-10 seconds — must create curiosity or stakes' },
  { key: 'fullScript',  label: 'Full Script', icon: Anchor,    rows: 14, placeholder: 'The complete spoken script. Write as actual spoken sentences.' },
  { key: 'cta',         label: 'CTA',         icon: FileText,  rows: 2, placeholder: 'End-of-video call to action' },
  { key: 'description', label: 'Description', icon: BookOpen,  rows: 4, placeholder: 'YouTube description in the creator\'s voice' },
]

const TRANSFORMS = [
  { action: 'rewrite',      label: 'Rewrite',           icon: Wand2 },
  { action: 'shorter',      label: 'Shorter',            icon: Scissors },
  { action: 'longer',       label: 'Longer',             icon: Maximize2 },
  { action: 'viral',        label: 'More Viral',         icon: Flame },
  { action: 'emotional',    label: 'More Emotional',     icon: Heart },
  { action: 'educational',  label: 'More Educational',   icon: GraduationCap },
  { action: 'storytelling', label: 'More Storytelling',  icon: BookOpen },
]

const ScriptEditor = forwardRef(function ScriptEditor({
  working,
  onEditField,
  onUndo,
  onRedo,
  onTransform,
  canUndo,
  canRedo,
  isTransforming,
}, ref) {
  const fieldRefs = useRef({})

  // Expose imperative API for parent components (Research Panel will use this).
  useImperativeHandle(ref, () => ({
    focusField: (fieldKey) => {
      const el = fieldRefs.current[fieldKey]
      if (el?.focus) el.focus()
    },
    scrollToField: (fieldKey) => {
      const el = fieldRefs.current[fieldKey]
      if (el?.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus({ preventScroll: true })
      }
    },
  }))

  const handleTransform = useCallback((action) => {
    if (isTransforming) return
    onTransform(action)
  }, [isTransforming, onTransform])

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-[14px] font-bold text-gray-900 truncate">Script Editor</h3>
          <span className="hidden sm:inline-flex text-[11px] text-gray-400 font-medium">
            master version · every edit propagates downstream
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo || isTransforming}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            title="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo || isTransforming}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            title="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" />
            Redo
          </button>
        </div>
      </div>

      {/* Transform actions row */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">AI Transform</span>
          {TRANSFORMS.map((t) => (
            <button
              key={t.action}
              onClick={() => handleTransform(t.action)}
              disabled={isTransforming || !working?.fullScript}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer border border-violet-100"
            >
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editable fields */}
      <div className="p-5 space-y-4">
        {FIELDS.map((field) => (
          <FieldRow
            key={field.key}
            field={field}
            value={working?.[field.key] || ''}
            onChange={(v) => onEditField(field.key, v)}
            fieldRef={(el) => { fieldRefs.current[field.key] = el }}
          />
        ))}

        {/* Hashtags — chip-style editing */}
        <HashtagsField
          hashtags={Array.isArray(working?.hashtags) ? working.hashtags : []}
          onChange={(next) => onEditField('hashtags', next)}
        />
      </div>
    </motion.section>
  )
})

function FieldRow({ field, value, onChange, fieldRef }) {
  const Icon = field.icon
  const isLong = field.rows > 2

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 text-violet-600">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <label htmlFor={`field-${field.key}`} className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          {field.label}
        </label>
      </div>
      <div className="ml-8">
        {isLong ? (
          <textarea
            id={`field-${field.key}`}
            ref={fieldRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={field.rows}
            placeholder={field.placeholder}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 leading-relaxed placeholder:text-gray-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none transition resize-y min-h-[80px]"
          />
        ) : (
          <input
            id={`field-${field.key}`}
            ref={fieldRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[13px] text-gray-800 leading-relaxed placeholder:text-gray-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none transition"
          />
        )}
      </div>
    </div>
  )
}

function HashtagsField({ hashtags, onChange }) {
  const inputRef = useRef(null)

  const addTag = (raw) => {
    const cleaned = raw.trim().replace(/^#/, '').split(/\s+/)[0]
    if (!cleaned) return
    if (hashtags.includes(cleaned)) return
    onChange([...hashtags, cleaned])
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeTag = (tag) => {
    onChange(hashtags.filter((t) => t !== tag))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 text-violet-600">
          <Hash className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Hashtags</span>
      </div>
      <div className="ml-8 space-y-2">
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <button
                key={tag}
                onClick={() => removeTag(tag)}
                className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 border border-violet-100 hover:bg-red-50 hover:text-red-700 hover:border-red-100 transition cursor-pointer group"
                title="Remove"
              >
                <span>#{tag}</span>
                <span className="text-[9px] opacity-50 group-hover:opacity-100">×</span>
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          placeholder="Add hashtag (press Enter)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addTag(e.target.value)
            }
          }}
          onBlur={(e) => addTag(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[13px] text-gray-800 placeholder:text-gray-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none transition"
        />
      </div>
    </div>
  )
}

export default ScriptEditor

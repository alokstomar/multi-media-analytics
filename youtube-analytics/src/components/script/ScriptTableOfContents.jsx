import { useState, useEffect } from 'react'
import { List } from 'lucide-react'

// Sticky right-rail TOC. Items are derived from the timeline; clicking an
// item scrolls smoothly to that block. Implements lightweight scroll-spy:
// highlights whichever section is currently in view.
export default function ScriptTableOfContents({ blocks = [], onJump }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!blocks.length) return
    const sections = Array.from(document.querySelectorAll('[data-block-index]'))
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          const idx = Number(visible[0].target.getAttribute('data-block-index'))
          if (!Number.isNaN(idx)) setActiveIndex(idx)
        }
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [blocks.length])

  if (!blocks.length) return null

  return (
    <nav className="rounded-2xl border border-gray-100 bg-white p-5 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="flex items-center gap-2 mb-3">
        <List className="h-4 w-4 text-violet-600" />
        <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">On this page</h3>
      </div>
      <ol className="space-y-0.5">
        {blocks.map((block, i) => {
          const isActive = i === activeIndex
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onJump?.(i)}
                className={`w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors ${
                  isActive
                    ? 'bg-violet-50 text-violet-700 font-semibold'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className={`text-[10px] font-mono tabular-nums ${isActive ? 'text-violet-500' : 'text-gray-400'}`}>
                  {block.timestamp || ''}
                </span>
                <span className="truncate">{block.sectionName || `Section ${i + 1}`}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

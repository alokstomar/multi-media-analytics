import { FIELD_LABELS, prettifyKey } from './scriptFieldLabels'

// Renders a single AI field generically. Accepts any value type:
// string, array of strings, array of objects, or nested object.
// The label is looked up from FIELD_LABELS; unknown keys fall back to a
// prettified version of the raw key so the UI never breaks on new fields.
function FieldValue({ value }) {
  if (value == null || value === '') return null

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <ul className="space-y-1.5">
        {value.map((item, i) => {
          if (typeof item === 'string' || typeof item === 'number') {
            return (
              <li key={i} className="flex items-start gap-2 text-[12.5px] text-gray-700 leading-relaxed">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-violet-400 shrink-0" />
                <span>{item}</span>
              </li>
            )
          }
          if (item && typeof item === 'object') {
            const entries = Object.entries(item).filter(([, v]) => v != null && v !== '')
            return (
              <li key={i} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                <dl className="space-y-1">
                  {entries.map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-[12px]">
                      <dt className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] whitespace-nowrap">
                        {prettifyKey(k)}:
                      </dt>
                      <dd className="text-gray-700">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            )
          }
          return null
        })}
      </ul>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v != null && v !== '')
    if (entries.length === 0) return null
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {entries.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <dt className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{prettifyKey(k)}</dt>
            <dd className="text-[12.5px] text-gray-800 mt-0.5 leading-relaxed">{String(v)}</dd>
          </div>
        ))}
      </dl>
    )
  }

  // Primitive string / number
  return <p className="text-[13px] text-gray-700 leading-relaxed">{String(value)}</p>
}

export default function ScriptField({ fieldKey, value }) {
  const config = FIELD_LABELS[fieldKey]
  const label = config?.label ?? prettifyKey(fieldKey)
  const Icon = config?.Icon

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 text-violet-600">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</h4>
      </div>
      <div className={Icon ? 'ml-8' : ''}>
        <FieldValue value={value} />
      </div>
    </div>
  )
}

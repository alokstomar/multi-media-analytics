import ClaimCard from './ClaimCard'
import PriorityGroup from './PriorityGroup'
import { groupByPriority, deriveClaimPriority } from './researchUtils'

// Claims grouped by priority (CRITICAL → IMPORTANT → OPTIONAL). Critical
// always renders first and open by default; others are collapsible.
//
// If a suggestion with matching `find === claim.text` exists, it's passed
// into the ClaimCard so the editor can Apply the rewrite inline.
function matchSuggestionForClaim(claim, suggestions = []) {
  if (!claim) return null
  // Match by exact text OR by the suggestion's `find` matching the claim's text/snippet.
  return suggestions.find((s) => {
    if (!s?.find) return false
    return s.find === claim.text
      || claim.text?.includes(s.find)
      || s.find.includes(claim.snippet || '')
  }) || null
}

export default function ClaimList({
  claims = [],
  suggestions = [],
  onApply,
  onIgnore,
  onJumpTo,
  applyingSuggestionId = null,
}) {
  if (claims.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5 text-center">
        <p className="text-[12px] text-gray-500 font-medium">No factual claims detected.</p>
        <p className="text-[11px] text-gray-400 mt-1">
          Either the script has no verifiable assertions, or analysis hasn't run.
        </p>
      </div>
    )
  }

  const groups = groupByPriority(claims, deriveClaimPriority)

  return (
    <div className="space-y-2.5">
      {groups.map(({ priority, items }) => (
        <PriorityGroup key={priority.key} priority={priority} items={items}>
          {items.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              suggestion={matchSuggestionForClaim(claim, suggestions)}
              onApply={onApply}
              onIgnore={onIgnore}
              onJumpTo={onJumpTo}
              isApplying={applyingSuggestionId === matchSuggestionForClaim(claim, suggestions)?.id}
            />
          ))}
        </PriorityGroup>
      ))}
    </div>
  )
}

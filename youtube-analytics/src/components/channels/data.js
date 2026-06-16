export { fmt } from '../../utils/format'

import { seededInt } from '../../utils/deterministic'

export function sparkline(seed = 'spark') {
  return Array.from({ length: 7 }, (_, i) => seededInt(`${seed}-${i}`, 10, 60))
}

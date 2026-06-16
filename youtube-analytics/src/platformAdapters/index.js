import { usePlatform } from '../context/PlatformContext'
import { useYoutubeAdapter } from './youtubeAdapter'
import { useInstagramAdapter } from './instagramAdapter'

export function usePlatformAdapter() {
  const { selectedPlatform } = usePlatform()
  const youtube = useYoutubeAdapter()
  const instagram = useInstagramAdapter()

  // Dynamically resolve adapter based on selected platform
  switch (selectedPlatform) {
    case 'instagram':
      return instagram
    case 'twitter':
    case 'linkedin':
      // Currently, other non-YouTube platforms share the generic account model
      // but can be customized later. For now, they leverage the account adapter.
      return instagram
    case 'youtube':
    default:
      return youtube
  }
}

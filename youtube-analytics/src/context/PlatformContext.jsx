import { createContext, useState, useContext } from 'react'

const PlatformContext = createContext()

export function PlatformProvider({ children }) {
  const [selectedPlatform, setPlatform] = useState('youtube')

  return (
    <PlatformContext.Provider value={{ selectedPlatform, setPlatform }}>
      {children}
    </PlatformContext.Provider>
  )
}

export function usePlatform() {
  const ctx = useContext(PlatformContext)
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider')
  return ctx
}

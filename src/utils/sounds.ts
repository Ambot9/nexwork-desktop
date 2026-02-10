// Notification sound player utility with fallback beep
let currentAudio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null

// Check if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && 
         window.navigator && 
         window.navigator.userAgent && 
         window.navigator.userAgent.indexOf('Electron') !== -1
}

// Get base URL for sounds
const getSoundBaseUrl = (): string => {
  if (isElectron()) {
    return '/sounds/'
  }
  return './sounds/'
}

// Sound file mapping
const getSoundFiles = (): Record<string, string> => {
  const baseUrl = getSoundBaseUrl()
  return {
    shamisen: `${baseUrl}shamisen.mp3`,
    arcade: `${baseUrl}arcade.mp3`,
    ping: `${baseUrl}ping.mp3`,
    quickPing: `${baseUrl}quickPing.mp3`,
    agentDone: `${baseUrl}agentDone.mp3`,
    codeComplete: `${baseUrl}codeComplete.mp3`,
    afrobeatComplete: `${baseUrl}afrobeatComplete.mp3`,
    longEDM: `${baseUrl}longEDM.mp3`,
    comeBack: `${baseUrl}comeBack.mp3`,
    shabalaba: `${baseUrl}shabalaba.mp3`
  }
}

// Get sound duration
const getSoundDuration = (type: string): number => {
  const durations: Record<string, number> = {
    shamisen: 1,
    arcade: 3,
    ping: 1,
    quickPing: 3,
    agentDone: 8,
    codeComplete: 9,
    afrobeatComplete: 9,
    longEDM: 56,
    comeBack: 7,
    shabalaba: 7
  }
  return durations[type] || 2
}

// Play fallback beep using Web Audio API
const playFallbackBeep = (): void => {
  try {
    // Create audio context if not exists
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    // Create oscillator for beep
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Configure beep sound
    oscillator.frequency.value = 880 // A5 note
    oscillator.type = 'sine'
    
    // Volume envelope
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    
    // Play
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
    
    console.log('Playing fallback beep')
  } catch (error) {
    console.error('Fallback beep failed:', error)
  }
}

export const playNotificationSound = (soundType: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const soundFiles = getSoundFiles()
    const soundFile = soundFiles[soundType] || soundFiles['codeComplete']
    
    console.log(`Attempting to play: ${soundType} from ${soundFile}`)
    
    // Create audio element for file
    const audio = new Audio(soundFile)
    audio.volume = 0.5
    
    let resolved = false
    
    // Success handler
    audio.oncanplaythrough = () => {
      if (!resolved) {
        resolved = true
        console.log(`Playing file: ${soundType}`)
        audio.play().then(() => {
          currentAudio = audio
          resolve()
        }).catch((error) => {
          console.warn(`Play failed for ${soundType}, using fallback`)
          playFallbackBeep()
          resolve()
        })
      }
    }
    
    // Error handler - use fallback
    audio.onerror = () => {
      if (!resolved) {
        resolved = true
        console.warn(`File not found: ${soundFile}, using fallback beep`)
        playFallbackBeep()
        resolve() // Resolve anyway with fallback
      }
    }
    
    // Load the audio
    audio.load()
    
    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.warn(`Timeout for ${soundType}, using fallback beep`)
        playFallbackBeep()
        resolve()
      }
    }, 1000)
  })
}

export const stopNotificationSound = (): void => {
  // Stop file audio
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  
  // Note: Web Audio API oscillators can't be stopped globally
  // They stop automatically after their duration
}

// Check if sound files exist
export const checkSoundFiles = async (): Promise<Record<string, {exists: boolean, path: string}>> => {
  const soundFiles = getSoundFiles()
  const results: Record<string, {exists: boolean, path: string}> = {}
  
  for (const [name, path] of Object.entries(soundFiles)) {
    try {
      const response = await fetch(path, { method: 'HEAD' })
      results[name] = { exists: response.ok, path }
    } catch {
      results[name] = { exists: false, path }
    }
  }
  
  return results
}

// Get missing sounds list
export const getMissingSounds = async (): Promise<string[]> => {
  const check = await checkSoundFiles()
  return Object.entries(check)
    .filter(([, {exists}]) => !exists)
    .map(([name]) => name)
}

export { getSoundDuration, getSoundFiles, isElectron, getSoundBaseUrl }

// Notification sound player utility with fallback
let currentAudio: HTMLAudioElement | null = null
let isGeneratingSound = false

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

// Generate a simple fallback beep sound
const generateFallbackSound = (): string => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  oscillator.frequency.value = 880
  oscillator.type = 'sine'
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
  
  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.5)
  
  return 'generated'
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

export const playNotificationSound = (soundType: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Stop current sound if playing
      if (currentAudio) {
        currentAudio.pause()
        currentAudio = null
      }

      // Get sound file path
      const soundFiles = getSoundFiles()
      const soundFile = soundFiles[soundType] || soundFiles['codeComplete']
      
      // Create audio element
      currentAudio = new Audio(soundFile)
      currentAudio.volume = 0.5
      
      // Track if we successfully loaded
      let hasError = false
      
      // Add error handler with fallback
      currentAudio.onerror = () => {
        hasError = true
        console.warn(`Sound file not found: ${soundFile}`)
        currentAudio = null
        
        // Try fallback beep
        try {
          if (!isGeneratingSound) {
            isGeneratingSound = true
            generateFallbackSound()
            setTimeout(() => {
              isGeneratingSound = false
            }, 600)
          }
          resolve() // Resolve anyway with fallback
        } catch (fallbackError) {
          reject(new Error(`Sound file not found: ${soundType}. Please add MP3 files to the sounds folder.`))
        }
      }
      
      // Play the sound
      currentAudio.play()
        .then(() => {
          if (!hasError) {
            console.log(`Playing sound: ${soundType}`)
            resolve()
          }
        })
        .catch((error) => {
          console.error('Error playing sound:', error)
          currentAudio = null
          
          // Try fallback
          try {
            if (!isGeneratingSound) {
              isGeneratingSound = true
              generateFallbackSound()
              setTimeout(() => {
                isGeneratingSound = false
              }, 600)
            }
            resolve() // Resolve with fallback
          } catch (fallbackError) {
            reject(new Error(`Failed to play sound: ${soundType}`))
          }
        })

      // Cleanup when done
      currentAudio.onended = () => {
        currentAudio = null
      }
    } catch (error) {
      console.error('Error in playNotificationSound:', error)
      
      // Final fallback
      try {
        generateFallbackSound()
        resolve()
      } catch {
        reject(error)
      }
    }
  })
}

export const stopNotificationSound = (): void => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
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

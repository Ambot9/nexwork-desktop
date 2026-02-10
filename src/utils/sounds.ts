// Notification sound player utility using actual audio files
let currentAudio: HTMLAudioElement | null = null

// Sound file mapping
const soundFiles: Record<string, string> = {
  shamisen: './sounds/shamisen.mp3',
  arcade: './sounds/arcade.mp3',
  ping: './sounds/ping.mp3',
  quickPing: './sounds/quickPing.mp3',
  agentDone: './sounds/agentDone.mp3',
  codeComplete: './sounds/codeComplete.mp3',
  afrobeatComplete: './sounds/afrobeatComplete.mp3',
  longEDM: './sounds/longEDM.mp3',
  comeBack: './sounds/comeBack.mp3',
  shabalaba: './sounds/shabalaba.mp3'
}

// Get sound duration from filename or use default
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
      const soundFile = soundFiles[soundType] || soundFiles['codeComplete']
      
      // Create audio element
      currentAudio = new Audio(soundFile)
      currentAudio.volume = 0.5
      
      // Add error handler
      currentAudio.onerror = (error) => {
        console.error('Error loading audio file:', soundFile, error)
        currentAudio = null
        reject(new Error(`Failed to load sound: ${soundType}`))
      }
      
      // Play the sound
      currentAudio.play()
        .then(() => {
          console.log(`Playing sound: ${soundType} from ${soundFile}`)
          resolve()
        })
        .catch((error) => {
          console.error('Error playing sound:', error)
          currentAudio = null
          reject(error)
        })

      // Cleanup when done
      currentAudio.onended = () => {
        currentAudio = null
      }
    } catch (error) {
      console.error('Error in playNotificationSound:', error)
      reject(error)
    }
  })
}

export const stopNotificationSound = (): void => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
}

// Check if sound file exists (for debugging)
export const checkSoundFiles = async (): Promise<Record<string, boolean>> => {
  const results: Record<string, boolean> = {}
  
  for (const [name, path] of Object.entries(soundFiles)) {
    try {
      const response = await fetch(path, { method: 'HEAD' })
      results[name] = response.ok
    } catch {
      results[name] = false
    }
  }
  
  return results
}

export { getSoundDuration, soundFiles }

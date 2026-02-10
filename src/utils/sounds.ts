// Notification sound player utility with unique fallbacks
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

// Play unique fallback sound based on type
const playFallbackSound = (type: string): void => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    const now = audioContext.currentTime
    
    // Different sounds for each type
    switch (type) {
      case 'shamisen':
        // Japanese pluck - high pitched
        playTone(880, 0.3, 0.3, 'triangle')
        break
        
      case 'arcade':
        // Retro game - ascending
        playGlide(440, 880, 0.5, 0.3)
        break
        
      case 'ping':
        // Clean bell - very short high
        playTone(1046, 0.15, 0.2, 'sine')
        break
        
      case 'quickPing':
        // Double beep
        playTone(880, 0.1, 0.2, 'sine')
        setTimeout(() => playTone(880, 0.1, 0.2, 'sine'), 150)
        break
        
      case 'agentDone':
        // Success chord - C major
        playChord([523, 659, 784], 0.8, 0.3)
        break
        
      case 'codeComplete':
        // Triumphant - arpeggio
        playTone(523, 0.2, 0.3, 'sine')
        setTimeout(() => playTone(659, 0.2, 0.3, 'sine'), 200)
        setTimeout(() => playTone(784, 0.4, 0.3, 'sine'), 400)
        break
        
      case 'afrobeatComplete':
        // Rhythmic - bass with melody
        playTone(196, 0.1, 0.4, 'square') // G3 bass
        setTimeout(() => playTone(523, 0.2, 0.3, 'sine'), 200)
        setTimeout(() => playTone(196, 0.1, 0.4, 'square'), 400)
        break
        
      case 'longEDM':
        // Long ambient - low pulse
        playPulse(110, 2.0, 0.3)
        break
        
      case 'comeBack':
        // Attention - warbling
        playWarble(700, 150, 6, 1.5, 0.3)
        break
        
      case 'shabalaba':
        // Cheerful - ding dong
        playTone(880, 0.25, 0.3, 'sine')
        setTimeout(() => playTone(659, 0.25, 0.3, 'sine'), 300)
        break
        
      default:
        playTone(880, 0.3, 0.3, 'sine')
    }
    
    console.log(`Playing unique fallback: ${type}`)
  } catch (error) {
    console.error('Fallback sound failed:', error)
  }
}

// Helper: Play single tone
const playTone = (freq: number, duration: number, volume: number, type: OscillatorType = 'sine'): void => {
  if (!audioContext) return
  
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  
  osc.connect(gain)
  gain.connect(audioContext.destination)
  
  osc.frequency.value = freq
  osc.type = type
  
  gain.gain.setValueAtTime(volume, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
  
  osc.start(audioContext.currentTime)
  osc.stop(audioContext.currentTime + duration)
}

// Helper: Play chord (multiple frequencies)
const playChord = (freqs: number[], duration: number, volume: number): void => {
  freqs.forEach((freq, i) => {
    setTimeout(() => playTone(freq, duration - (i * 0.1), volume * (1 - i * 0.2)), i * 50)
  })
}

// Helper: Glide/frequency sweep
const playGlide = (startFreq: number, endFreq: number, duration: number, volume: number): void => {
  if (!audioContext) return
  
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  
  osc.connect(gain)
  gain.connect(audioContext.destination)
  
  osc.frequency.setValueAtTime(startFreq, audioContext.currentTime)
  osc.frequency.linearRampToValueAtTime(endFreq, audioContext.currentTime + duration)
  osc.type = 'square'
  
  gain.gain.setValueAtTime(volume, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
  
  osc.start(audioContext.currentTime)
  osc.stop(audioContext.currentTime + duration)
}

// Helper: Warbling sound
const playWarble = (baseFreq: number, variance: number, speed: number, duration: number, volume: number): void => {
  if (!audioContext) return
  
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  const lfo = audioContext.createOscillator()
  const lfoGain = audioContext.createGain()
  
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  osc.connect(gain)
  gain.connect(audioContext.destination)
  
  osc.frequency.value = baseFreq
  osc.type = 'sine'
  lfo.frequency.value = speed
  lfoGain.gain.value = variance
  
  gain.gain.setValueAtTime(volume, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
  
  lfo.start(audioContext.currentTime)
  osc.start(audioContext.currentTime)
  osc.stop(audioContext.currentTime + duration)
  lfo.stop(audioContext.currentTime + duration)
}

// Helper: Low pulse
const playPulse = (freq: number, duration: number, volume: number): void => {
  if (!audioContext) return
  
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  
  osc.connect(gain)
  gain.connect(audioContext.destination)
  
  osc.frequency.value = freq
  osc.type = 'sawtooth'
  
  // Create pulsing effect
  const now = audioContext.currentTime
  for (let i = 0; i < duration; i += 0.5) {
    gain.gain.setValueAtTime(volume, now + i)
    gain.gain.exponentialRampToValueAtTime(0.01, now + i + 0.4)
  }
  
  osc.start(now)
  osc.stop(now + duration)
}

export const playNotificationSound = (soundType: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const soundFiles = getSoundFiles()
    const soundFile = soundFiles[soundType] || soundFiles['codeComplete']
    
    console.log(`Attempting to play: ${soundType} from ${soundFile}`)
    
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
          playFallbackSound(soundType)
          resolve()
        })
      }
    }
    
    // Error handler - use unique fallback
    audio.onerror = () => {
      if (!resolved) {
        resolved = true
        console.warn(`File not found: ${soundFile}`)
        playFallbackSound(soundType) // Each type gets unique sound!
        resolve()
      }
    }
    
    // Load the audio
    audio.load()
    
    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.warn(`Timeout for ${soundType}`)
        playFallbackSound(soundType) // Each type gets unique sound!
        resolve()
      }
    }, 1000)
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

// Notification sound player utility
let currentAudio: HTMLAudioElement | null = null

// Generate synthesized sounds using Web Audio API
const generateSound = (type: string): Blob => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const sampleRate = audioContext.sampleRate
  const duration = getSoundDuration(type)
  const numSamples = sampleRate * duration
  const buffer = audioContext.createBuffer(1, numSamples, sampleRate)
  const channelData = buffer.getChannelData(0)

  // Generate different sounds based on type with improved tones
  switch (type) {
    case 'shamisen':
      // Plucked string sound with harmonics
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const fundamental = Math.sin(2 * Math.PI * 440 * t)
        const harmonic = Math.sin(2 * Math.PI * 880 * t) * 0.3
        channelData[i] = (fundamental + harmonic) * Math.exp(-t * 4) * 0.6
      }
      break
    
    case 'arcade':
      // Retro game power-up sound
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const freq = 440 + (600 * t)
        channelData[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 0.8) * 0.5
      }
      break
    
    case 'ping':
      // Clean bell-like ping
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const bell = Math.sin(2 * Math.PI * 1046.5 * t) + Math.sin(2 * Math.PI * 1318.5 * t) * 0.5
        channelData[i] = bell * Math.exp(-t * 10) * 0.4
      }
      break
    
    case 'quickPing':
      // Bright notification sound
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const tone = Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1760 * t) * 0.3
        channelData[i] = tone * Math.exp(-t * 6) * 0.4
      }
      break
    
    case 'dooWap':
      // Smooth modulated tone
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const vibrato = Math.sin(2 * Math.PI * 4 * t) * 10
        const freq = 523.25 + vibrato
        channelData[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 0.3) * 0.5
      }
      break
    
    case 'agentDone':
      // Cheerful success melody (C-E-G major chord)
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        let note = 0
        if (t < 0.2) note = Math.sin(2 * Math.PI * 523.25 * t) // C
        else if (t < 0.4) note = Math.sin(2 * Math.PI * 659.25 * t) // E
        else note = Math.sin(2 * Math.PI * 783.99 * t) // G
        channelData[i] = note * Math.exp(-(t % 0.2) * 8) * 0.5
      }
      break
    
    case 'codeComplete':
      // Uplifting completion sound
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const c = Math.sin(2 * Math.PI * 523.25 * t) * 0.4
        const e = Math.sin(2 * Math.PI * 659.25 * t) * 0.3
        const g = Math.sin(2 * Math.PI * 783.99 * t) * 0.2
        channelData[i] = (c + e + g) * Math.exp(-t * 0.4)
      }
      break
    
    case 'afrobeatComplete':
      // Rhythmic celebration with melody
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const beat = Math.floor(t * 4) % 2 === 0 ? 0.15 : 0
        const melody = Math.sin(2 * Math.PI * 523.25 * t) * 0.3
        channelData[i] = (melody + beat) * Math.exp(-t * 0.3)
      }
      break
    
    case 'longEDM':
      // Pulsing bass with synth lead
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const bass = Math.sin(2 * Math.PI * 55 * t) * 0.4
        const pulse = Math.sin(2 * Math.PI * 4 * t) * 50
        const synth = Math.sin(2 * Math.PI * (440 + pulse) * t) * 0.2
        channelData[i] = (bass + synth) * (1 - t * 0.01)
      }
      break
    
    case 'comeBack':
      // Attention-grabbing warble
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const warble = Math.sin(2 * Math.PI * (700 + 150 * Math.sin(2 * Math.PI * 6 * t)) * t)
        channelData[i] = warble * Math.exp(-t * 0.5) * 0.5
      }
      break
    
    case 'shabalaba':
      // Cheerful ding-dong
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        let note = 0
        if (t < 0.25) note = Math.sin(2 * Math.PI * 880 * t) // High ding
        else note = Math.sin(2 * Math.PI * 659.25 * t) // Lower dong
        channelData[i] = note * Math.exp(-(t % 0.25) * 5) * 0.5
      }
      break
    
    default:
      // Pleasant default notification
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const tone = Math.sin(2 * Math.PI * 523.25 * t) + Math.sin(2 * Math.PI * 659.25 * t) * 0.5
        channelData[i] = tone * Math.exp(-t * 3) * 0.4
      }
  }

  // Convert to WAV format
  const wavBuffer = audioBufferToWav(buffer)
  return new Blob([wavBuffer], { type: 'audio/wav' })
}

const getSoundDuration = (type: string): number => {
  const durations: Record<string, number> = {
    shamisen: 1,
    arcade: 3,
    ping: 1,
    quickPing: 3,
    dooWap: 10,
    agentDone: 8,
    codeComplete: 9,
    afrobeatComplete: 9,
    longEDM: 56,
    comeBack: 7,
    shabalaba: 7
  }
  return durations[type] || 2
}

// Convert AudioBuffer to WAV format
const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const length = buffer.length * buffer.numberOfChannels * 2
  const arrayBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(arrayBuffer)
  const channels: Float32Array[] = []
  let offset = 0
  let pos = 0

  // Write WAV header
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true)
    pos += 2
  }
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true)
    pos += 4
  }

  // "RIFF" chunk descriptor
  setUint32(0x46464952)
  setUint32(36 + length)
  setUint32(0x45564157)

  // "fmt " sub-chunk
  setUint32(0x20746d66)
  setUint32(16)
  setUint16(1)
  setUint16(buffer.numberOfChannels)
  setUint32(buffer.sampleRate)
  setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels)
  setUint16(buffer.numberOfChannels * 2)
  setUint16(16)

  // "data" sub-chunk
  setUint32(0x61746164)
  setUint32(length)

  // Write interleaved data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  while (pos < arrayBuffer.byteLength) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const sample = Math.max(-1, Math.min(1, channels[i][offset]))
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      pos += 2
    }
    offset++
  }

  return arrayBuffer
}

export const playNotificationSound = (soundType: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Stop current sound if playing
      if (currentAudio) {
        currentAudio.pause()
        currentAudio = null
      }

      // Generate and play new sound
      const soundBlob = generateSound(soundType)
      const soundUrl = URL.createObjectURL(soundBlob)
      
      currentAudio = new Audio(soundUrl)
      currentAudio.volume = 0.5
      
      // Add error handler
      currentAudio.onerror = (error) => {
        console.error('Error loading audio:', error)
        URL.revokeObjectURL(soundUrl)
        currentAudio = null
        reject(error)
      }
      
      currentAudio.play()
        .then(() => {
          console.log(`Playing sound: ${soundType}`)
          resolve()
        })
        .catch((error) => {
          console.error('Error playing sound:', error)
          URL.revokeObjectURL(soundUrl)
          currentAudio = null
          reject(error)
        })

      currentAudio.onended = () => {
        URL.revokeObjectURL(soundUrl)
        currentAudio = null
      }
    } catch (error) {
      console.error('Error generating sound:', error)
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

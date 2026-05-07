const ALARM_FREQUENCY = 880 // Hz - A5 note
const ALARM_DURATION = 200 // ms per beep
const ALARM_GAP = 150 // ms between beeps
const ALARM_REPEATS = 4

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

export function playAlarmSound(): void {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime

    for (let i = 0; i < ALARM_REPEATS; i++) {
      const startTime = now + i * (ALARM_DURATION + ALARM_GAP) / 1000
      const endTime = startTime + ALARM_DURATION / 1000

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(ALARM_FREQUENCY, startTime)

      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02)
      gainNode.gain.linearRampToValueAtTime(0, endTime)

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.start(startTime)
      oscillator.stop(endTime + 0.01)
    }
  } catch {
    // audio not available
  }
}

export function playReminderSound(): void {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime

    // Attention-grabbing pattern: 3 sets of ascending double-beeps
    const pattern = [
      { freq: 660, time: 0 },
      { freq: 880, time: 0.2 },
      { freq: 660, time: 0.6 },
      { freq: 880, time: 0.8 },
      { freq: 660, time: 1.2 },
      { freq: 880, time: 1.4 },
    ]

    for (const note of pattern) {
      const startTime = now + note.time
      const endTime = startTime + 0.15

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(note.freq, startTime)

      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.02)
      gainNode.gain.linearRampToValueAtTime(0, endTime)

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.start(startTime)
      oscillator.stop(endTime + 0.01)
    }
  } catch {
    // audio not available
  }
}

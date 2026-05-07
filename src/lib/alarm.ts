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

    // Two gentle tones: lower pitch, softer
    const frequencies = [660, 880]
    for (let i = 0; i < frequencies.length; i++) {
      const startTime = now + i * 0.3
      const endTime = startTime + 0.25

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequencies[i], startTime)

      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.03)
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

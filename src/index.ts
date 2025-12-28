import { NetatmoClient } from './netatmo'
import { FritzBoxClient, ThermostatInfo } from './fritzbox'
import { ThingSpeakClient } from './thingspeak'

async function main(): Promise<void> {
  const netatmo = new NetatmoClient()
  const fritz = new FritzBoxClient()
  const thingSpeak = new ThingSpeakClient()

  const temp = await netatmo.getTemperature()

  const devices = process.env.FRITZ_DEVICES?.split(',').map(id => id.trim()) ?? []
  if (devices.length === 0) {
    throw new Error('No FRITZ_DEVICES configured')
  }
  const measurements: number[] = []
  for (const deviceId of devices) {
    const info = await fritz.getThermostatInfo(deviceId)
    const newOffset = computeOffset(info, temp)
    measurements.push(newOffset, info.adaptedTemp)
    if (newOffset !== info.offset) {
      await fritz.setThermostatOffset(deviceId, newOffset)
      console.log(`Change offset for "${info.name}" from ${info.offset}°C to ${newOffset}°C`)
    }
  }
  measurements.push(temp)
  await thingSpeak.publishData(measurements)
}

const roundToHalf = (value: number): number => Math.round(value * 2) / 2
const computeOffset = (info: ThermostatInfo, roomTemp: number): number =>
  info.active ? Math.max(Math.min(roundToHalf(roomTemp - info.measuredTemp), 0), -3) : 0

main().catch(error => console.error(error))

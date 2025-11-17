import { pbkdf2Sync } from 'node:crypto'

export interface ThermostatInfo {
  id: string
  name: string
  active: boolean
  measuredTemp: number
  adaptedTemp: number
  offset: number
}

export class FritzBoxClient {
  private sid?: string
  private readonly baseUrl: string
  private readonly username: string
  private readonly password: string
  constructor() {
    this.baseUrl = `http://${process.env.FRITZ_HOST}`
    this.username = process.env.FRITZ_USERNAME
    this.password = process.env.FRITZ_PASSWORD
  }

  async getThermostatInfo(id: string): Promise<ThermostatInfo> {
    await this.ensureLoggedIn()
    const response = await fetch(`${this.baseUrl}/api/v0/smarthome/configuration/units/${id}`, {
      headers: {
        Authorization: `AVM-SID ${this.sid}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.text().catch(() => response.statusText)
      throw new Error(`FritzAPI request failed: ${errorData}`)
    }
    const unit = await response.json()

    const adaptedTemp = unit.interfaces.temperatureInterface.celsius
    const offset = unit.interfaces.thermostatInterface.temperatureOffset.internalOffset
    const measuredTemp = adaptedTemp - offset

    return {
      id: unit.UID,
      name: unit.name,
      active:
        unit.isConnected &&
        !unit.interfaces?.thermostatInterface?.isHolidayActive &&
        !unit.interfaces?.thermostatInterface?.isSummertimeActive,
      adaptedTemp,
      measuredTemp,
      offset,
    }
  }

  async setThermostatOffset(id: string, offset: number) {
    await this.ensureLoggedIn()
    const response = await fetch(`${this.baseUrl}/api/v0/smarthome/configuration/units/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `AVM-SID ${this.sid}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        interfaces: {
          thermostatInterface: {
            temperatureOffset: {
              sensorMode: 'internal',
              internalOffset: offset,
            },
          },
        },
      }),
    })
    if (!response.ok) {
      const errorData = await response.text().catch(() => response.statusText)
      throw new Error(`Failed to set thermostat offset: ${errorData || response.statusText}`)
    }
  }

  private async login() {
    const { challenge, blockTime } = await this.getChallenge()

    if (blockTime && blockTime > 0) {
      throw new Error(`Fritz!Box login blocked for ${blockTime} seconds`)
    }

    // Parse challenge format: 2$iter1$salt1$iter2$salt2
    const parts = challenge.split('$')
    if (parts[0] !== '2') {
      throw new Error('Unsupported authentication version')
    }

    const iter1 = parseInt(parts[1], 10)
    const salt1 = Buffer.from(parts[2], 'hex')
    const iter2 = parseInt(parts[3], 10)
    const salt2 = Buffer.from(parts[4], 'hex')

    // First PBKDF2 round
    const hash1 = pbkdf2Sync(this.password, salt1, iter1, 32, 'sha256')

    // Second PBKDF2 round
    const hash2 = pbkdf2Sync(hash1, salt2, iter2, 32, 'sha256')

    const response = `${salt2.toString('hex')}$${hash2.toString('hex')}`
    const url = `${this.baseUrl}/login_sid.lua?username=${encodeURIComponent(this.username)}&response=${response}`

    const loginResponse = await fetch(url)
    if (!loginResponse.ok) {
      throw new Error(`Login request failed: ${loginResponse.statusText}`)
    }

    const xml = await loginResponse.text()
    const sidMatch = xml.match(/<SID>([^<]+)<\/SID>/)
    if (!sidMatch) {
      throw new Error('Could not parse SID from Fritz!Box response')
    }
    this.sid = sidMatch[1]

    if (this.sid === '0000000000000000') {
      throw new Error('Fritz!Box authentication failed - invalid credentials')
    }
  }

  private async getChallenge(): Promise<{ challenge: string; blockTime?: number }> {
    const response = await fetch(`${this.baseUrl}/login_sid.lua?version=2`)
    if (!response.ok) {
      throw new Error(`Failed to get challenge: ${response.statusText}`)
    }

    const xml = await response.text()

    const challengeMatch = xml.match(/<Challenge>([^<]+)<\/Challenge>/)
    const blockTimeMatch = xml.match(/<BlockTime>([^<]+)<\/BlockTime>/)

    if (!challengeMatch) {
      throw new Error('Could not parse challenge from Fritz!Box response')
    }

    return {
      challenge: challengeMatch[1],
      blockTime: blockTimeMatch ? parseInt(blockTimeMatch[1]) : undefined,
    }
  }

  private async ensureLoggedIn() {
    if (!this.sid || this.sid === '0000000000000000') {
      await this.login()
    }
  }
}

export class NetatmoClient {
  private readonly baseUrl = 'https://api.netatmo.com'
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly refreshToken: string
  private accessToken?: string
  private tokenExpiresAt: number = 0

  constructor() {
    this.clientId = process.env.NETATMO_CLIENT_ID
    this.clientSecret = process.env.NETATMO_CLIENT_SECRET
    this.refreshToken = process.env.NETATMO_REFRESH_TOKEN
  }

  async getTemperature(): Promise<number | undefined> {
    await this.ensureAuthenticated()

    const response = await fetch(`${this.baseUrl}/api/getstationsdata`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.text().catch(() => response.statusText)
      throw new Error(`Netatmo API error: ${errorData}`)
    }

    const data = await response.json()
    const device = data.body.devices.find(d => d.reachable === true && d.type === 'NAMain')
    return device?.dashboard_data.Temperature
  }

  private async authenticate(): Promise<void> {
    const params = new URLSearchParams()
    params.append('grant_type', 'refresh_token')
    params.append('client_id', this.clientId)
    params.append('client_secret', this.clientSecret)
    params.append('refresh_token', this.refreshToken)

    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    if (!response.ok) {
      const errorData = await response.text().catch(() => response.statusText)
      throw new Error(`Netatmo authentication failed: ${errorData}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt - 60000) {
      await this.authenticate()
    }
  }
}

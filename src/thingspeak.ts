export class ThingSpeakClient {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.thingspeak.com'

  constructor() {
    this.apiKey = process.env.THING_SPEAK_API_KEY
  }

  async publishData(fields: number[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/update.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        ...Object.fromEntries(fields.map((value, index) => [`field${index + 1}`, value])),
      }),
    })

    if (!response.ok) {
      const errorData = await response.text().catch(() => response.statusText)
      throw new Error(`ThingSpeak API error: ${errorData}`)
    }
  }
}

# fritz-thermo-connect

Synchronize Netatmo temperature readings with AVM Fritz!Box DECT 302 (or similar) thermostat internal temperature offsets, then publish diagnostic data points to ThingSpeak.

## Overview
This script:
1. Authenticates with Netatmo and retrieves the current station temperature.
2. Logs in to your Fritz!Box via its PBKDF2 (version 2) challenge/response flow.
3. For each configured thermostat device ID:
   - Reads current adapted temperature (internal sensor value) and stored offset.
   - Calculates a new offset so that (adaptedTemp - offset) matches the Netatmo temperature (rounded to 0.5°C steps).
   - Updates the thermostat offset if it changed.
4. Publishes a sequence of values to ThingSpeak for monitoring.

ThingSpeak fields (in current implementation):
- field1: Offset for thermostat 1
- field2: Measured temperature (derived) for thermostat 1
- field3: Offset for thermostat 2
- field4: Measured temperature (derived) for thermostat 2
- field5: Netatmo reference temperature
(Additional fields are unused; adjust code if you add more devices.)

## Requirements
- Node.js >= 22 (per `package.json`)
- A Netatmo developer application (Client ID, Client Secret, Refresh Token)
- Access credentials to your Fritz!Box (username/password) with rights to control smart home thermostats
- A ThingSpeak channel with an API write key

## Configuration
Create a `.env` file (you can copy `.env.example`):
```env
NETATMO_CLIENT_ID=xxxxxxxx
NETATMO_CLIENT_SECRET=xxxxxxxx
NETATMO_REFRESH_TOKEN=xxxxxxxx

FRITZ_HOST=fritz.box
FRITZ_USERNAME=xxxxxxxx
FRITZ_PASSWORD=xxxxxxxx
FRITZ_DEVICES=devicesId1,devicesId2

THING_SPEAK_API_KEY=xxxxxxxx
```

## Running
Execute once:
```bash
npm start
```

## Scheduling (Cron/Systemd)
Example cron entry to run every 15 minutes:
```cron
*/15 * * * * cd /path/to/fritz-thermo-connect && npm start >> run.log 2>&1
```

# 🐾 PawFeed — Smart IoT Pet Feeder Dashboard

A real-time web dashboard for monitoring and controlling an IoT-connected automatic pet feeder. Built with Node.js, Express, Socket.io, and MQTT, PawFeed lets you track food/water levels, room temperature, dispense food manually, and manage automated feeding schedules — all from a browser.

---

## Features

- **Real-time monitoring** — live food level gauge, water level, and room temperature updated via MQTT and Socket.io
- **Manual dispensing** — trigger a food dispense with a configurable portion size from the dashboard
- **Automated schedules** — pre-configured morning, afternoon, evening, and weekend snack schedules stored in a local JSON database
- **Feeding history** — logs every dispense (manual or scheduled) with timestamps and portion sizes
- **Alerts & notifications** — visual warnings for low food, jams, and other hardware events
- **Dark / light theme** — toggle between themes with persistent UI state
- **Demo mode** — runs a simulated sensor feed automatically when no hardware is connected

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js, Express 4 |
| Real-time | Socket.io 4 |
| IoT messaging | MQTT 5 (default broker: HiveMQ public) |
| Database | lowdb 2 (flat JSON file) |
| Frontend charts | Chart.js 4 |
| Fonts | Plus Jakarta Sans (Google Fonts) |

---

## Project Structure

```
PawFeed/
├── server.js       # Express + Socket.io + MQTT server
├── app.js          # Frontend JavaScript (dashboard logic)
├── index.html      # Dashboard UI
├── style.css       # Styles (light & dark theme)
├── pawfeed.json    # Local database (feedings, schedules, sensor logs)
└── package.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm

### Installation

```bash
git clone https://github.com/your-username/PawFeed.git
cd PawFeed
npm install
```

### Running the Server

```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Configuration

Create a `.env` file in the project root to override defaults:

```env
PORT=3000
MQTT_BROKER=mqtt://broker.hivemq.com:1883
MQTT_TOPIC_STATUS=pawfeed/karyl/status
MQTT_TOPIC_SENSOR=pawfeed/karyl/sensor
MQTT_TOPIC_CMD=pawfeed/karyl/command
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `MQTT_BROKER` | `mqtt://broker.hivemq.com:1883` | MQTT broker URL |
| `MQTT_TOPIC_STATUS` | `pawfeed/karyl/status` | Topic for hardware status updates |
| `MQTT_TOPIC_SENSOR` | `pawfeed/karyl/sensor` | Topic for sensor readings |
| `MQTT_TOPIC_CMD` | `pawfeed/karyl/command` | Topic for dispense commands sent to hardware |

---

## REST API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/feed` | Trigger a food dispense. Body: `{ "portion": 80, "type": "manual" }` |
| `GET` | `/feedings/today` | Get all feeding records for today |

---

## Hardware Integration

The server publishes dispense commands to `MQTT_TOPIC_CMD` as JSON:

```json
{ "action": "feed", "portion_g": 80 }
```

The hardware should publish sensor readings to `MQTT_TOPIC_STATUS` / `MQTT_TOPIC_SENSOR`:

```json
{
  "food_level": 72,
  "water_level": 50,
  "temperature": 22.5,
  "jammed": false
}
```

When no hardware is connected and the page is opened without a live server, the dashboard automatically enters **demo simulation mode**.

---

## Default Feeding Schedules

| Label | Time | Portion | Days | Enabled |
|---|---|---|---|---|
| Morning | 07:00 | 80 g | Daily | ✅ |
| Afternoon | 12:30 | 80 g | Daily | ✅ |
| Evening | 18:00 | 80 g | Daily | ✅ |
| Late snack | 22:00 | 40 g | Weekends | ❌ |

Schedules are stored in `pawfeed.json` and can be edited directly or through the dashboard.

---

## License

MIT

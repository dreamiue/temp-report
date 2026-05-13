import bme280
import smbus2
import paho.mqtt.client as mqtt
import json
import os
from datetime import datetime
from time import sleep

# ── Sensor setup ──────────────────────────────
port = 1
address = 0x76
bus = smbus2.SMBus(port)
calibration_params = bme280.load_calibration_params(bus, address)

# ── MQTT setup ────────────────────────────────
BROKER = 'broker.hivemq.com'
TOPIC  = 'my-temp-project/my-room'

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.connect(BROKER, 1883)
client.loop_start()

# ── Data file path ────────────────────────────
DATA_FILE = '/home/chris/project/temp/docs/data.json'

def load_today_data():
    today = datetime.now().strftime('%Y-%m-%d')
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            saved = json.load(f)
        if saved.get('date') == today:
            return saved
    # Fresh day
    return {'date': today, 'readings': [None] * 1440}

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f)

print('Started — sending readings...')

while True:
    bme280_data = bme280.sample(bus, address, calibration_params)
    humidity = bme280_data.humidity
    pressure = bme280_data.pressure
    ambient_temp = bme280_data.temperature

    feels_like = ambient_temp - 0.55 * (1 - humidity / 100) * (ambient_temp - 14.5)

    now = datetime.now()
    minute_index = now.hour * 60 + now.minute

    # Save to file
    day_data = load_today_data()
    day_data['readings'][minute_index] = round(ambient_temp, 1)

    # Reject readings that jump more than 2°C from the last valid reading
    last_valid = next((r for r in reversed(day_data['readings'][:minute_index]) if r is not None), None)
    if last_valid is None or abs(ambient_temp - last_valid) <= 2.0:
        day_data['readings'][minute_index] = round(ambient_temp, 1)
    else:
        print(f"Rejected spike: {ambient_temp:.1f}°C (last was {last_valid:.1f}°C)")

    save_data(day_data)

    # Publish live via MQTT
    payload = json.dumps({
        'temp':       round(ambient_temp, 1),
        'humidity':   round(humidity, 1),
        'pressure':   round(pressure, 1),
        'feels_like': round(feels_like, 1)
    })
    client.publish(TOPIC, payload, retain=True)
    print(f"{now.strftime('%H:%M')} → {ambient_temp:.1f}°C published & saved")

    sleep(60)
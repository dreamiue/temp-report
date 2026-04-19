// ── 1. CHART SETUP ──────────────────────────────────────────

// We'll use Chart.js to draw the line chart.
// First, add this to your index.html <head> (add it before your script tag):
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

const ctx = document.getElementById('temp-chart').getContext('2d');

// Pre-fill every minute of the day as empty labels
// Chart shows full day from the start
const allLabels = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m++) {
    allLabels.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  }
}

const chartData = {
  labels: allLabels,        // all 1440 minutes pre-loaded
  temps: new Array(1440).fill(null)   // null = no reading yet, draws as a gap
};

const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: chartData.labels,
    datasets: [{
      data: chartData.temps,
      borderColor: '#5DCAA5',
      borderWidth: 2,
      pointRadius: 0,          // no dots on the line
      tension: 0.4,            // makes it smooth and curvy
      fill: true,
      backgroundColor: 'rgba(93, 202, 165, 0.1)'
    }]
  },
  options: {
    animation: false,          // no animation on update (feels more "live")
    responsive: true,
    scales: {
      x: {
        ticks: {
          color: 'rgba(93,202,165,1)',
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: false,
          // Only show a tick every 3 hours
          callback: function(val, index) {
            const label = this.getLabelForValue(val);
            const [h, m] = label.split(':').map(Number);
            return m === 0 && h % 3 === 0 ? `${String(h).padStart(2,'0')}:00` : '';
          }
        },
        grid: { color: 'rgba(93,202,165,0.08)' }
      },
      y: {
        ticks: {
          color: 'rgba(93,202,165,1)',
          font: { size: 10 },
          callback: val => `${val}°`
        },
        grid: { color: 'rgba(93,202,165,0.08)' }
      }
    },
    plugins: {
      legend: { display: false }
    }
  }
});


// ── 2. MQTT SETUP ───────────────────────────────────────────

// Also add this to your index.html <head>:
// <script src="https://cdn.jsdelivr.net/npm/mqtt/dist/mqtt.min.js"></script>

// We use a free public broker — no account needed
const BROKER = 'wss://broker.hivemq.com:8884/mqtt';

// This is the "channel name" on the notice board.
// Your Pi will publish to the same topic.
// Change 'my-room' to something unique so it's just yours!
const TOPIC = 'my-temp-project/my-room';

const client = mqtt.connect(BROKER);

client.on('connect', () => {
  console.log('Connected to MQTT broker!');
  setStatus('connected');
  client.subscribe(TOPIC);
});

client.on('error', (err) => {
  console.error('MQTT error:', err);
  setStatus('offline');
});

client.on('close', () => {
  setStatus('offline');
});


// ── 3. HANDLE INCOMING DATA ─────────────────────────────────

client.on('message', (topic, message) => {
  // The Pi will send JSON like: {"temp": 23.4, "humidity": 61}
  try {
    const data = JSON.parse(message.toString());

    // Update the big number
    document.getElementById('temperature').textContent = data.temp.toFixed(1);

    // Update the small cards
    if (data.humidity !== undefined) {
      document.getElementById('humidity').textContent = data.humidity.toFixed(0) + '%';
    }
    if (data.feels_like !== undefined) {
      document.getElementById('feels-like').textContent = data.feels_like.toFixed(1) + '°C';
    }

    // Add to chart
    const now = new Date();
    const minuteIndex = now.getHours() * 60 + now.getMinutes();
    chartData.temps[minuteIndex] = data.temp;
    chart.update();

  } catch (e) {
    console.error('Could not read message:', e);
  }
});


// ── 4. HELPER — update connection status UI ──────────────────

function setStatus(state) {
  const dot = document.getElementById('dot');
  const conn = document.getElementById('connection');
  const status = document.getElementById('status');

  if (state === 'connected') {
    dot.classList.add('connected');
    conn.textContent = 'MQTT broker';
    status.textContent = 'Connected — waiting for data...';
  } else {
    dot.classList.remove('connected');
    conn.textContent = 'Offline';
    status.textContent = 'Connecting...';
  }
}
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <NewPing.h>

// --- NETWORK CONFIG ---
const char* ssid = "WIFI NAME";
const char* password = "WIFI PASSOWORD";
const char* mqtt_server = "broker.hivemq.com"; // [cite: 858]

// --- PIN ASSIGNMENTS (Based on Figure 3.13) ---
#define SERVO_PIN      13 // [cite: 722, 803]
#define TRIG_PIN       5  // [cite: 739, 799]
#define ECHO_PIN       18 // [cite: 739, 798]
#define IR_PIN         19 // [cite: 741, 800]
#define BUZZER_PIN     4  // [cite: 599, 808]
#define LED_PIN        2  // [cite: 599, 810]

// --- AUTONOMOUS SETTINGS ---
const int lowFoodThreshold = 20;       // Auto-feed if level < 20% [cite: 663]
const unsigned long feedCooldown = 60000; // 1 minute delay between auto-feeds
unsigned long lastAutoFeedTime = 0;

WiFiClient espClient;
PubSubClient client(espClient);
Servo feederServo;
NewPing sonar(TRIG_PIN, ECHO_PIN, 200);

void dispenseFood();
void sendTelemetry(int level, bool jammed);
void reconnect();

void callback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<200> doc;
  deserializeJson(doc, payload, length);
  if (String(doc["action"]) == "feed") {
    Serial.println("Dashboard command: Dispensing..."); // [cite: 155]
    dispenseFood(); 
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(IR_PIN, INPUT); // [cite: 653]
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT); // [cite: 838]

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\n✅ Connected. IP: " + WiFi.localIP().toString()); // [cite: 654, 838]

  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  ESP32PWM::allocateTimer(0);
  feederServo.attach(SERVO_PIN, 500, 2400); // [cite: 834]
  feederServo.write(0); 
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  unsigned long now = millis();

  // 1. Monitor Sensors [cite: 517, 638]
  int dist = sonar.ping_cm();
  int level = (dist > 0) ? constrain(map(dist, 2, 20, 100, 0), 0, 100) : 0; // [cite: 560, 847]
  bool jammed = (digitalRead(IR_PIN) == LOW); // [cite: 620, 701]

  // 2. Automatic Feeding Logic (Closed-Loop) [cite: 681, 700]
  if (level < lowFoodThreshold && (now - lastAutoFeedTime > feedCooldown) && !jammed) {
    Serial.println("AUTON: Low food detected. Actuating..."); 
    dispenseFood();
    lastAutoFeedTime = now;
  }

  // 3. Telemetry Update [cite: 154, 321]
  static unsigned long lastUpdate = 0;
  if (now - lastUpdate > 10000) { 
    lastUpdate = now;
    sendTelemetry(level, jammed);
  }
}

void dispenseFood() {
  digitalWrite(LED_PIN, HIGH);    // Indicator ON [cite: 838]
  digitalWrite(BUZZER_PIN, HIGH); // Sound Alert [cite: 599, 837]
  delay(500);
  digitalWrite(BUZZER_PIN, LOW);
  
  feederServo.write(90); // Open gate [cite: 834]
  delay(2000);           
  feederServo.write(0);  // Close gate
  
  digitalWrite(LED_PIN, LOW);     // Indicator OFF
}

void sendTelemetry(int level, bool jammed) {
  StaticJsonDocument<200> doc;
  doc["food_level"] = level;
  doc["jammed"] = jammed;
  doc["temperature"] = 24.5; // [cite: 285]

  char buffer[256];
  serializeJson(doc, buffer);
  client.publish("pawfeed/karyl/sensor", buffer); // [cite: 154, 302]
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect("PawCareClient-karyl")) { 
      client.subscribe("pawfeed/karyl/command"); // [cite: 155, 308]
    } else { delay(5000); }
  }
}
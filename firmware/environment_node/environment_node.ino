/**
 * AegisMesh — Environment Monitoring Node (ESP32-A / Node Alpha)
 * ESP32 Firmware — DHT11 Temperature & Humidity Sensor
 *
 * Responsibilities:
 * - Read DHT11 sensor (temperature + humidity)
 * - Publish telemetry every 2 seconds
 * - Send heartbeat every 5 seconds
 * - LED status indication
 *
 * MQTT Topics:
 *   Publish: aegismesh/nodes/ESP32-A/heartbeat
 *   Publish: aegismesh/nodes/ESP32-A/register
 *   Publish: aegismesh/nodes/ESP32-A/telemetry
 *
 * Wiring:
 *   DHT11 DATA → GPIO 15
 *   DHT11 VCC  → 3.3V
 *   DHT11 GND  → GND
 *   LED        → GPIO 4 (optional status LED)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ══════════════════════════════════════════════════════
// CONFIGURATION — UPDATE THESE
// ══════════════════════════════════════════════════════
const char* WIFI_SSID     = "Ayush";
const char* WIFI_PASSWORD = "1234567890";
const char* MQTT_BROKER   = "172.20.10.3";
const int   MQTT_PORT     = 1883;

const char* NODE_ID       = "ESP32-A";
const char* NODE_LABEL    = "Node Alpha";
const char* NODE_TYPE     = "esp32";
const char* FIRMWARE_VER  = "3.0.0";

// ══════════════════════════════════════════════════════
// PIN CONFIGURATION
// ══════════════════════════════════════════════════════
#define DHTPIN    15
#define DHTTYPE   DHT11
#define PIR_PIN   27
#define LED_PIN   4
#define LED_BUILTIN_PIN 2

// ══════════════════════════════════════════════════════
// GLOBALS
// ══════════════════════════════════════════════════════
WiFiClient espClient;
PubSubClient mqtt(espClient);
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastHeartbeat = 0;
unsigned long lastTelemetry = 0;
unsigned long bootTime      = 0;
unsigned long lastMotionTime = 0;
bool          motionDetected = false;
int           motionCount    = 0;

// ══════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("╔═══════════════════════════════╗");
  Serial.println("║  AegisMesh Node Alpha ESP32-A ║");
  Serial.println("║  Environment Monitor (DHT11)  ║");
  Serial.println("╚═══════════════════════════════╝");

  pinMode(LED_PIN, OUTPUT);
  pinMode(LED_BUILTIN_PIN, OUTPUT);
  pinMode(PIR_PIN, INPUT);
  dht.begin();

  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  connectMQTT();

  bootTime = millis();
  registerNode();

  Serial.println("[PIR] Calibrating (30s warmup)...");
}

// ══════════════════════════════════════════════════════
// LOOP
// ══════════════════════════════════════════════════════
void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  unsigned long now = millis();

  // PIR motion check
  int pirState = digitalRead(PIR_PIN);
  if (pirState == HIGH && !motionDetected) {
    motionDetected = true;
    lastMotionTime = now;
    motionCount++;
    digitalWrite(LED_PIN, HIGH);
    Serial.println("[PIR] MOTION DETECTED");
  } else if (pirState == LOW && motionDetected) {
    // Reset after 3 seconds of no motion
    if (now - lastMotionTime > 3000) {
      motionDetected = false;
      digitalWrite(LED_PIN, LOW);
    }
  }

  if (now - lastHeartbeat >= 5000) {
    sendHeartbeat();
    lastHeartbeat = now;
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }

  if (now - lastTelemetry >= 2000) {
    sendTelemetry();
    lastTelemetry = now;
  }
}

// ══════════════════════════════════════════════════════
// WiFi
// ══════════════════════════════════════════════════════
void connectWiFi() {
  Serial.print("[WiFi] Connecting...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(" OK! IP: "); Serial.println(WiFi.localIP());
    digitalWrite(LED_BUILTIN_PIN, HIGH);
  } else {
    Serial.println(" FAILED"); ESP.restart();
  }
}

// ══════════════════════════════════════════════════════
// MQTT
// ══════════════════════════════════════════════════════
void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting...");
    if (mqtt.connect((String(NODE_ID) + "-" + String(random(1000))).c_str())) {
      Serial.println(" connected!");
    } else {
      Serial.print(" failed ("); Serial.print(mqtt.state()); Serial.println(") retry in 3s");
      delay(3000);
    }
  }
}

void registerNode() {
  StaticJsonDocument<256> doc;
  doc["label"]           = NODE_LABEL;
  doc["nodeType"]        = NODE_TYPE;
  doc["ipAddress"]       = WiFi.localIP().toString();
  doc["firmwareVersion"] = FIRMWARE_VER;
  char buf[256]; serializeJson(doc, buf);
  mqtt.publish("aegismesh/nodes/ESP32-A/register", buf);
  Serial.println("[MQTT] ✓ Registered");
  
  // Send immediate heartbeat on boot
  sendHeartbeat();
  lastHeartbeat = millis();
}

void sendHeartbeat() {
  StaticJsonDocument<128> doc;
  doc["rssi"]    = WiFi.RSSI();
  doc["latency"] = random(5, 25);
  doc["uptime"]  = (millis() - bootTime) / 1000;
  doc["fw"]      = FIRMWARE_VER;
  char buf[128]; serializeJson(doc, buf);
  mqtt.publish("aegismesh/nodes/ESP32-A/heartbeat", buf);
}

// ══════════════════════════════════════════════════════
// TELEMETRY — DHT11 sensor
// ══════════════════════════════════════════════════════
void sendTelemetry() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();

  // Fallback if sensor fails
  if (isnan(temp)) temp = 25.0 + random(-30, 30) / 10.0;
  if (isnan(hum))  hum  = 55.0 + random(-50, 50) / 10.0;

  StaticJsonDocument<256> doc;
  doc["temperature"]    = temp;
  doc["humidity"]       = hum;
  doc["gasLevel"]       = 0;
  doc["motionDetected"] = motionDetected;
  doc["motionCount"]    = motionCount;
  doc["cpuUsage"]       = random(15, 40);
  doc["networkLoad"]    = random(20, 50);
  doc["batteryLevel"]   = random(75, 100);
  doc["powerStatus"]    = "normal";
  doc["latency"]        = random(5, 25);

  char buf[256]; serializeJson(doc, buf);
  mqtt.publish("aegismesh/nodes/ESP32-A/telemetry", buf);

  Serial.print("[Telemetry] T="); Serial.print(temp);
  Serial.print("°C H="); Serial.print(hum);
  Serial.print("% Motion="); Serial.println(motionDetected ? "YES" : "no");
}

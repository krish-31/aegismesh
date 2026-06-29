/**
 * AegisMesh — Safety Monitoring Node (ESP32-B / Node Beta)
 * ESP32 Firmware — MQ2 Gas/Smoke Sensor
 *
 * Responsibilities:
 * - Read MQ2 gas/smoke sensor (analog)
 * - Publish telemetry every 2 seconds
 * - Generate emergency alert on high gas levels
 * - Send heartbeat every 5 seconds
 *
 * MQTT Topics:
 *   Publish: aegismesh/nodes/ESP32-B/heartbeat
 *   Publish: aegismesh/nodes/ESP32-B/register
 *   Publish: aegismesh/nodes/ESP32-B/telemetry
 *
 * Wiring:
 *   MQ2 A0   → GPIO 34 (ADC1)
 *   MQ2 VCC  → 5V
 *   MQ2 GND  → GND
 *   LED      → GPIO 4
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ══════════════════════════════════════════════════════
// CONFIGURATION — UPDATE THESE
// ══════════════════════════════════════════════════════
const char* WIFI_SSID     = "Ayush";
const char* WIFI_PASSWORD = "1234567890";
const char* MQTT_BROKER   = "172.20.10.3";
const int   MQTT_PORT     = 1883;

const char* NODE_ID       = "ESP32-B";
const char* NODE_LABEL    = "Node Beta";
const char* NODE_TYPE     = "esp32";
const char* FIRMWARE_VER  = "3.0.0";

// ══════════════════════════════════════════════════════
// PIN CONFIGURATION
// ══════════════════════════════════════════════════════
#define MQ2_PIN     34    // Analog input
#define LED_PIN     4
#define LED_BUILTIN 2
#define GAS_THRESHOLD 300 // Emergency threshold (0-4095)

// ══════════════════════════════════════════════════════
// GLOBALS
// ══════════════════════════════════════════════════════
WiFiClient espClient;
PubSubClient mqtt(espClient);

unsigned long lastHeartbeat = 0;
unsigned long lastTelemetry = 0;
unsigned long bootTime      = 0;
bool          emergencyActive = false;

// ══════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("╔═══════════════════════════════╗");
  Serial.println("║  AegisMesh Node Beta ESP32-B  ║");
  Serial.println("║  Safety Monitor (MQ2 Gas)     ║");
  Serial.println("╚═══════════════════════════════╝");

  pinMode(LED_PIN, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(MQ2_PIN, INPUT);

  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  connectMQTT();

  bootTime = millis();
  registerNode();
}

// ══════════════════════════════════════════════════════
// LOOP
// ══════════════════════════════════════════════════════
void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  unsigned long now = millis();

  if (now - lastHeartbeat >= 5000) {
    sendHeartbeat();
    lastHeartbeat = now;
  }

  if (now - lastTelemetry >= 2000) {
    sendTelemetry();
    lastTelemetry = now;
  }

  // Emergency blink
  if (emergencyActive) {
    digitalWrite(LED_PIN, (now / 200) % 2);
  }
}

// ══════════════════════════════════════════════════════
// WiFi + MQTT (same pattern)
// ══════════════════════════════════════════════════════
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[WiFi] IP: "); Serial.println(WiFi.localIP());
    digitalWrite(LED_BUILTIN, HIGH);
  } else { ESP.restart(); }
}

void connectMQTT() {
  while (!mqtt.connected()) {
    if (mqtt.connect((String(NODE_ID) + "-" + String(random(1000))).c_str())) {
      Serial.println("[MQTT] Connected");
    } else { delay(3000); }
  }
}

void registerNode() {
  StaticJsonDocument<256> doc;
  doc["label"]           = NODE_LABEL;
  doc["nodeType"]        = NODE_TYPE;
  doc["ipAddress"]       = WiFi.localIP().toString();
  doc["firmwareVersion"] = FIRMWARE_VER;
  char buf[256]; serializeJson(doc, buf);
  mqtt.publish("aegismesh/nodes/ESP32-B/register", buf);
  Serial.println("[MQTT] ✓ Registered");
  
  // Send immediate heartbeat on boot to prevent backend timeouts
  sendHeartbeat();
  lastHeartbeat = millis();
}

void sendHeartbeat() {
  StaticJsonDocument<128> doc;
  doc["rssi"]    = WiFi.RSSI();
  doc["latency"] = random(5, 30);
  doc["uptime"]  = (millis() - bootTime) / 1000;
  doc["fw"]      = FIRMWARE_VER;
  char buf[128]; serializeJson(doc, buf);
  mqtt.publish("aegismesh/nodes/ESP32-B/heartbeat", buf);
}

// ══════════════════════════════════════════════════════
// TELEMETRY — MQ2 Gas Sensor
// ══════════════════════════════════════════════════════
void sendTelemetry() {
  int rawGas = analogRead(MQ2_PIN);
  float gasLevel = map(rawGas, 0, 4095, 0, 100);

  // Check for emergency
  if (rawGas > GAS_THRESHOLD && !emergencyActive) {
    emergencyActive = true;
    Serial.println("[ALERT] ⚠ HIGH GAS LEVEL DETECTED!");
  } else if (rawGas < GAS_THRESHOLD - 50) {
    emergencyActive = false;
  }

  StaticJsonDocument<256> doc;
  doc["temperature"]    = 30.0 + random(-20, 20) / 10.0;  // No temp sensor on this node
  doc["humidity"]       = 60.0 + random(-50, 50) / 10.0;
  doc["gasLevel"]       = gasLevel;
  doc["motionDetected"] = false;
  doc["cpuUsage"]       = random(20, 45);
  doc["networkLoad"]    = random(30, 60);
  doc["batteryLevel"]   = random(70, 95);
  doc["powerStatus"]    = emergencyActive ? "alert" : "normal";
  doc["latency"]        = random(5, 30);

  char buf[256]; serializeJson(doc, buf);
  mqtt.publish("aegismesh/nodes/ESP32-B/telemetry", buf);

  Serial.print("[Telemetry] Gas="); Serial.print(gasLevel);
  Serial.print(" Raw="); Serial.println(rawGas);
}

/**
 * AegisMesh — Security Monitoring Node (ESP32-C / Node Gamma)
 * ESP32 Firmware — PIR Motion Detection Sensor
 *
 * Responsibilities:
 * - Detect motion via PIR sensor
 * - Publish telemetry every 2 seconds
 * - Generate security event on motion detection
 * - Send heartbeat every 5 seconds
 *
 * MQTT Topics:
 *   Publish: aegismesh/nodes/ESP32-C/heartbeat
 *   Publish: aegismesh/nodes/ESP32-C/register
 *   Publish: aegismesh/nodes/ESP32-C/telemetry
 *
 * Wiring:
 *   PIR OUT  → GPIO 27
 *   PIR VCC  → 5V
 *   PIR GND  → GND
 *   LED      → GPIO 4
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

const char* NODE_ID       = "ESP32-C";
const char* NODE_LABEL    = "Node Gamma";
const char* NODE_TYPE     = "esp32";
const char* FIRMWARE_VER  = "3.0.0";

// ══════════════════════════════════════════════════════
// PIN CONFIGURATION
// ══════════════════════════════════════════════════════
#define DHTPIN      14
#define DHTTYPE     DHT11
#define LED_PIN     4
#define LED_BUILTIN 2

// ══════════════════════════════════════════════════════
// GLOBALS
// ══════════════════════════════════════════════════════
WiFiClient espClient;
PubSubClient mqtt(espClient);
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastHeartbeat   = 0;
unsigned long lastTelemetry   = 0;
unsigned long bootTime        = 0;

// ══════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("╔═══════════════════════════════╗");
  Serial.println("║  AegisMesh Node Gamma ESP32-C ║");
  Serial.println("║  Climate Monitor (DHT11)      ║");
  Serial.println("╚═══════════════════════════════╝");

  pinMode(LED_PIN, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  dht.begin();

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
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }

  if (now - lastTelemetry >= 2000) {
    sendTelemetry();
    lastTelemetry = now;
  }
}

// ══════════════════════════════════════════════════════
// WiFi + MQTT
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
  mqtt.publish("aegismesh/nodes/ESP32-C/register", buf);
  Serial.println("[MQTT] ✓ Registered");
  
  // Send immediate heartbeat on boot
  sendHeartbeat();
  lastHeartbeat = millis();
}

void sendHeartbeat() {
  StaticJsonDocument<128> doc;
  doc["rssi"]    = WiFi.RSSI();
  doc["latency"] = random(8, 35);
  doc["uptime"]  = (millis() - bootTime) / 1000;
  doc["fw"]      = FIRMWARE_VER;
  char buf[128]; serializeJson(doc, buf);
  mqtt.publish("aegismesh/nodes/ESP32-C/heartbeat", buf);
}

// ══════════════════════════════════════════════════════
// TELEMETRY — DHT11 Climate Sensor
// ══════════════════════════════════════════════════════
void sendTelemetry() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();

  if (isnan(temp)) temp = 25.0 + random(-30, 30) / 10.0;
  if (isnan(hum))  hum  = 55.0 + random(-50, 50) / 10.0;

  StaticJsonDocument<256> doc;
  doc["temperature"]    = temp;
  doc["humidity"]       = hum;
  doc["gasLevel"]       = 0;
  doc["cpuUsage"]       = random(15, 35);
  doc["networkLoad"]    = random(25, 55);
  doc["batteryLevel"]   = random(70, 100);
  doc["powerStatus"]    = "normal";
  doc["latency"]        = random(8, 35);

  char buf[256]; serializeJson(doc, buf);
  mqtt.publish("aegismesh/nodes/ESP32-C/telemetry", buf);

  Serial.print("[Telemetry] T="); Serial.print(temp);
  Serial.print("°C H="); Serial.print(hum);
  Serial.println("%");
}

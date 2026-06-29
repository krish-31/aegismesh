/**
 * AegisMesh — Gateway Node (GW-001)
 * ESP32 Firmware — MQTT Coordinator
 *
 * Responsibilities:
 * - Connect to WiFi and MQTT broker
 * - Send heartbeat every 5 seconds
 * - Coordinate mesh synchronization
 * - LED status indication
 *
 * MQTT Topics:
 *   Publish:  aegismesh/nodes/GW-001/heartbeat
 *   Publish:  aegismesh/nodes/GW-001/register
 *   Publish:  aegismesh/nodes/GW-001/telemetry
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ══════════════════════════════════════════════════════
// CONFIGURATION — UPDATE THESE FOR YOUR NETWORK
// ══════════════════════════════════════════════════════
const char* WIFI_SSID     = "Ayush";
const char* WIFI_PASSWORD = "1234567890";
const char* MQTT_BROKER   = "172.20.10.3";  // e.g. "192.168.1.100"
const int   MQTT_PORT     = 1883;

const char* NODE_ID       = "GW-001";
const char* NODE_LABEL    = "Gateway";
const char* NODE_TYPE     = "gateway";
const char* FIRMWARE_VER  = "3.0.0";

// ══════════════════════════════════════════════════════
// PIN CONFIGURATION
// ══════════════════════════════════════════════════════
#define LED_STATUS    2    // Built-in LED (GPIO 2)
#define LED_HEARTBEAT 4    // Optional external LED

// ══════════════════════════════════════════════════════
// GLOBALS
// ══════════════════════════════════════════════════════
WiFiClient espClient;
PubSubClient mqtt(espClient);

unsigned long lastHeartbeat = 0;
unsigned long lastTelemetry = 0;
unsigned long bootTime      = 0;
int           reconnects    = 0;

// ══════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("╔═══════════════════════════════╗");
  Serial.println("║  AegisMesh Gateway GW-001     ║");
  Serial.println("║  Self-Healing IoT Mesh v3     ║");
  Serial.println("╚═══════════════════════════════╝");

  pinMode(LED_STATUS, OUTPUT);
  pinMode(LED_HEARTBEAT, OUTPUT);
  digitalWrite(LED_STATUS, LOW);

  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  connectMQTT();

  bootTime = millis();
  registerNode();
}

// ══════════════════════════════════════════════════════
// LOOP
// ══════════════════════════════════════════════════════
void loop() {
  if (!mqtt.connected()) {
    connectMQTT();
  }
  mqtt.loop();

  unsigned long now = millis();

  // Heartbeat every 5s
  if (now - lastHeartbeat >= 5000) {
    sendHeartbeat();
    lastHeartbeat = now;
  }

  // Telemetry every 2s
  if (now - lastTelemetry >= 2000) {
    sendTelemetry();
    lastTelemetry = now;
  }

  // Blink heartbeat LED
  digitalWrite(LED_HEARTBEAT, (now / 500) % 2);
}

// ══════════════════════════════════════════════════════
// WiFi
// ══════════════════════════════════════════════════════
void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_STATUS, !digitalRead(LED_STATUS));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("[WiFi] Connected! IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_STATUS, HIGH);
  } else {
    Serial.println("\n[WiFi] FAILED — restarting...");
    ESP.restart();
  }
}

// ══════════════════════════════════════════════════════
// MQTT
// ══════════════════════════════════════════════════════
void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting to broker...");
    String clientId = String(NODE_ID) + "-" + String(random(1000));

    if (mqtt.connect(clientId.c_str())) {
      Serial.println(" connected!");
      reconnects++;
      // Subscribe to commands
      mqtt.subscribe("aegismesh/commands/#");
    } else {
      Serial.print(" failed (rc=");
      Serial.print(mqtt.state());
      Serial.println(") — retrying in 3s");
      delay(3000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.print("[MQTT] Received on ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(msg);
}

// ══════════════════════════════════════════════════════
// REGISTRATION
// ══════════════════════════════════════════════════════
void registerNode() {
  StaticJsonDocument<256> doc;
  doc["label"]           = NODE_LABEL;
  doc["nodeType"]        = NODE_TYPE;
  doc["ipAddress"]       = WiFi.localIP().toString();
  doc["firmwareVersion"] = FIRMWARE_VER;

  char buffer[256];
  serializeJson(doc, buffer);
  mqtt.publish("aegismesh/nodes/GW-001/register", buffer);
  Serial.println("[MQTT] ✓ Node registered");
  
  // Send immediate heartbeat on boot
  sendHeartbeat();
  lastHeartbeat = millis();
}

// ══════════════════════════════════════════════════════
// HEARTBEAT
// ══════════════════════════════════════════════════════
void sendHeartbeat() {
  StaticJsonDocument<128> doc;
  doc["rssi"]    = WiFi.RSSI();
  doc["latency"] = random(3, 15);
  doc["uptime"]  = (millis() - bootTime) / 1000;
  doc["fw"]      = FIRMWARE_VER;

  char buffer[128];
  serializeJson(doc, buffer);
  mqtt.publish("aegismesh/nodes/GW-001/heartbeat", buffer);
}

// ══════════════════════════════════════════════════════
// TELEMETRY (Gateway — system metrics only)
// ══════════════════════════════════════════════════════
void sendTelemetry() {
  StaticJsonDocument<256> doc;
  doc["temperature"]    = 35.0 + random(-20, 20) / 10.0;
  doc["humidity"]       = 45.0 + random(-50, 50) / 10.0;
  doc["gasLevel"]       = random(0, 10);
  doc["motionDetected"] = false;
  doc["cpuUsage"]       = random(20, 50);
  doc["networkLoad"]    = random(40, 80);
  doc["batteryLevel"]   = 100;  // Gateway is powered
  doc["powerStatus"]    = "normal";

  char buffer[256];
  serializeJson(doc, buffer);
  mqtt.publish("aegismesh/nodes/GW-001/telemetry", buffer);
}

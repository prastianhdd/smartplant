#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

#define API_URL "https://smartplant.web.id/api/telemetry"
#define DEVICE_TOKEN "d8fe9dbfafb2bb22d15f9a72eba728d4cbaf7094a4964053fa209a8cb8324a2d"
#define SOIL   34
#define DHT_22 4
#define RELAY  27
#define LED_1  25   // LED BASAH
#define LED_2  32   // LED KERING

char ssid[] = "NAMA_WIFI";
char pass[] = "PASSWORD_WIFI";

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
DHT dht(DHT_22, DHT22);
bool pompa = false;
bool rusak = false;
unsigned long mulaiPompa = 0;
unsigned long kirimTerakhir = 0;

void setup() {
  Serial.begin(115200);
  digitalWrite(RELAY, HIGH);   // pompa mati sebelum pin menjadi OUTPUT
  pinMode(RELAY, OUTPUT);
  pinMode(LED_1, OUTPUT);
  pinMode(LED_2, OUTPUT);
  digitalWrite(LED_1, LOW);
  digitalWrite(LED_2, LOW);

  dht.begin();
  Wire.begin(21, 22);
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, pass);     // tidak menunggu Wi-Fi agar pompa tetap diatur
}

void loop() {
  int adc = analogRead(SOIL);
  float suhu = dht.readTemperature();
  float lembap = dht.readHumidity();

  // Pompa tetap ON di kondisi LEMBAB sampai mencapai BASAH.
  if (rusak == false) {
    if (adc >= 3200 && pompa == false) {
      pompa = true;
      mulaiPompa = millis();
    }
    else if (adc <= 1100) {
      pompa = false;
    }
  }
  if (pompa == true && millis() - mulaiPompa >= 60000) {
    pompa = false;
    rusak = true;             // periksa pompa, lalu reset ESP32
  }
  if (pompa == true) {
    digitalWrite(RELAY, LOW);
  } else {
    digitalWrite(RELAY, HIGH);
  }

  String kondisi = "LEMBAB";
  digitalWrite(LED_1, LOW);
  digitalWrite(LED_2, LOW);
  if (adc >= 3200) {
    kondisi = "KERING";
    digitalWrite(LED_2, HIGH);
  }
  else if (adc <= 1100) {
    kondisi = "BASAH";
    digitalWrite(LED_1, HIGH);
  }
  if (rusak == true) {
    kondisi = "CEK POMPA";
    digitalWrite(LED_2, HIGH);
  }

  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.print("Suhu  : ");
  oled.print(suhu, 1);
  oled.println(" C");
  oled.setCursor(0, 8);
  oled.print("Lembap: ");
  oled.print(lembap, 1);
  oled.println(" %");
  oled.setCursor(0, 16);
  if (pompa == true) {
    oled.println("Pompa : ON");
  } else {
    oled.println("Pompa : OFF");
  }
  oled.setTextSize(2);
  oled.setCursor(0, 36);
  oled.println(kondisi);
  oled.display();

  Serial.print("ADC: ");
  Serial.print(adc);
  Serial.print(" | Suhu: ");
  Serial.print(suhu, 1);
  Serial.print(" C | Lembap: ");
  Serial.print(lembap, 1);
  Serial.println(" %");

  // Pengganti virtualWrite Blynk: kirim JSON ke API website tiap 10 detik.
  if (WiFi.status() == WL_CONNECTED && millis() - kirimTerakhir >= 10000) {
    kirimTerakhir = millis();
    String t = "null";
    String h = "null";
    String p = "false";
    String f = "false";
    if (isnan(suhu) == false) t = String(suhu, 1);
    if (isnan(lembap) == false) h = String(lembap, 1);
    if (pompa == true) p = "true";
    if (rusak == true) f = "true";
    String data = "{\"soil_adc\":" + String(adc);
    data += ",\"temperature\":" + t + ",\"humidity\":" + h;
    data += ",\"pump_on\":" + p + ",\"pump_fault\":" + f;
    data += ",\"uptime_ms\":" + String(millis()) + "}";

    WiFiClientSecure client;
    client.setInsecure();     // demo: identitas server tidak diverifikasi
    HTTPClient http;
    http.setConnectTimeout(2000);
    http.setTimeout(2000);
    if (http.begin(client, API_URL)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
      int kode = http.POST(data);
      Serial.print("Website HTTP: ");
      Serial.println(kode);
    } else {
      Serial.println("Website: gagal membuka koneksi");
    }
    http.end();
  }
  // ponytail: HTTP masih blocking; gunakan task jaringan untuk pengaman presisi.
  delay(2000);
}

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

#define API_URL "https://smartplant.web.id/api/telemetry"
#define DEVICE_TOKEN  "GANTI_TOKEN_ACAK_MINIMAL_32_KARAKTER";
#define SOIL 34
#define DHT_22 4
#define RELAY 27
#define LED_BASAH 25
#define LED_KERING 32

char ssid[] = "NAMA_WIFI";
char pass[] = "PASSWORD";

const unsigned long DELAY_SOIL = 300000;   // baca & kirim tanah: 5 menit
const unsigned long DELAY_DHT = 300000;    // baca DHT22: 5 menit
const unsigned long DELAY_POMPA = 2000;    // saat pompa ON, cek tanah tiap 2 detik
const unsigned long BATAS_POMPA = 60000;   // pengaman: pompa maksimal menyala 60 detik

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
DHT dht(DHT_22, DHT22);
int adc = 0;
float suhu = 0, lembap = 0;
bool pompa = false;
bool pompaSebelumnya = false;   // untuk mendeteksi pompa ON/OFF berubah
bool rusak = false;             // true = pengaman aktif, pompa dikunci OFF sampai ESP32 direset
String kondisi = "LEMBAB";
unsigned long terakhirTanah = 0, terakhirDHT = 0, terakhirKirim = 0, mulaiPompa = 0;

// Baca tanah, atur pompa dan LED
void cekTanah() {
  adc = analogRead(SOIL);
  kondisi = "LEMBAB";
  if (adc >= 3200) kondisi = "KERING";
  if (adc <= 1100) kondisi = "BASAH";

  if (rusak == false) {
    if (kondisi == "KERING" && pompa == false) {   // pompa baru mau menyala
      pompa = true;
      mulaiPompa = millis();
    }
    if (kondisi == "BASAH") {
      pompa = false;
    }
    if (pompa && millis() - mulaiPompa >= BATAS_POMPA) {   // terlalu lama, tanah tidak kunjung basah
      pompa = false;
      rusak = true;
    }
  }
  if (rusak) kondisi = "CEK POMPA";

  digitalWrite(RELAY, pompa ? LOW : HIGH);   // relay aktif LOW
  digitalWrite(LED_BASAH, kondisi == "BASAH");
  digitalWrite(LED_KERING, kondisi == "KERING" || rusak);
  terakhirTanah = millis();
}

// Baca suhu dan kelembapan udara
void bacaDHT() {
  suhu = dht.readTemperature();
  lembap = dht.readHumidity();
  terakhirDHT = millis();
}

// Tampilkan data di OLED
void tampilOLED() {
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.printf("Suhu  : %.1f C\nLembap: %.1f %%\nPompa : %s", suhu, lembap, pompa ? "ON" : "OFF");
  oled.setTextSize(2);
  oled.setCursor(0, 36);
  oled.print(kondisi);
  oled.display();
}

// Kirim data JSON ke website
void kirimKeWebsite() {
  if (WiFi.status() != WL_CONNECTED) return;   // WiFi belum siap, coba lagi putaran berikutnya
  terakhirKirim = millis();
  String t = isnan(suhu) ? "null" : String(suhu, 1);
  String h = isnan(lembap) ? "null" : String(lembap, 1);
  String data = "{\"soil_adc\":" + String(adc) + ",\"temperature\":" + t + ",\"humidity\":" + h;
  data += ",\"pump_on\":" + String(pompa ? "true" : "false");
  data += ",\"pump_fault\":" + String(rusak ? "true" : "false");
  data += ",\"uptime_ms\":" + String(millis()) + "}";
  WiFiClientSecure client;
  client.setInsecure();   // demo: identitas server tidak diverifikasi
  HTTPClient http;
  http.setTimeout(2000);
  if (http.begin(client, API_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
    Serial.print("Website HTTP: ");
    Serial.println(http.POST(data));
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  digitalWrite(RELAY, HIGH);   // pompa mati sebelum pin jadi OUTPUT
  pinMode(RELAY, OUTPUT);
  pinMode(LED_BASAH, OUTPUT);
  pinMode(LED_KERING, OUTPUT);
  dht.begin();
  Wire.begin(21, 22);
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, pass);      // tidak ditunggu, supaya pompa tetap jalan
  cekTanah();                  // tanah dibaca dulu agar pompa langsung diatur
  pompaSebelumnya = pompa;
  delay(2000);                 // DHT22 butuh jeda 2 detik setelah menyala
  bacaDHT();
  tampilOLED();
  terakhirKirim = millis() - DELAY_SOIL;   // anggap sudah 5 menit, supaya kirim pertama langsung
}

void loop() {
  unsigned long sekarang = millis();

  bool perluBacaTanah = (sekarang - terakhirTanah >= DELAY_SOIL);
  if (pompa && sekarang - terakhirTanah >= DELAY_POMPA) perluBacaTanah = true;
  if (perluBacaTanah) {
    cekTanah();
    tampilOLED();
    Serial.printf("ADC: %d | %s | Pompa: %s\n", adc, kondisi.c_str(), pompa ? "ON" : "OFF");
    if (pompa != pompaSebelumnya) {   // pompa baru menyala / baru mati -> langsung lapor
      kirimKeWebsite();
      pompaSebelumnya = pompa;
    }
  }

  if (sekarang - terakhirDHT >= DELAY_DHT) {
    bacaDHT();
    tampilOLED();
  }

  if (sekarang - terakhirKirim >= DELAY_SOIL) {
    kirimKeWebsite();
  }

  delay(500);
}
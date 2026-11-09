#define BLYNK_TEMPLATE_ID "TMPL6HdXMH-0d"
#define BLYNK_TEMPLATE_NAME "Smart Plant"
#define BLYNK_AUTH_TOKEN "HjfO9-8ek1itc-Hm_ba9cVhRg_o0DGYm"

#include <WiFi.h>
#include <BlynkSimpleEsp32.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

#define SOIL   34
#define DHT_22 4
#define RELAY  27
#define LED_1  25   // LED BASAH
#define LED_2  32   // LED KERING

char ssid[] = "NAMA_WIFI";
char pass[] = "PASSWORD_WIFI";

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
DHT dht(DHT_22, DHT22);

void setup() {
  Serial.begin(115200);

  pinMode(RELAY, OUTPUT);
  pinMode(LED_1, OUTPUT);
  pinMode(LED_2, OUTPUT);

  digitalWrite(RELAY, HIGH);   // pompa mati
  digitalWrite(LED_1, LOW);
  digitalWrite(LED_2, LOW);

  dht.begin();
  Wire.begin(21, 22);
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);

  Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);
}

void loop() {
  Blynk.run();

  int adc = analogRead(SOIL);
  float suhu = dht.readTemperature();
  float lembap = dht.readHumidity();

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

  if (adc >= 3200) {
    // KERING
    digitalWrite(RELAY, LOW);    // pompa nyala
    digitalWrite(LED_2, HIGH);
    digitalWrite(LED_1, LOW);

    oled.setCursor(0, 16);
    oled.println("Pompa : ON");
    oled.setTextSize(3);
    oled.setCursor(0, 36);
    oled.println("KERING");

    Blynk.virtualWrite(V3, "KERING");
    Blynk.virtualWrite(V4, "ON");
  }
  else if (adc <= 1100) {
    // BASAH
    digitalWrite(RELAY, HIGH);   // pompa mati
    digitalWrite(LED_2, LOW);
    digitalWrite(LED_1, HIGH);

    oled.setCursor(0, 16);
    oled.println("Pompa : OFF");
    oled.setTextSize(3);
    oled.setCursor(0, 36);
    oled.println("BASAH");

    Blynk.virtualWrite(V3, "BASAH");
    Blynk.virtualWrite(V4, "OFF");
  }
  else {
    // LEMBAB
    digitalWrite(RELAY, LOW);   // pompa mati
    digitalWrite(LED_2, LOW);
    digitalWrite(LED_1, LOW);

    oled.setCursor(0, 16);
    oled.println("Pompa : OFF");
    oled.setTextSize(3);
    oled.setCursor(0, 36);
    oled.println("LEMBAB");

    Blynk.virtualWrite(V3, "LEMBAB");
    Blynk.virtualWrite(V4, "OFF");
  }

  oled.display();

  // Kirim ke Blynk
  Blynk.virtualWrite(V0, suhu);
  Blynk.virtualWrite(V1, lembap);
  Blynk.virtualWrite(V2, adc);

  Serial.print("ADC: ");
  Serial.print(adc);
  Serial.print(" | Suhu: ");
  Serial.print(suhu, 1);
  Serial.print(" C | Lembap: ");
  Serial.print(lembap, 1);
  Serial.println(" %");

  delay(2000);
}
# Sektor Notlari

Bu prototipin gercek bir IoT sistemiyle iliskisi ve egitim degeri uzerine notlar.
Bu dosya yalnizca dokumantasyon icin yazilmistir; **kod degisikligi onermez**.

## Bilesenler ve Karsiligi

### Sensor Katmani (`simulator.py`)
Gercek bir IoT sisteminde fiziksel sensorler (DHT22 sicaklik/nem, LDR isik,
MPU6050 ivmeolcer, akim sensoru) yer alir; bu sensorler bir mikrodenetleyici
(ESP32, Raspberry Pi Pico, Arduino) uzerinden okunur. Bu projede bu katman
saf bir Python fonksiyonu (`step`) ile temsil edilir; cihaz durumlarinin sensor
verisini "fiziksel" olarak nasil etkiledigini modeller.

### Backend (`app.py`, `state.py`)
Gercek IoT mimarisinde sensor verisi cogunlukla bir gateway veya buluttaki bir
servise (ornegin AWS IoT Core, Azure IoT Hub, ozel bir backend) akar; orada
state ve gecmis tutulur. Bu projede Flask sureci hem ag bilegi hem de durum
tutucu olarak ayni rolu kucuk olcekte oynar. `state.py` icindeki
`deque(maxlen=60)` mekanizmasi gercek sistemdeki time-series store'un (InfluxDB,
TimescaleDB, Prometheus) basitlestirilmis halidir.

### API (`routes.py`)
Gercek IoT urunleri genelde HTTP REST + WebSocket veya MQTT topic'leri ile
konusur. Bu projedeki REST endpoint'leri, gercek sistemdeki cihaz/data API'lerinin
kucuk bir aynasidir: `/api/data` -> "son durum"; `/api/history` -> "time-series
sorgusu"; `/api/control` -> "device shadow / desired state".

### Dashboard (`frontend/`)
Endustride Grafana, Home Assistant, ThingsBoard, kendi React/Vue
panellerine karsilik gelir. Bu projede tek HTML + Chart.js + saf JS ile
ayni isi temsili olarak yapar.

### ON/OFF Kontrol
Gercek sistemde "device shadow" veya "command/control topic" kavramina
karsilik gelir: kullanicinin istegi (desired state) bulutta yazilir, cihaz
bunu okuyup uygular ve raporlar (reported state). Bu projede istek dogrudan
ayni surecteki state'e yazilir; simulator bir sonraki tick'te onu uygular.

## Egitim / Prototip Degeri
- Uctan uca bir IoT akisini (sensor -> backend -> API -> dashboard -> kontrol)
  tek surec ve birkac yuz satir kod ile gosterir.
- Veri uretiminin saf fonksiyon olarak ayrilmasi sayesinde davranis test edilebilir.
- Thread-safe state ile senkronizasyon kavrami pratikte gosterilir.
- Frontend'in API ile nasil dustugu ve geri besleme dongusunun nasil kapandigi
  ogretici bir sekilde gorulebilir.

## Ileride Eklenebilecek Ama Su An Kapsam Disi Tutulan Konular
Asagidaki konular gercek bir IoT sistemine yaklasmak icin onemli olsa da bu
prototipin amaciyla ortusmedigi icin **uygulanmayacaktir**:
- MQTT (paho-mqtt + broker)
- WebSocket (push tabanli canli akis)
- Veritabani (InfluxDB, TimescaleDB, SQLite)
- Authentication (API key, JWT, OAuth)
- Docker / docker-compose ile paketleme
- Cloud deployment (AWS IoT Core, Azure IoT Hub, GCP IoT)
- Gercek cihaz baglantisi (ESP32 / Raspberry Pi)
- Anomali tespiti, alarm, bildirim sistemi

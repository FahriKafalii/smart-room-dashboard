# Sektör Notları

Bu prototipin gerçek bir IoT sistemiyle ilişkisi ve eğitim değeri üzerine
notlar. Bu dosya yalnızca dokümantasyon için yazılmıştır; **kod değişikliği
önermez**.

## Bileşenler ve Karşılığı

### Sensör Katmanı (`simulator.py`)
Gerçek bir IoT sisteminde fiziksel sensörler (DHT22 sıcaklık/nem, LDR ışık,
MPU6050 ivmeölçer, akım sensörü) yer alır; bu sensörler bir mikrodenetleyici
(ESP32, Raspberry Pi Pico, Arduino) üzerinden okunur. Bu projede bu katman
saf bir Python fonksiyonu (`step`) ile temsil edilir; cihaz durumlarının
sensör verisini "fiziksel" olarak nasıl etkilediğini modeller.

### Backend (`app.py`, `state.py`)
Gerçek IoT mimarisinde sensör verisi çoğunlukla bir gateway veya buluttaki
bir servise (örneğin AWS IoT Core, Azure IoT Hub, özel bir backend) akar;
orada state ve geçmiş tutulur. Bu projede Flask süreci hem ağ bileşeni hem
de durum tutucu olarak aynı rolü küçük ölçekte oynar. `state.py` içindeki
`deque(maxlen=60)` mekanizması gerçek sistemdeki time-series store'un
(InfluxDB, TimescaleDB, Prometheus) basitleştirilmiş halidir.

### API (`routes.py`)
Gerçek IoT ürünleri genelde HTTP REST + WebSocket veya MQTT topic'leri ile
konuşur. Bu projedeki REST endpoint'leri, gerçek sistemdeki cihaz/data
API'lerinin küçük bir aynasıdır: `/api/data` -> "son durum";
`/api/history` -> "time-series sorgusu"; `/api/control` -> "device shadow /
desired state".

### Dashboard (`frontend/`)
Endüstride Grafana, Home Assistant, ThingsBoard, kendi React/Vue
panellerine karşılık gelir. Bu projede tek HTML + Chart.js + saf JS ile
aynı işi temsili olarak yapar.

### ON/OFF Kontrol
Gerçek sistemde "device shadow" veya "command/control topic" kavramına
karşılık gelir: kullanıcının isteği (desired state) bulutta yazılır, cihaz
bunu okuyup uygular ve raporlar (reported state). Bu projede istek doğrudan
aynı süreçteki state'e yazılır; simulator bir sonraki tick'te onu uygular.

## Eğitim / Prototip Değeri
- Uçtan uca bir IoT akışını (sensör -> backend -> API -> dashboard -> kontrol)
  tek süreç ve birkaç yüz satır kod ile gösterir.
- Veri üretiminin saf fonksiyon olarak ayrılması sayesinde davranış test
  edilebilir.
- Thread-safe state ile senkronizasyon kavramı pratikte gösterilir.
- Frontend'in API ile nasıl konuştuğu ve geri besleme döngüsünün nasıl
  kapandığı öğretici bir şekilde görülebilir.

## İleride Eklenebilecek Ama Şu An Kapsam Dışı Tutulan Konular
Aşağıdaki konular gerçek bir IoT sistemine yaklaşmak için önemli olsa da bu
prototipin amacıyla örtüşmediği için **uygulanmayacaktır**:
- MQTT (paho-mqtt + broker)
- WebSocket (push tabanlı canlı akış)
- Veritabanı (InfluxDB, TimescaleDB, SQLite)
- Authentication (API key, JWT, OAuth)
- Docker / docker-compose ile paketleme
- Cloud deployment (AWS IoT Core, Azure IoT Hub, GCP IoT)
- Gerçek cihaz bağlantısı (ESP32 / Raspberry Pi)
- Anomali tespiti, alarm, bildirim sistemi

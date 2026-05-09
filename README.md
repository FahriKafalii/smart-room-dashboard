# Smart Room Dashboard

> Fiziksel donanım olmadan çalışan, gerçek zamanlı bir IoT sistemini baştan
> sona modelleyen prototip dashboard. Sensör üretimi, REST API, canlı
> grafiklerle web arayüzü ve cihaz kontrolünü tek süreç içinde sergiler.

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-4.4-FF6384?logo=chartdotjs&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Önizleme

![Dashboard](docs/screenshots/dashboard.png)

---

## Hakkında

Bu proje, IoT sistemlerini öğrenmek ve anlatmak için hazırlanmış bir
**referans uygulamadır**. Gerçek bir akıllı oda senaryosunu — sensör
okumaları, cihaz kontrolü, canlı izleme — fiziksel donanım ihtiyacı
olmadan, sadece Python ve modern web teknolojileriyle modellemeyi amaçlar.

5 sensör (sıcaklık, nem, enerji, ışık, titreşim) ve 4 cihaz (fan, heater,
light, motor) içerir. Cihaz durumları sensör okumalarını **fiziksel olarak
mantıklı** şekilde etkiler: heater açılınca sıcaklık tırmanır ve nem
düşer, motor açılınca titreşim sıçrar, light güneş eğrisinden de
beslenerek 800 lx hedefine yumuşakça ramp eder.

---

## Mimari

```
+----------------------+        +----------------------------+
|  Browser (UI)        |        |  Flask process :1453       |
|  HTML / CSS / JS     | <----> |  REST endpoints (routes)   |
|  Chart.js (CDN)      |        |  Thread-safe state (RLock) |
|  Live charts +       |        |  Simulator daemon thread   |
|  Time scrubber       |        |    (1 Hz tick)             |
+----------------------+        +----------------------------+
        ^                                    |
        |  GET /api/data (1 Hz polling)      |
        |  POST /api/control (toggle)        v
        +-------- HTTP / JSON --------> sensor_state
```

**Tek süreç, tek port, sıfır bağımlılık karmaşası.** Backend ana thread'i
HTTP isteklerini servis eder; daemon thread her saniye state'i günceller.
İki thread arası senkronizasyon `RLock` ile sağlanır — okuma ve yazma
sırasında race condition yok.

---

## Özellikler

### Backend
- 1 Hz tick periyoduyla **fiziksel olarak tutarlı sensör üretimi**
  (Clausius-Clapeyron yaklaşımı ile heater→nem düşümü, ambient drift,
  saat-bazlı güneş lümeni)
- Thread-safe state yönetimi (`threading.RLock`)
- 6 REST endpoint (health, data, history, control GET/POST, dashboard)
- Validation: hatalı cihaz/state isteklerine `400` + açıklayıcı JSON

### Frontend
- 5 metriği **iki Y ekseninde** tek grafikte gösterim (sıcaklık/nem/
  titreşim solda, enerji/ışık sağda)
- Chart.js Bezier yumuşatma (`tension: 0.55`) ile akışkan, kırılmasız çizgi
- 30 fps render döngüsü — backend 1 Hz olsa bile grafik akışkan akar
- **Eşik bazlı uyarı sistemi**: yanıp sönen ikon + özel CSS tooltip
- **Slider scrubber**: son 30 dakikalık veride geçmişe dönüş
- iOS-tarzı switch ile cihaz kontrolü, anlık UI feedback
- Responsive tasarım (mobil/tablet/desktop)

### Sektör karşılığı
- Home Assistant tarzı smart-home dashboard'larının minimal versiyonu
- SCADA / endüstriyel görüntüleme sistemlerinin eğitim modeli
- Predictive maintenance (titreşim tabanlı) için başlangıç noktası

---

## Cihaz Davranış Matrisi

| Cihaz   | Sıcaklık | Nem      | Işık | Titreşim | Enerji  |
|---------|----------|----------|------|----------|---------|
| Heater  | ↑↑↑      | ↓↓       | —    | —        | +1500W  |
| Fan     | —        | denge ↑↑ | —    | —        | +50W    |
| Light   | ↑ (cüzi) | —        | ↑↑↑  | —        | +12W    |
| Motor   | ↑ (cüzi) | —        | —    | ↑↑↑      | +100W   |

**Önemli noktalar:**
- **Fan tek başına sıcaklığı DÜŞÜRMEZ** (gerçek fizik: fan havayı
  karıştırır, soğutmaz). Sadece dengeleme hızını 2× yapar.
- **Heater + Fan birlikte ısınmayı sürdürür** — fan iptal etmez.
- **Tüm OFF**: değerler 22 °C / %50 RH ortam dengesine döner.

---

## Uyarı Eşikleri

| Metrik     | Uyarı (sarı) | Kritik (kırmızı) | Sensör sınırları |
|------------|--------------|------------------|------------------|
| Sıcaklık   | ≥38 / ≤14 °C | ≥42 / ≤11 °C    | 10–45 °C         |
| Nem        | ≥80 / ≤28 %  | ≥87 / ≤23 %     | 20–90 %          |
| Enerji     | ≥1500 W      | ≥1700 W         | (max ~1667 W)    |
| Işık       | ≥950 lx      | ≥990 lx         | 0–1000 lx        |
| Titreşim   | ≥3.5 g       | ≥4.5 g          | 0–5 g (ISO 10816)|

Eşikler aşılınca kart sağ-üst köşesinde **yanıp sönen ikon** belirir.
Üzerine gelince özel tooltip ile açıklama + öneri gösterilir.

---

## Kurulum

```bash
git clone https://github.com/FahriKafalii/smart-room-dashboard.git
cd smart-room-dashboard

python -m venv venv
# Windows
venv\Scripts\activate
# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
```

## Çalıştırma

```bash
python -m backend
```

Tarayıcı: **http://localhost:1453**

---

## REST API

| Method | Endpoint        | Açıklama                                          |
|--------|-----------------|---------------------------------------------------|
| GET    | `/`             | Dashboard HTML                                    |
| GET    | `/api/health`   | Sağlık kontrolü                                   |
| GET    | `/api/data`     | Anlık sensör verisi + cihaz durumları             |
| GET    | `/api/history`  | Son 60 sensör okuması                             |
| GET    | `/api/control`  | Mevcut cihaz durumları                            |
| POST   | `/api/control`  | `{ "device": "heater", "state": "ON\|OFF" }`     |

**Örnek:**

```bash
curl http://localhost:1453/api/data
curl -X POST http://localhost:1453/api/control \
     -H "Content-Type: application/json" \
     -d '{"device":"heater","state":"ON"}'
```

Hatalı istekler `400` + `{"error": "..."}` döner.

---

## Proje Yapısı

```
.
├── backend/
│   ├── __main__.py     # python -m backend giriş noktası
│   ├── app.py          # Flask app fabrikası
│   ├── routes.py       # 6 REST endpoint
│   ├── simulator.py    # Sensör üretimi + 1 Hz daemon
│   └── state.py        # Thread-safe global state
├── frontend/
│   ├── index.html      # Tek sayfalık dashboard
│   ├── style.css       # Modern, responsive, koyu tema
│   └── script.js       # Chart.js + akışkan render + uyarı motoru
├── docs/
│   ├── architecture.md
│   ├── sector_notes.md
│   └── screenshots/
├── requirements.txt
└── README.md
```

---

## Teknik Detaylar

**Neden çift Y ekseni?** Sıcaklık 22 °C ve enerji 1500 W aynı grafikte tek
eksende gösterilirse sıcaklık değeri ezilir. Çift eksen ile her metrik
kendi ölçeğinde okunabilir.

**Neden EMA yumuşatma var, ama light/vibration için BYPASS?** Sensör
verisi ham haliyle titrek olur. EMA (α=0.45) bunu dengeli yumuşatır.
Ancak `light_level` ve `vibration` zaten step-function davranış
göstermesi gereken metriklerdir (lamba açılır-açılmaz tam parlaklık,
motor çalışınca anlık titreşim) — bu nedenle EMA bypass edilir.

**Neden 30 fps render?** Backend 1 Hz veri üretiyor olsa bile, X
ekseninin akışkan kayması için frontend 30 fps'de yeniden çizer.
Böylece grafik "kare-kare" gitmez, su gibi akar.

**Neden RLock?** İki thread (HTTP request + simulator) aynı state'e yazıp
okur. Standart `Lock` yerine `RLock` (reentrant) tercih edildi — aynı
thread içinde lock'u tekrar alabilir, deadlock riskini azaltır.

---

## Scope

**Dahil:** Sensör simülasyonu, REST API, dashboard, cihaz kontrolü, canlı
grafikler, uyarı sistemi, time scrubber.

**Dışarıda bırakılan (kapsam dışı):**
- Authentication / kullanıcı yönetimi
- Veritabanı persistence (process restart sonrası history silinir)
- MQTT / WebSocket (push protokolü yerine 1 Hz polling)
- Docker / cloud deployment
- Gerçek donanım bağlantısı
- AI/ML, anomali tespiti, bildirim sistemi

Bu kapsam dışı maddeler **bilinçli** seçimlerdir; prototipin eğitim/demo
amacını bulandırmamak için hariçte tutulmuştur.

---

## Lisans

MIT

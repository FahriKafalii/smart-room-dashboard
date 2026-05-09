# Mimari

## Sistem Bileşenleri
- **Simulator** (`backend/simulator.py`): Bir arka plan thread'inde her saniye
  tick atan veri üreteci. Mevcut sensör değerlerini ve cihaz durumlarını okuyup
  yeni bir sensör okuması üretir, history'e ekler.
- **State** (`backend/state.py`): Tüm sensör verisi, cihaz durumları ve son N
  okumayı tutan thread-safe global durum. `RLock` ile korunur, `deque(maxlen=60)`
  ile history.
- **Routes** (`backend/routes.py`): Flask blueprint, REST API endpoint'leri ve
  statik frontend dosyalarını servis eder.
- **App** (`backend/app.py`): Flask app fabrikası. Simulator'ı başlatıp
  blueprint'i bağlar. `python -m backend` ile doğrudan çalışır.
- **Frontend** (`frontend/`): Tek sayfalık HTML / CSS / JS. Chart.js CDN'den
  yüklenir, API ile doğrudan konuşur.

## Veri Akışı
```
[Simulator thread] --tick (1s)--> [state] --GET /api/data--> [Frontend]
                                     ^                            |
                                     |                            |
                              [POST /api/control] <-- ON/OFF buton
```

1. `SimulationLoop` thread'i her 1 sn'de `simulator.tick()` çağırır.
2. `tick()` mevcut state'ten sensör + cihaz okur, yeni okuma hesaplar,
   `state.update_data` ile atomik olarak yazar (lock altında) ve history'e
   iter.
3. Frontend her 1 sn'de `GET /api/data` çağırır, son durumu kartlara ve
   grafiğe basar.
4. Kullanıcı ON/OFF butonuna bastığında frontend `POST /api/control` ile cihaz
   durumunu değiştirir; simulator bir sonraki tick'te yeni davranışla
   çalışmaya başlar.

## API Akışı
| Method | Path           | Açıklama                                      |
|--------|----------------|-----------------------------------------------|
| GET    | /              | Dashboard HTML                                |
| GET    | /api/health    | `{status, message}`                           |
| GET    | /api/data      | `{data: {...}, devices: {...}}` anlık durum  |
| GET    | /api/history   | `{history: [...]}` son N sensör okuması       |
| GET    | /api/control   | `{devices: {...}}` mevcut cihaz durumları     |
| POST   | /api/control   | `{device, state}` -> 200 / 400                |

## ON/OFF Komut Akışı
1. Kullanıcı `Fan ON` butonuna basar.
2. Frontend: `fetch("/api/control", {method:"POST", body: {device:"fan", state:"ON"}})`.
3. `routes.control` body'i validate eder. Eksik alan veya geçersiz cihaz/state
   400 döner.
4. Geçerliyse `state.set_device("fan", "ON")` (lock altında) yazar, yeni
   `devices` bloğu ile cevap döner.
5. Frontend cevabı alır, butonları ve durum rozetlerini günceller.
6. Bir sonraki simulator tick'inde fan ON olduğu için ortam dengelemesi
   hızlanır.

## Localhost Konumlandırma
- Tek süreç, tek port: Flask geliştirme sunucusu `0.0.0.0:1453` dinler.
  Tarayıcı `http://localhost:1453` ile bağlanır.
- Ayrı bir simulator süreç yok; simulator aynı Python süreci içinde bir
  daemon thread.
- Statik dosyalar (`index.html`, `style.css`, `script.js`) aynı Flask
  uygulaması tarafından `/<path:path>` route'undan servis edilir; CORS
  gerekmez.

## Thread / Simulation Loop Mantığı
- `simulator.SimulationLoop(Thread)` `daemon=True` ile başlar; ana süreç
  kapanınca birlikte sonlanır.
- Her tick'te:
  1. `state.get_data()` ve `state.get_devices()` lock altında okunur.
  2. Yeni okuma `step(...)` ile saf fonksiyonel hesaplanır (test edilebilir).
  3. `state.update_data(new)` lock altında yazar ve history'e ekler.
  4. `time.sleep(1.0)`.

## Basit Mimari Şema
```
+----------------------+        +-----------------------+
|  Frontend (browser)  |        |  Flask process :1453  |
|  index/style/script  | <----> |  routes (REST + html) |
|  Chart.js (CDN)      |        |        |              |
+----------------------+        |        v              |
                                |  state (RLock)        |
                                |        ^              |
                                |        |              |
                                |  simulator thread     |
                                +-----------------------+
```

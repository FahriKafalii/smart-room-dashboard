# Mimari

## Sistem Bilesenleri
- **Simulator** (`backend/simulator.py`): Bir arka plan thread'inde her saniye
  tick atan veri ureteci. Mevcut sensor degerlerini ve cihaz durumlarini okuyup
  yeni bir sensor okumasi uretir, history'e ekler.
- **State** (`backend/state.py`): Tum sensor verisi, cihaz durumlari ve son N
  okumayi tutan thread-safe global durum. `RLock` ile korunur, `deque(maxlen=60)`
  ile history.
- **Routes** (`backend/routes.py`): Flask blueprint, REST API endpoint'leri ve
  statik frontend dosyalarini servis eder.
- **App** (`backend/app.py`): Flask app fabrikasi. Simulator'i baslatip blueprint'i
  baglar. `python backend/app.py` ile dogrudan calisir.
- **Frontend** (`frontend/`): Tek sayfalik HTML / CSS / JS. Chart.js CDN'den
  yuklenir, API ile dogrudan konusur.

## Veri Akisi
```
[Simulator thread] --tick (1s)--> [state] --GET /api/data--> [Frontend]
                                     ^                            |
                                     |                            |
                              [POST /api/control] <-- ON/OFF buton
```

1. `SimulationLoop` thread'i her 1 sn'de `simulator.tick()` cagirir.
2. `tick()` mevcut state'ten sensor + cihaz okur, yeni okuma hesaplar, `state.update_data` ile
   atomik olarak yazar (lock altinda) ve history'e itistirir.
3. Frontend her 1 sn'de `GET /api/data` cagirir, son durumu kartlara ve grafige basar.
4. Kullanici ON/OFF butonuna bastiginda frontend `POST /api/control` ile cihaz
   durumunu degistirir; simulator bir sonraki tick'te yeni davranisla calismaya baslar.

## API Akisi
| Method | Path           | Aciklama                                      |
|--------|----------------|-----------------------------------------------|
| GET    | /              | Dashboard HTML                                |
| GET    | /api/health    | `{status, message}`                           |
| GET    | /api/data      | `{data: {...}, devices: {...}}` anlik durum   |
| GET    | /api/history   | `{history: [...]}` son N sensor okumasi       |
| GET    | /api/control   | `{devices: {...}}` mevcut cihaz durumlari     |
| POST   | /api/control   | `{device, state}` -> 200 / 400                |

## ON/OFF Komut Akisi
1. Kullanici `Fan ON` butonuna basar.
2. Frontend: `fetch("/api/control", {method:"POST", body: {device:"fan", state:"ON"}})`.
3. `routes.control` body'i validate eder. Eksik alan veya gecersiz cihaz/state 400 doner.
4. Gecerliyse `state.set_device("fan", "ON")` (lock altinda) yazar, yeni `devices` bloku ile cevap doner.
5. Frontend cevabi alir, butonlari ve durum rozetlerini gunceller.
6. Bir sonraki simulator tick'inde fan ON oldugu icin sicaklik / nem dusus egiliminde olur.

## Localhost Konumlandirma
- Tek surec, tek port: Flask geliştirme sunucusu `0.0.0.0:5000` dinler. Tarayici
  `http://localhost:5000` ile baglanir.
- Ayri bir simulator surec yok; simulator ayni Python sureci icinde bir daemon thread.
- Statik dosyalar (`index.html`, `style.css`, `script.js`) ayni Flask uygulamasi
  tarafindan `/<path:path>` route'undan servis edilir; CORS gerekmez.

## Thread / Simulation Loop Mantigi
- `simulator.SimulationLoop(Thread)` `daemon=True` ile baslar; ana surec kapaninca
  birlikte sonlanir.
- Her tick'te:
  1. `state.get_data()` ve `state.get_devices()` lock altinda okunur.
  2. Yeni okuma `step(...)` ile saf fonksiyonel hesaplanir (test edilebilir).
  3. `state.update_data(new)` lock altinda yazar ve history'e ekler.
  4. `time.sleep(1.0)`.

## Basit Mimari Sema
```
+----------------------+        +-----------------------+
|  Frontend (browser)  |        |  Flask process :5000  |
|  index/style/script  | <----> |  routes (REST + html) |
|  Chart.js (CDN)      |        |        |              |
+----------------------+        |        v              |
                                |  state (RLock)        |
                                |        ^              |
                                |        |              |
                                |  simulator thread     |
                                +-----------------------+
```

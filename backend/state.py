from collections import deque
from threading import RLock

VALID_DEVICES = ("fan", "heater", "light", "motor")
VALID_STATES = ("ON", "OFF")
HISTORY_SIZE = 60

_lock = RLock()

_devices = {d: "OFF" for d in VALID_DEVICES}

_data = {
    "temperature": 22.0,
    "humidity": 50.0,
    "energy": 0.0,
    "light_level": 100,
    "vibration": 0.0,
    "timestamp": "00:00:00",
}

_history = deque(maxlen=HISTORY_SIZE)


def get_devices():
    with _lock:
        return dict(_devices)


def set_device(device, state):
    if device not in VALID_DEVICES:
        return False, f"Gecersiz cihaz: {device}"
    if state not in VALID_STATES:
        return False, f"Gecersiz state: {state}"
    with _lock:
        _devices[device] = state
    return True, "OK"


def get_data():
    with _lock:
        return dict(_data)


def update_data(new_data):
    with _lock:
        _data.update(new_data)
        _history.append(dict(_data))


def get_history():
    with _lock:
        return list(_history)


def reset():
    with _lock:
        for d in VALID_DEVICES:
            _devices[d] = "OFF"
        _data.update({
            "temperature": 22.0,
            "humidity": 50.0,
            "energy": 0.0,
            "light_level": 100,
            "vibration": 0.0,
            "timestamp": "00:00:00",
        })
        _history.clear()

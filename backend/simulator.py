import math
import random
import time
from threading import Thread

from . import state

TEMP_MIN, TEMP_MAX = 10.0, 45.0
HUM_MIN, HUM_MAX = 20.0, 90.0
LIGHT_MIN, LIGHT_MAX = 0, 1000
VIB_MIN, VIB_MAX = 0.0, 5.0
TEMP_AMBIENT = 22.0
HUM_AMBIENT = 50.0
ENERGY_BASE = 5.0
ENERGY_PER_DEVICE = {"fan": 50.0, "heater": 1500.0, "light": 12.0, "motor": 100.0}

LIGHT_LAMP_TARGET = 800
LIGHT_RAMP = 0.35


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def sun_lux(now=None):
    t = now if now is not None else time.time()
    hour = (time.localtime(t).tm_hour + time.localtime(t).tm_min / 60.0)
    angle = math.pi * (hour - 6.0) / 12.0
    if angle <= 0 or angle >= math.pi:
        return 5.0
    return 600.0 * math.sin(angle)


def step(current, devices, now=None):
    temp = current["temperature"]
    hum = current["humidity"]
    light = current["light_level"]

    delta_t = 0.0
    if devices["heater"] == "ON":
        delta_t += random.uniform(0.18, 0.32)
    if devices["light"] == "ON":
        delta_t += random.uniform(0.005, 0.020)
    if devices["motor"] == "ON":
        delta_t += random.uniform(0.010, 0.025)

    if devices["heater"] == "ON":
        drift = (TEMP_AMBIENT - temp) * 0.005
    else:
        drift = (TEMP_AMBIENT - temp) * 0.05

    fan_buffer = 0.0
    if devices["fan"] == "ON" and devices["heater"] == "ON":
        fan_buffer = -random.uniform(0.0, 0.05)
    temp += delta_t + drift + fan_buffer + random.uniform(-0.05, 0.05)

    if devices["heater"] == "ON":
        hum -= random.uniform(0.30, 0.60)
    drift_h_speed = 0.08 if devices["fan"] == "ON" else 0.04
    hum += (HUM_AMBIENT - hum) * drift_h_speed + random.uniform(-0.15, 0.15)

    sun = sun_lux(now)
    target_light = sun + (LIGHT_LAMP_TARGET if devices["light"] == "ON" else 0)
    light = light + (target_light - light) * LIGHT_RAMP + random.uniform(-3.0, 3.0)

    if devices["motor"] == "ON":
        vib = 2.5 + random.uniform(-0.4, 0.6)
    else:
        vib = random.uniform(0.0, 0.05)

    energy = ENERGY_BASE
    for d, on_cost in ENERGY_PER_DEVICE.items():
        if devices[d] == "ON":
            energy += on_cost
    energy += random.uniform(-3.0, 3.0)
    energy = max(0.0, energy)

    timestamp = time.strftime("%H:%M:%S", time.localtime(now)) if now else time.strftime("%H:%M:%S")

    return {
        "temperature": round(_clamp(temp, TEMP_MIN, TEMP_MAX), 2),
        "humidity": round(_clamp(hum, HUM_MIN, HUM_MAX), 2),
        "energy": round(energy, 2),
        "light_level": int(_clamp(light, LIGHT_MIN, LIGHT_MAX)),
        "vibration": round(vib, 3),
        "timestamp": timestamp,
    }


def tick():
    new = step(state.get_data(), state.get_devices())
    state.update_data(new)
    return new


class SimulationLoop(Thread):
    def __init__(self, interval=1.0):
        super().__init__(daemon=True)
        self.interval = interval
        self._stop = False

    def stop(self):
        self._stop = True

    def run(self):
        while not self._stop:
            tick()
            time.sleep(self.interval)


_loop = None


def start(interval=1.0):
    global _loop
    if _loop is None or not _loop.is_alive():
        _loop = SimulationLoop(interval=interval)
        _loop.start()
    return _loop


def stop():
    global _loop
    if _loop is not None:
        _loop.stop()
        _loop = None

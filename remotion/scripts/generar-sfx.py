"""Genera los efectos de sonido de la serie (sin licencias de terceros).

    python3 scripts/generar-sfx.py   →  public/audio/sfx/*.wav
"""
import pathlib
import wave

import numpy as np

SR = 44100
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "audio" / "sfx"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


def save(name, x, gain=0.8):
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    data = (x * 32767).astype(np.int16)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def t(sec):
    return np.linspace(0, sec, int(SR * sec), endpoint=False)


def lowpass(x, alpha):
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha[i] * (v - acc) if hasattr(alpha, "__len__") else alpha * (v - acc)
        y[i] = acc
    return y


# Whoosh: ruido filtrado que abre y cierra (cambio de capítulo)
d = 0.55
tt = t(d)
env = np.sin(np.pi * tt / d) ** 2
alpha = 0.02 + 0.25 * np.sin(np.pi * tt / d)
save("whoosh", lowpass(rng.standard_normal(len(tt)), alpha) * env, gain=0.55)

# Pop: burbuja corta (aparece tarjeta o insignia)
d = 0.14
tt = t(d)
freq = 520 + 900 * np.exp(-tt * 40)
pop = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-tt * 28)
save("pop", pop, gain=0.6)

# Tic: tecla suave (texto que se escribe)
d = 0.035
tt = t(d)
tic = (rng.standard_normal(len(tt)) * 0.4 + np.sin(2 * np.pi * 2400 * tt)) * np.exp(-tt * 180)
save("tic", tic, gain=0.35)

# Campanita: logro (dos notas)
d = 1.1
tt = t(d)
ding = np.zeros_like(tt)
for f0, start in ((1318.5, 0.0), (1975.5, 0.09)):
    m = tt >= start
    tm = tt[m] - start
    ding[m] += (np.sin(2 * np.pi * f0 * tm) + 0.3 * np.sin(2 * np.pi * f0 * 2 * tm)) * np.exp(-tm * 4.5)
save("campanita", ding, gain=0.45)

print("SFX listos en", OUT)

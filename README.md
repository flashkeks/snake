# 🐍 Multiplayer Snake

Snake fuer mehrere Spieler im Browser, mit Kopf-an-Kopf-Duellen im
CS:GO-Case-Opening-Stil, Mystery-Boxen, Double or Nothing, Chat und
ewiger Bestenliste. Ein Node-Prozess (`server.js`, nur `ws` als Abhaengigkeit)
liefert die Seite aus und spricht per WebSocket mit den Browsern.

Live: `snake.flashkeks.com` (Cloudflare Worker vor `calibre.michaffs.com/game/`).

## Betrieb

Laeuft im linuxserver-Calibre-Container:

| Was | Wo |
|---|---|
| Checkout | `/config/snake` (Branch `dev`) |
| Prozess | `node /config/snake/server.js` auf `127.0.0.1:3000` |
| Start | s6-Dienst `custom-svc-snake` (`/custom-services.d/snake`), startet nach `pkill` von selbst neu |
| Von aussen | Pfad `/game/` und WebSocket `/game/ws` (der Reverse Proxy schneidet `/game` ab) |
| Bestenliste | `/config/snake/highscores.json`, nicht im Repo |

**Update ausrollen:**

```sh
cd /config/snake && ./deploy.sh
```

`deploy.sh` macht `git pull`, zieht `npm install` nur bei Bedarf nach, prueft
die Syntax, startet den Dienst per `pkill` neu und meldet, ob er wieder laeuft.

## Spielregeln

- Steuerung: WASD / Pfeiltasten, am Handy wischen. Enter oeffnet den Chat.
- Rand: Wrap-around, man kommt gegenueber wieder raus.
- **Tod:** Kopf in fremden oder eigenen Koerper. Respawn sofort mit Laenge 6.
- **Kill:** Der Killer waechst um die halbe Laenge des Opfers (aufgerundet).
- **Kopf an Kopf:** Der Server wuerfelt den Gewinner aus. Alle sehen die
  Walze, die Beteiligten frieren 4,5 s ein und sind in der Zeit massiv.
- **Tempo:** Server-Tick 60 ms. Normal ein Schritt je 2 Ticks, Turbo je Tick,
  Schnecke je 4.

## Items

| Item | Anzahl | Wirkung |
|---|---|---|
| 🍎 Apfel | 4 | +1 |
| ❓ Mystery-Box | 4, Nachschub nach 3–6 s | kleine Walze nur beim Finder, Wirkung nach 1,6 s |
| 🪙 Muenze | bis 2, alle 8–15 s eine | Double or Nothing, grosse Walze **nur beim Spieler selbst** |

Wer die Muenze nimmt, friert fuer 4,5 s ein und ist fuer die anderen nur ein
blinkender Schatten: keine Kollision, niemand kann in ihn reinfahren. Danach
hat er 1,5 s Geist-Schutz, falls gerade jemand durch ihn durchfaehrt.

**Muenze** (`COIN_OUTCOMES`): ÷2 38 %, ×2 40 %, ×3 10 %, ×5 5 %, ×10 2 %, 💀 5 %.
Nachgeprueft am 22.09.2026 mit 10^6 Wuerfen: die Verteilung stimmt. ×10 bleibt
bei 2 % (Entscheidung Max), auch wenn 100 Muenzen ohne ×10 in 13 % der Faelle
vorkommen.

**Box** (`BOX_OUTCOMES`, Gewichte relativ):

| Seltenheit | Ergebnisse |
|---|---|
| blau | ⚡ Turbo 8 s, 🛡️ Schild (ein Treffer, 15 s), 🍄 +5, 🍎 Apfelregen (8 Extra-Aepfel), 🌀 Teleport |
| lila | 👻 Geist 6 s, 🧲 Magnet 10 s (zieht Items im Umkreis 7 an), 🫥 Unsichtbar 7 s, 🐢 Zeitlupe fuer alle anderen 5 s |
| pink | 🔀 Laengentausch mit Zufallsgegner, 💥 Schockwelle (halbiert alle im Umkreis 6), 🧊 Eisblock (friert einen Gegner 3 s ein) |
| rot | 🤏 Diebstahl (je 3 Laenge von allen) |
| gold ★ | ⭐ Stern 6 s (unverwundbar, gewinnt jedes Kopf-an-Kopf ohne Walze), 💎 Jackpot +12 |
| Nieten | 🐌 Schnecke 6 s, 🔄 Verdreht 6 s, ✂️ Halbiert, 💀 Pech (sofort tot) |

Die Seltenheitsfarben der Kacheln folgen CS:GO: grau, blau, lila, pink, rot,
Gold mit Glanz-Animation.

## Drumherum

- **Namensmenue** vor dem ersten Zug. Der Name bleibt im Browser gespeichert.
  Doppelte Namen im laufenden Spiel bekommen eine Nummer.
- **Bestenliste:** laengste Schlange und Kills je Name, Top 10, wird alle 5 s
  gespeichert (atomar ueber `.tmp` + rename). Kein Login, der Name ist die
  Identitaet.
- **Chat** rechts: 200 Zeichen, eine Nachricht je 600 ms, die letzten 50
  bekommt jeder beim Verbinden.
- **Killfeed** oben rechts mit Streak-Ansagen (DOPPELKILL, TRIPLEKILL,
  RAMPAGE, GODLIKE) und Gold-Zeilen fuer ★-Treffer.

## Protokoll (WebSocket)

Client → Server: `join {name}`, `direction {direction}`, `chat {text}`.

Server → Client: `welcome`, `joined`, `state` (alle 60 ms: Spieler, Items,
Effekte mit Restzeit), `duel`, `gamble`, `box`, `feed`, `died`, `chat`,
`chatlog`, `highscores`.

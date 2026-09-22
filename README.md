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
  Schnecke je 3 (bis 22.09.2026 je 4, war Max zu zaeh).
- **Laenge:** hoechstens 600 (`MAX_LEN`). Das Feld hat 1600 Zellen, und jedes
  Segment geht 16-mal pro Sekunde an jeden Browser.
- **Effekt-Timer ruhen**, solange man eingefroren ist (Muenzwurf, Duell). Beim
  Auftauen wird alles, was noch lief, um die Standzeit verlaengert (`resumeFx`).

## Items

| Item | Anzahl | Wirkung |
|---|---|---|
| Frucht | 8 | 🍎 +1 (50), 🍌 +2 (24), 🍇 +3 (14), 🍉 +5 (8), 🍒 +10 (3), 🥭 +20 (1) — Gewichte in Klammern, ab +10 mit Aura und Feed-Zeile |
| ❓ Mystery-Box | 4, Nachschub nach 3–6 s | kleine Walze nur beim Finder, Wirkung nach 1,6 s |
| 🪙 Muenze | bis 2, alle 8–15 s eine | Double or Nothing, grosse Walze **nur beim Spieler selbst** |

Wer die Muenze nimmt, friert fuer 4,5 s ein und ist fuer die anderen nur ein
blinkender Schatten: keine Kollision, niemand kann in ihn reinfahren. Danach
hat er 1,5 s Geist-Schutz, falls gerade jemand durch ihn durchfaehrt.

**Muenze** (`COIN_OUTCOMES`, Gewichte relativ, Summe 101,2): ÷2 38, ×2 40,
×3 10, ×5 5, ×10 2, ×20 0,8, ×50 0,3, ×100 0,1, 💀 5. Also ×10 knapp 2 %,
×100 etwa 1 zu 1000. ×50 und ×100 haben die Seltenheit `mythic` (Regenbogen).
Ab ×10 leuchtet der Gewinner 8 s lang fuer alle (Gold/Weiss/Regenbogen,
pulsierende Ringe), und bei allen erscheint ein Banner.
Nachgeprueft am 22.09.2026 mit 10^6 Wuerfen: die Verteilung stimmt. ×10 bleibt
bei 2 % (Entscheidung Max), auch wenn 100 Muenzen ohne ×10 in 13 % der Faelle
vorkommen.

**Box** (`BOX_OUTCOMES`, Gewichte relativ):

| Seltenheit | Ergebnisse |
|---|---|
| blau | ⚡ Turbo 8 s, 🛡️ Schild (ein Treffer, 15 s), 🍄 +5, 🍉 Obstregen (8 Extra-Fruechte), 🌀 Teleport |
| lila | 👻 Geist 6 s, 🧲 Magnet 10 s (zieht Items im Umkreis 7 an), 🫥 Unsichtbar 7 s, 🐢 Zeitlupe fuer alle anderen 3 s |
| pink | 🔀 Laengentausch mit Zufallsgegner, 💥 Schockwelle (halbiert alle im Umkreis 6), 🧊 Eisblock (friert einen Gegner 3 s ein) |
| rot | 🤏 Diebstahl (je 3 Laenge von allen) |
| gold ★ | ⭐ Stern 6 s (unverwundbar, gewinnt jedes Kopf-an-Kopf ohne Walze), 💎 Jackpot +12 |
| Nieten | 🐌 Schnecke 4 s, 🔄 Verdreht 6 s, ✂️ Halbiert, 💀 Pech (sofort tot) |

Die Seltenheitsfarben der Kacheln folgen CS:GO: grau, blau, lila, pink, rot,
Gold mit Glanz-Animation.

## Drumherum

- **Namensmenue** vor dem ersten Zug, mit Farbwahl (zwoelf Vorgaben oder frei).
  Name und Farbe bleiben im Browser gespeichert. Doppelte Namen im laufenden
  Spiel bekommen eine Nummer. Zu dunkle Farben (Luminanz unter 0,2) lehnt der
  Server ab und vergibt eine freie aus der Palette.
- **Layout:** links die eigenen Box-Walzen (eine je Box, auch bei zwei
  gleichzeitig) und der Feed, Mitte das Feld, rechts Rangliste, Bestenliste,
  Chat. Unter 1180 px Breite rutscht alles untereinander.
- **Bestenliste:** laengste Schlange und Kills je Name, Top 10, wird alle 5 s
  gespeichert (atomar ueber `.tmp` + rename). Kein Login, der Name ist die
  Identitaet.
- **Chat** rechts: 200 Zeichen, eine Nachricht je 600 ms, die letzten 50
  bekommt jeder beim Verbinden.
- **Feed** in der linken Spalte, neueste oben, mit Streak-Ansagen (DOPPELKILL, TRIPLEKILL,
  RAMPAGE, GODLIKE) und Gold-Zeilen fuer ★-Treffer.

## Protokoll (WebSocket)

Client → Server: `join {name}`, `direction {direction}`, `chat {text}`.

Server → Client: `welcome`, `joined`, `state` (alle 60 ms: Spieler, Items,
Effekte mit Restzeit), `duel`, `gamble`, `box`, `feed`, `died`, `chat`,
`chatlog`, `highscores`.

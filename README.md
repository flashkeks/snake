# 🍪 Kek Minigames

Derzeit ein Spiel: Multiplayer-Snake im Browser, mit Kopf-an-Kopf-Duellen im
CS:GO-Case-Opening-Stil, Mystery-Boxen, Double or Nothing, Konten, Coins,
Cashout und einem Slot-Automaten. Ein Node-Prozess (`server.js`, nur `ws` als
Abhaengigkeit) liefert die Seite aus und spricht per WebSocket mit den
Browsern.

Live: **`snake.flashkeks.com`** auf `edge` (Netcup).

## Dateien

| Datei | Inhalt |
|---|---|
| `server.js` | HTTP + WebSocket, Spiel-Tick, Items, Duelle, Cashout |
| `accounts.js` | Konten, Sessions, Coins, Statistik (JSON-Datei im Datenordner) |
| `slots.js` | Slot-Automat „Slots“ (frueher „Kek Slots“); `node slots.js` rechnet die Rueckzahlungsquote aus |
| `slots2.js` | Tumble-Slot „Budget Starlight“ (frueher „Sweet Kek“, intern weiter `s2`/`spin2`); `node slots2.js N` simuliert grob Rueckzahlung, Bonus-Quote, Bonus-Kauf (zum Abstimmen siehe unten) |
| `events.js` | Mini-Events (Flag Quiz, Roulette, Blackjack): Ablauf, Einsaetze, Auszahlung |
| `flags.js` | Laender fuer das Flag Quiz (ISO-Code + englischer Name) |
| `public/index.html` | der ganze Browser-Teil in einer Datei |
| `deploy.sh` | auf `edge`: pull, npm bei Bedarf, Syntaxcheck, Dienst neu starten |

## Betrieb auf edge

| Was | Wo |
|---|---|
| Checkout | `/srv/snake` (Branch `dev`), gehoert `deploy` |
| Daten | `/srv/snake-data/accounts.json` (Modus 600), **nicht** im Repo |
| Dienst | systemd `snake.service`, User `deploy`, `PORT=3100`, `DATA_DIR=/srv/snake-data` |
| Prozess | `node /srv/snake/server.js` auf `127.0.0.1:3100` |
| Caddy | `:8097` → `reverse_proxy 127.0.0.1:3100` |
| Tunnel | Ingress `snake.flashkeks.com` → `http://127.0.0.1:8097` |

**Update ausrollen** (als root auf `edge`, z. B. von CT 113 per SSH):

```sh
/srv/snake/deploy.sh
```

Der Server speichert die Konten alle 3 s und beim Stoppen (SIGTERM). Ein
Neustart kostet also hoechstens die laufenden Runden, keine Coins.

Bis 22.09.2026 lief das Spiel im Calibre-Container von Michaffs unter
`/game/`. Der Browser-Teil baut die WebSocket-Adresse relativ zur Seite
(`new URL('ws', location.href)`) und laeuft deshalb unter `/` wie unter
`/game/`.

## Spielregeln

- **Arena waechst und schrumpft mit der Spielerzahl:** Kantenlaenge
  `36 + 16 × Spieler`, mindestens 50, hoechstens 200 (1 Spieler 52, 2 → 68,
  3 → 84, 5 → 116). Waechst alle 0,5 s um 2, schrumpft alle 2,5 s um 1.
  **Die Zone toetet nie:** eine Kante rueckt nur nach innen, wenn auf ihrer
  aeussersten Reihe kein Schlangenstueck liegt, sonst wartet sie (bis
  23.09.2026 wurde zerquetscht, wer draussen war). Items
  wachsen mit: Fruechte 0,6 %, Boxen 0,2 % der Felder, Muenzen 1 je 1500.
- Die Kamera zeigt 40 × 40 um den eigenen Kopf, unten rechts eine Minimap
  (Schlangen, Muenzen, legendaere Fruechte, Event-Kisten, Sichtfenster).
- **Weiche Bewegung:** der Server bewegt in ganzen Feldern, der Browser
  schiebt jedes Segment zwischen zwei Ticks von seinem alten zum neuen Feld
  und lernt das Tempo (normal, Turbo, Schnecke) aus den ankommenden Zustaenden.
- Steuerung: WASD / Pfeiltasten, am Handy wischen. Enter oeffnet den Chat.
- **Wand ist toedlich.** Auch fuer Geister und Sterne.
- **Tod:** Kopf in fremden oder eigenen Koerper oder in die Wand. Danach geht
  es zurueck ins Menue, der Score ist weg.
- **Kill:** Der Killer waechst um die halbe Laenge des Opfers (aufgerundet).
- **Kopf an Kopf:** Der Server wuerfelt den Gewinner aus. Die Walze sehen nur
  die Beteiligten, alle anderen eine Feed-Zeile und zwei blinkende Schlangen.
  Die Beteiligten frieren 4,5 s ein und sind in der Zeit massiv.
- **Spawn:** mit Abstand zur Wand und zu anderen Koepfen, 2 s Geist-Schutz.
- **Tempo:** Server-Tick 60 ms. Normal ein Schritt je 2 Ticks, Turbo je Tick,
  Schnecke je 3.
- **Laenge:** hoechstens 5000 (`MAX_LEN`). Koerper gehen kompakt ueber die
  Leitung: Startpunkt + ein Richtungsbuchstabe je Segment (`U D L R`).
- **Effekt-Timer ruhen**, solange man eingefroren ist (Muenzwurf, Duell,
  Mini-Event). Die eigenen Effekte stehen als Balken mit Restzeit oben links
  im Feld.
- **Sound** nur fuer eigene Highlights, fuer alle nur ab ×10 an der Muenze.

## Score und Cashout

- **Score = Laenge + 5 je Kill in diesem Leben.** Steht ueber dem Kopf, in der
  Rangliste und oben links im HUD.
- **Cashout:** Leertaste 5 s halten (am Handy: lange druecken). Solange faehrt
  man stur geradeaus und auf Schneckentempo (~28 Felder, passt auch in die
  kleine Arena), Lenken wird ignoriert, und alle sehen einen goldenen
  Ring mit dem Score. Wer stirbt, verliert alles. Loslassen bricht ab,
  Einfrieren (Duell, Muenze) auch. Nach 5 s wird der Score als Coins
  gutgeschrieben und man landet im Menue.
- Nur mit Konto. Gaeste spielen mit, haben aber weder Cashout noch Coins.
- **Verlassen**-Knopf oben links: raus ohne Auszahlung.

## Konten

- Oeffentliche Registrierung im Hauptmenue: Name 3–16 Zeichen (Buchstaben,
  Zahlen, `_ . -`), Passwort ab 6 Zeichen. Namen sind ohne Gross/Klein
  eindeutig. Neue Konten starten mit 100 Coins.
- Passwoerter: scrypt (N=16384) mit eigenem Salt je Konto. Login rechnet auch
  bei unbekanntem Namen, damit die Antwortzeit nichts verraet.
- Sessions: zufaelliger Token (32 Byte) im `localStorage`, auf dem Server nur
  sein sha256, 30 Tage gueltig.
- Konto-Seite: Statistik, Passwort aendern (meldet alle anderen Geraete ab),
  abmelden, Konto loeschen (mit Passwort).
- Ein Konto kann nur in einem Fenster gleichzeitig spielen.
- Gaeste duerfen keinen Namen nehmen, der einem Konto gehoert.
- Rate-Limits je IP (`cf-connecting-ip`): 5 neue Konten pro Stunde, 10
  Logins bzw. Passwortversuche pro 5 Minuten.

## Slot-Automat

Hauptmenue → „🎰 Slots", nur mit Konto. Drei Walzen, eine Linie, der
Server wuerfelt. Einsatz frei von 1 Coin bis zum Kontostand (Chips 1–1000
oder eigener Betrag; Server-Grenze 1.000.000, nur ganze Zahlen).

| Symbol | Gewicht | drei gleiche |
|---|---|---|
| 🍒 | 30 | ×6 |
| 🍋 | 25 | ×10 |
| 🍇 | 18 | ×20 |
| 🍉 | 12 | ×40 |
| 🔔 | 8 | ×80 |
| ⭐ | 5 | ×200 |
| 💎 | 2 | ×1000 |

Zwei 🍒 irgendwo zahlen ×2. Rueckzahlung im Mittel **95,6 %**
(`node slots.js`). Ab ×80 gibt es eine Gold-Zeile im Feed. Hoechstens ein
Spin je 1,2 s.

## Items

| Item | Anzahl | Wirkung |
|---|---|---|
| Frucht | 90 | 🍎 +1 (50), 🍌 +2 (24), 🍇 +3 (14), 🍉 +5 (8), 🍒 +10 (3), 🥭 +20 (1) — Gewichte in Klammern, ab +10 mit Aura und Feed-Zeile |
| ❓ Mystery-Box | 30, Nachschub nach 3–6 s | kleine Walze nur beim Finder, Wirkung nach 1,6 s |
| 🪙 Muenze | bis 8, alle 3–6 s eine | Double or Nothing, grosse Walze **nur beim Spieler selbst** |

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


**Legendaere Fruechte** (nicht im normalen Pool): 🍍 Pineapple +50 und
🐉 Dragon Fruit +150 (1 zu 5). Alle 60–150 s eine, hoechstens eine je Sorte,
mit Ansage im Feed und dickem Marker auf der Minimap.

**Magnet:** zieht Fruechte, Boxen und Muenzen im Umkreis 8 zwei Felder je
eigenem Schritt heran (also schneller, als man faehrt) und sammelt Fruechte
und Boxen direkt neben dem Kopf gleich mit ein. Muenzen nur, wenn man
wirklich draufsitzt.

**Schild** faengt einen Koerpertreffer ab, und seit 23.09.2026 auch den 💀
aus Muenze oder Box.

## Budget Starlight (Tumble-Slot, frueher „Sweet Kek")

Hauptmenue → „🌟 Budget Starlight", nur mit Konto. Nach dem Vorbild von Starlight
Princess / Gates of Olympus:

- **6 × 5 Raster, gezahlt wird ueberall:** 8 oder mehr gleiche Symbole
  irgendwo zaehlen. Gewinnsymbole platzen, der Rest faellt nach, oben kommt
  Neues (Tumble), bis nichts mehr gewinnt.
- **💎 Multiplikatoren** ×2 bis ×500 (Edelsteine mit Strahlen in vier
  Stufen: gruenes Sechseck ×2–5, blaues Achteck ×6–15, pinker Kristall
  ×20–50, goldener Stern mit Regenbogen ×100–500) bleiben liegen. Endet die
  Tumble-Folge mit Gewinn, fliegen die Kugeln einzeln in die
  MULTIPLIER-Anzeige, werden addiert und dann mit dem Gewinn multipliziert.
  Im Basisspiel sind sie selten (~5 % der Spins zeigen eine) und kommen mit
  Blitz, Wackeln und Donner.
- **⭐ Scatter:** 4+ irgendwo = 10 Freispiele (dazu ×3/×5/×100 fuer 4/5/6).
  Im Bonus gibt es viel mehr Kugeln, und sie sammeln sich zu einem
  Gesamtmultiplikator fuer den Rest des Bonus (zwei ×3 in Freispiel 1 =
  ×6 fuer jeden weiteren Gewinn). Kugeln zaehlen nur in einem Spin mit
  Gewinn. **Retrigger:** 3+ Scatter im Bonus = +5 Freispiele.
- **Anzeige:** im Basisspiel BET / MULTIPLIER / WIN, im Bonus FREE SPINS
  (verbleibend) / MULTIPLIER / SPIN WIN / BONUS WIN.
- **Bonus kaufen** fuer 96 × Einsatz.
- Hoechstens **100.000 ×** Einsatz je Spin (Bonus eingerechnet) — rein
  rechnerisch moeglich, in Millionen Simulationen nie erreicht (hoechster
  Treffer ~10.000 ×).

| Symbol | 8–9 | 10–11 | 12+ |
|---|---|---|---|
| 👑 | 6,93 | 17,32 | 34,65 |
| 💎 | 1,73 | 6,93 | 17,32 |
| 🌙 | 1,39 | 3,46 | 10,4 |
| 🍪 | 1,04 | 1,39 | 8,32 |
| 🧁 | 0,69 | 1,04 | 6,93 |
| 🍩 | 0,56 | 0,83 | 5,54 |
| 🍭 | 0,35 | 0,69 | 3,46 |
| 🍬 | 0,27 | 0,62 | 2,77 |

Basisspiel und Freispiele haben **eigene Symbol-Gewichte** (wie getrennte
Walzensaetze), beide mit vielen kleinen Suessigkeiten; Multis sind im
Basisspiel selten, im Bonus staendig. Abgestimmt per Simulation (24.09.2026,
je 1,6 Mio Basis-Spins und 100.000 gekaufte Boni): **~99,5 %** Rueckzahlung
(Basis ~65,8 %, Freispiele ~33,7 %), Treffer bei ~47 % der Spins, Freispiele
etwa jeder 280. Spin, gekaufter Bonus im Mittel ~95 × Einsatz (Kauf zahlt
~99 %).

Beim Nachrechnen Basis und Bonus **getrennt** simulieren (Basis-Mittel und
Bonus-Quote aus >= 1 Mio Spins, Bonus-Wert aus >= 100.000 Kaeufen) und
zusammensetzen: RTP = Basis + Quote × Bonus-Wert. Ein gemeinsamer Lauf mit
`node slots2.js` schwankt wegen des langen Bonus-Schwanzes um mehrere
Prozentpunkte. Der Scatter ist extrem empfindlich: 1,72 statt 1,725 kostet
~0,3 Punkte, 1,735 gibt schon ~100,5 %. Mehr Multis im Bonus machen ihn
uebrigens *schlechter*, weil sie Symbole verdraengen.

Der Server wuerfelt den ganzen Spin samt Freispielen auf einmal und schickt
alle Zwischenraster, je Spin dazu `tw` (Tumble-Gewinn ohne Multi), `orbSum`,
`multBefore`/`mult` und `scatterWin`; der Browser spielt nur ab. Waehrend der
Animation wird SPIN zu ⏩ Skip: 5× so schnell, nur fuer den laufenden
Spin; ein Klick in der Pause zwischen zwei Freispielen gilt fuer den
naechsten. Alle Wartezeiten, Zaehler und Fluege laufen auf einer virtuellen
Uhr (`s2Sleep`, `s2Count`, `s2Anims`), damit auch schon laufende sofort
schneller werden.
Der Gewinn wird sofort gutgeschrieben, erscheint aber erst in der
Bestenliste (und als Gold-Zeile im Feed), wenn der Browser `spin2Done`
schickt, also nach der Animation. Sonst sieht man direkt nach dem Bonus-Kauf
in der Bestenliste, was rauskommt. Rueckfall: Timer nach geschaetzter
Animationsdauer oder Verbindungsende. Die Maschine passt ihre
Zellgroesse an die Fensterhoehe an (`s2Fit`), damit nichts gescrollt werden
muss. Sound komplett per Web Audio synthetisiert (Kompressor + Hall), 🔊
schaltet ihn ab (merkt sich der Browser). Einsatz wie bei Slots frei, ein Spin je 800 ms. Ab 100× gibt
es eine Gold-Zeile im Feed.

## Mini-Events

Alle 90–180 s (das erste nach 45–75 s) taucht eine **3 × 3 grosse 🎪
EVENT-Kiste** auf: bunt, pulsierend, mit Ringen, auf der Minimap markiert.
Wer mit dem Kopf in die Kiste faehrt, startet ein Event fuer alle, die gerade
auf dem Feld sind:

- Das Spiel friert fuer alle ein, Effekt-Timer, Duelle und Muenzwuerfe ruhen.
  Laufende Cashouts brechen ab.
- Jeder Teilnehmer sieht das Event mit eigener Event-Rangliste. Wer im Menue
  ist, spielt nicht mit.
- Oben im Event steht der eigene Kontostand.
- Danach 5 s **Podium** mit den Top 3 und was sie bekommen haben.
- Dann **Double or Nothing** fuer jeden, der etwas gewonnen hat (Coins aus
  dem Quiz oder Reingewinn aus Roulette/Blackjack, dazu Laenge): 50/50 per
  Muenzwurf, 15 s Bedenkzeit, ohne Antwort wird behalten. Wer noch ueberlegt
  oder wirft, bleibt eingefroren und ist fuer die anderen ein durchsichtiger
  Geist. Wer ablehnt oder fertig geworfen hat, spielt sofort weiter.
- Alle anderen: 3 s Countdown, dann geht es weiter.
- **Danach 3 s Geist-Schutz** fuer alle (nach dem Countdown bzw. nach dem
  eigenen Double or Nothing): keine Kollision mit anderen Schlangen. Die Wand
  bleibt toedlich.
- Einsaetze bei Roulette und Blackjack frei: Chips 1, 5, 10–1000 oder eigener
  Betrag im Feld (Blackjack: „Bet" setzt, ein Chip-Klick setzt sofort).

| Event | Art | Ablauf |
|---|---|---|
| 🏳️ Flag Quiz | flat Coins | 6 Flaggen (Bilder von flagcdn.com), je 9 s, 4 Antworten. Richtig = 100 + bis 100 Tempobonus. Danach Coins = Punkte / 10 (+50 fuer Platz 1) fuer Konten, Laenge = Punkte / 40 fuer alle |
| 🎡 Roulette | Coins setzen | 20 s setzen auf einem echten Board (0 links, 3 × 12, "2:1"-Spalten, Dutzende, Aussenwetten). Rot/Schwarz/Gerade/Ungerade/1–18/19–36 ×2, Dutzend und Spalte ×3, Einzelzahl ×36. Bis 12 Einsaetze, alle Chips liegen in Schlangenfarbe auf dem Board. Dann ein rundes europaeisches Rad mit Kugel (Canvas), die Kugel faellt in die Tasche des Ergebnisses |
| 🃏 Blackjack | Coins setzen | 15 s Einsatz, dann spielen alle gleichzeitig gegen den Dealer, 30 s Zeit. Hit, Stand, **Double** (nur mit 2 Karten), **Split** (einmal, zwei Karten gleichen Werts; geteilte Asse bekommen je eine Karte, 21 nach Split ist kein Blackjack). 6 Decks, Dealer zieht bis 17, Blackjack zahlt 3:2. Tisch: Dealer oben, die anderen klein in der Mitte, die eigene Hand gross unten, Karten fliegen ein, die verdeckte Dealerkarte dreht sich um |

Gaeste koennen beim Flag Quiz mitspielen (bekommen nur Laenge), bei Roulette
und Blackjack nur zuschauen.

## Drumherum

- **Hauptmenue** vor jeder Runde: Login/Registrierung, Farbwahl (zwoelf
  Vorgaben oder frei; zu dunkel lehnt der Server ab), Spielen, Automat.
  Ergebnis der letzten Runde (Tod oder Cashout) steht oben.
- **Layout:** links die eigenen Box-Walzen und der Feed, Mitte das Feld,
  rechts Rangliste, Bestenliste, Chat. Unter 1180 px Breite untereinander.
- **Bestenliste** (nur Konten): bester Score, meiste Coins, meiste Kills.
- **Chat:** 200 Zeichen, eine Nachricht je 600 ms, die letzten 50 bekommt
  jeder beim Verbinden. Gaeste erst, wenn sie im Spiel sind.
- **Tod:** Die Kamera bleibt 2,7 s am Todesort stehen, 💀 mit Ring, roter
  Rand, grosse Ansage mit Grund (Wand, eigener Schwanz, in wen man gefahren
  ist, Kopf-an-Kopf verloren, Stern, 💀-Kiste, Double or Nothing), der
  Schuldige bekommt einen roten Ring. Der Grund steht danach auch im Menue.
- **Swap (🔀):** Blitz zwischen beiden Koepfen und leuchtende Schlangen fuer
  alle, die hinschauen; die beiden Beteiligten bekommen ein grosses Banner
  mit alter und neuer Laenge.
- **Feed** mit Streak-Ansagen (DOPPELKILL, TRIPLEKILL, RAMPAGE, GODLIKE) und
  Gold-Zeilen fuer seltene Treffer.

## Tests

Nur lokal, nie auf `edge` setzen:

- `SNAKE_TEST=1` schaltet die Nachricht `testEvent {kind}` frei, die sofort
  ein Event startet.
- `SNAKE_EVENT_SPEED=5` laesst alle Event-Phasen fuenfmal schneller laufen.
- `testEvent {kind, result}` mit `result` erzwingt beim Roulette die Zahl
  (fuer Screenshots des Angebots).

## Protokoll (WebSocket)

Client → Server: `register`, `login`, `resume {token}`, `logout`,
`changePassword`, `deleteAccount`, `join {name?, color}`, `leave`,
`direction`, `cashout {on}`, `chat`, `spin {bet}`, `spin2 {bet, buy}`, `spin2Done`, `eventAction`
(`choice` beim Quiz, `bet`/`clear` beim Roulette, `bet`/`clear`/`move` beim
Blackjack).

Server → Client: `welcome`, `auth`, `authError`, `authExpired`, `account`,
`joined`, `joinError`, `left`, `died` (`cause`, `by`, `byId`, `at`), `swapfx`, `cashedout`, `cashoutCancel`, `state`
(alle 60 ms, mit `arena` und `paused`), `duel`, `gamble`, `box`, `jackpot`,
`feed` (mit `who` und `big` fuer den Sound), `chat`, `chatlog`, `highscores`,
`spin`, `spinError`, `spin2`, `spin2Error`, `event`, `eventEnd`, `eventError`, `resume`.

Die Oberflaeche ist seit 23.09.2026 englisch, diese Doku bleibt deutsch.

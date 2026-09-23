# 🐶 Snake and Gamba

(bis 23.09.2026 „Kek Minigames“.) Zwei Bereiche:

- **🐍 Snake:** Multiplayer-Snake im Browser, mit Kopf-an-Kopf-Duellen im
  CS:GO-Case-Opening-Stil, Mystery-Boxen, Double or Nothing, Cashout und
  Quiz-Events (Flaggen, Trivia, Weltkarte, Schaetzen).
- **🎰 Gamba (Casino):** Daily Wheel, Slots, Budget Starlight, Crossy Road und
  dauerhafte Tische fuer Blackjack und Roulette, an denen man sieht, wer
  gerade mitspielt.

Konten, Coins und Bestenliste gelten fuer beides. Ein Node-Prozess
(`server.js`, nur `ws` als Abhaengigkeit) liefert die Seite aus und spricht
per WebSocket mit den Browsern. Logo und Favicon: der Hund von Max
(`public/img/`).

Live: **`snake.flashkeks.com`** auf `edge` (Netcup).

## Dateien

| Datei | Inhalt |
|---|---|
| `server.js` | HTTP + WebSocket, Spiel-Tick, Items, Duelle, Cashout |
| `accounts.js` | Konten, Sessions, Coins, Statistik (JSON-Datei im Datenordner) |
| `slots.js` | Slot-Automat „Slots“ (frueher „Kek Slots“); `node slots.js` rechnet die Rueckzahlungsquote aus |
| `slots2.js` | Tumble-Slot „Budget Starlight“ (frueher „Sweet Kek“, intern weiter `s2`/`spin2`); `node slots2.js N` simuliert grob Rueckzahlung, Bonus-Quote, Bonus-Kauf (zum Abstimmen siehe unten) |
| `events.js` | Quiz-Events im Snake (Flag Quiz, Trivia, Where is it?, Guess the number): Ablauf, Punkte, Belohnung |
| `tables.js` | Casino-Tische Blackjack und Roulette: Runden, Einsaetze, Auszahlung |
| `casino.js` | Daily Wheel und Crossy Road (Werte, Wahrscheinlichkeiten); `node casino.js` rechnet nach |
| `flags.js` | Laender fuer das Flag Quiz (ISO-Code + englischer Name) |
| `trivia.js` | Trivia-Fragen (Frage, richtige Antwort, drei falsche) |
| `places.js` | Orte fuer „Where is it?“ (Name, Hinweis, Koordinaten) |
| `estimates.js` | Schaetzfragen (Frage, Zahl, Einheit, bei Jahreszahlen `tol`) |
| `public/index.html` | der ganze Browser-Teil in einer Datei |
| `tickets.js` | Support-Tickets (Spieler ↔ Support), JSON-Datei im Datenordner |
| `admin.js` | Admin-Interface `admin-snake.flashkeks.com`: eigener HTTP-Server auf 127.0.0.1, prueft das Cloudflare-Access-JWT, JSON-API |
| `public-admin/index.html` | die Admin-Seite (Konten, Tickets, Protokoll) |
| `public/img/` | Logo, Favicons, `world.svg` (Landflaechen aus `world-atlas` 110m, equirectangular: x = Laenge + 180, y = 90 − Breite) |
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

Casino → „🎰 Slots", nur mit Konto. Drei Walzen, eine Linie, der
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

Casino → „🌟 Budget Starlight", nur mit Konto. Nach dem Vorbild von Starlight
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
Basisspiel selten, im Bonus staendig. Abgestimmt per Simulation (23.09.2026,
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
Animation ist SPIN gesperrt. **Skip ist seit 23.09.2026 aus** (Max: „immer
noch buggy“); der Code dafuer (virtuelle Uhr in `s2Sleep`, `s2Count`,
`s2Anims`, `s2SkipAt`) ist noch da, nur der Knopf loest ihn nicht mehr aus.
Der Gewinn wird sofort gutgeschrieben, erscheint aber erst in der
Bestenliste (und als Gold-Zeile im Feed), wenn der Browser `spin2Done`
schickt, also nach der Animation. Sonst sieht man direkt nach dem Bonus-Kauf
in der Bestenliste, was rauskommt. Rueckfall: Timer nach geschaetzter
Animationsdauer oder Verbindungsende. Die Maschine passt ihre
Zellgroesse an die Fensterhoehe an (`s2Fit`), damit nichts gescrollt werden
muss. Sound komplett per Web Audio synthetisiert (Kompressor + Hall), 🔊
schaltet ihn ab (merkt sich der Browser). Einsatz wie bei Slots frei, ein Spin je 800 ms. Ab 100× gibt
es eine Gold-Zeile im Feed.

## Casino (Gamba)

Hauptmenue → „Enter the casino“. Lobby mit sechs Kacheln; die Tisch-Kacheln
zeigen live, wer gerade dort sitzt (Nachricht `lobby`). Alles ausser den
Tischen nur mit Konto; an den Tischen duerfen Gaeste zuschauen. Wer im
Casino ist, ist nicht auf dem Snake-Feld (und umgekehrt: `join` wirft einen
vom Tisch, `tableJoin` geht nur ohne Schlange).

### Blackjack und Roulette (Dauertische, `tables.js`)

Jeder Tisch dreht Runden, solange jemand daran sitzt; ohne Einsaetze wird
nicht ausgeteilt bzw. gedreht, dann laeuft einfach die naechste
Einsatzphase. Alle am Tisch sehen alle Einsaetze und Haende, rechts steht die
Bilanz jedes Spielers seit er sitzt. ✕ oben rechts = Tisch verlassen. Wer in
der Einsatzphase geht, bekommt den Einsatz zurueck; spaeter gesetzte Chips
laufen weiter und werden ausgezahlt, eine offene Blackjack-Hand bleibt
stehen. Einsaetze frei: Chips 1, 5, 10–1000 oder eigener Betrag.

| Tisch | Ablauf |
|---|---|
| 🎡 Roulette | 20 s setzen auf einem echten Board (0 links, 3 × 12, "2:1"-Spalten, Dutzende, Aussenwetten). Rot/Schwarz/Gerade/Ungerade/1–18/19–36 ×2, Dutzend und Spalte ×3, Einzelzahl ×36. Bis 12 Einsaetze je Runde, Chips in Spielerfarbe. Dann 6,5 s rundes europaeisches Rad mit Kugel, 6 s Ergebnis. Oben die letzten 12 Zahlen |
| 🃏 Blackjack | 15 s Einsatz, dann spielen alle gleichzeitig gegen den Dealer, 30 s Zeit. Hit, Stand, **Double** (nur mit 2 Karten), **Split** (einmal, zwei Karten gleichen Werts; geteilte Asse je eine Karte, 21 nach Split ist kein Blackjack). 6 Decks (neu gemischt unter 60 Karten), Dealer zieht bis 17, Blackjack zahlt 3:2 |

Bis 23.09.2026 waren Blackjack und Roulette Events im Snake; die Logik ist
unveraendert umgezogen.

### 🎁 Daily Wheel

Einmal pro Kalendertag (Europe/Berlin) pro Konto, Konto-Feld `daily`
(`YYYY-MM-DD`). 16 Felder, gewuerfelt wird nach Gewicht je Wert:

| Coins | 100 | 250 | 500 | 1000 | 2500 | 5000 | 10000 | 25000 |
|---|---|---|---|---|---|---|---|---|
| Gewicht | 30 | 25 | 18 | 12 | 8 | 4,5 | 2 | 0,5 |

Im Mittel ~1050 Coins am Tag. Wie beim Bonus-Kauf erscheint der Gewinn erst
nach dem Dreh in Bestenliste und Feed (`dailyDone`).

### 🐔 Crossy Road

Nach dem Vorbild „Chicken Road“: Einsatz waehlen, dann Spur fuer Spur ueber
die Strasse. Jede Spur ueberfaehrt einen mit Wahrscheinlichkeit p, der
Multiplikator nach k Spuren ist 0,99 / (1 − p)^k – jede Cashout-Strategie
zahlt also im Mittel 99 %. Cashout jederzeit nach der ersten Spur, am Ziel
automatisch.

| Stufe | p je Spur | Spuren | hoechstens |
|---|---|---|---|
| Easy | 8 % | 24 | ×7,3 |
| Medium | 14 % | 22 | ×27 |
| Hard | 22 % | 20 | ×142 |
| Hardcore | 40 % | 15 | ×2105 |

Der Server wuerfelt jede Spur einzeln erst beim Schritt (`crossStep`, hoechstens
alle 250 ms). Verbindung weg mitten im Lauf: geschaffte Spuren werden
ausgezahlt, ohne Schritt gibt es den Einsatz zurueck. Logout mitten im Lauf
geht nicht.

## Mini-Events (Snake)

Alle 90–180 s (das erste nach 45–75 s) taucht eine **3 × 3 grosse 🎪
EVENT-Kiste** auf: bunt, pulsierend, mit Ringen, auf der Minimap markiert.
Wer mit dem Kopf in die Kiste faehrt, startet ein Quiz fuer alle, die gerade
auf dem Feld sind:

- Das Spiel friert fuer alle ein, Effekt-Timer, Duelle und Muenzwuerfe ruhen.
  Laufende Cashouts brechen ab.
- Jeder Teilnehmer sieht das Event mit eigener Event-Rangliste. Wer im Menue
  oder Casino ist, spielt nicht mit.
- Am Ende Coins = Punkte / 10 (+50 fuer Platz 1) fuer Konten, Laenge =
  Punkte / 40 fuer alle, dann 5 s **Podium** mit den Top 3.
- Dann **Double or Nothing** fuer jeden, der etwas gewonnen hat: 50/50 per
  Muenzwurf, 15 s Bedenkzeit, ohne Antwort wird behalten. Wer noch ueberlegt
  oder wirft, bleibt eingefroren und ist fuer die anderen ein durchsichtiger
  Geist. Wer ablehnt oder fertig geworfen hat, spielt sofort weiter.
- Alle anderen: 3 s Countdown, dann geht es weiter.
- **Danach 3 s Geist-Schutz** fuer alle (nach dem Countdown bzw. nach dem
  eigenen Double or Nothing): keine Kollision mit anderen Schlangen. Die Wand
  bleibt toedlich.

| Event | Runden | Ablauf und Punkte |
|---|---|---|
| 🏳️ Flag Quiz | 6 × 9 s | Flagge (flagcdn.com), 4 Laender. Richtig = 100 + bis 100 Tempobonus |
| 🧠 Trivia | 6 × 12 s | Allgemeinwissen aus `trivia.js`, 4 Antworten, Punkte wie beim Flag Quiz |
| 🌍 Where is it? | 5 × 15 s | Stadt oder Wahrzeichen aus `places.js`, Klick auf die Weltkarte. Punkte = 200 × e^(−km/1500): 0 km 200, 500 km ~143, 1500 km ~74. Aufloesung zeigt alle Tipps mit Linie zum Ziel und km |
| 📏 Guess the number | 5 × 15 s | Zahl aus `estimates.js` schaetzen (Hoehe, Laenge, Gewicht, Jahr …). 200 bei exakt, 0 ab Faktor 3 daneben (log. Verhaeltnis); Jahreszahlen linear bis `tol` Jahre. Wer am naechsten dran ist, +50 |

Haben alle geantwortet, wird sofort aufgeloest. Gaeste spielen mit
(bekommen nur Laenge). Beim Pflegen der Fragen: nur Dinge, die sich nicht
aendern, und Antworten, die man belegen kann.

## Drumherum

- **Hauptmenue** vor jeder Runde: Login/Registrierung, links 🐍 Snake
  (Farbwahl – zwoelf Vorgaben oder frei, zu dunkel lehnt der Server ab –
  und Play), rechts 🎰 Gamba mit Live-Anzeige der Tische und dem Weg ins
  Casino. Ergebnis der letzten Runde (Tod oder Cashout) steht oben.
- **Layout:** links die eigenen Box-Walzen und der Feed, Mitte das Feld,
  rechts Rangliste, Bestenliste, Chat. Seit 23.09.2026 groesser: Feld bis
  1000 px (Canvas intern 1000 × 1000), Seitenleisten 320/340 px, groessere
  Schrift. Unter 1320 px Breite untereinander.
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

## Support-Tickets

Hauptmenue → „💬 Support“ (nur mit Konto). Liste der eigenen Tickets, neues
Ticket (Betreff bis 80 Zeichen, Text bis 1500), Chatverlauf mit Antworten.
Gedacht vor allem fuer Verbesserungsvorschlaege. Antwortet der Support,
kommt die Antwort live an: roter Zaehler am Knopf, Toast und Glocke. Hoechstens
5 offene Tickets je Konto, 5 neue je Stunde, eine Nachricht je 2 s.
Geschlossene Tickets nehmen nichts mehr an. Wird ein Konto geloescht,
bleiben seine Tickets lesbar, der Name bekommt „(deleted)“.

Gespeichert in `DATA_DIR/tickets.json` (wie `accounts.json`: gebuendelt,
atomar, kaputt = Server startet nicht).

## Admin-Interface (admin-snake.flashkeks.com)

Laeuft im selben Prozess, aber als **eigener HTTP-Server nur auf
127.0.0.1:`ADMIN_PORT`**, der Spiel-Port kennt keine Admin-Pfade. Ohne
`ADMIN_PORT` gibt es kein Admin-Interface.

**Zugang, doppelt gesichert, ohne eigenes Passwort:**

1. Cloudflare Access vor `admin-snake.flashkeks.com` (Policy „Kek-Only“,
   Mail-PIN).
2. Der Server prueft selbst das Access-JWT aus `Cf-Access-Jwt-Assertion`:
   RS256-Signatur gegen `https://TEAM.cloudflareaccess.com/cdn-cgi/access/certs`
   (eine Stunde gemerkt, bei unbekanntem Schluessel neu geholt), Audience =
   `SNAKE_ADMIN_AUD`, Aussteller, Ablauf, optional nur Mails aus
   `SNAKE_ADMIN_EMAILS`. Fehlt `SNAKE_ADMIN_TEAM`/`SNAKE_ADMIN_AUD`, lehnt er
   **alles** ab (403).

Aendernde Aufrufe brauchen zusaetzlich den Header `X-Admin: 1` (gegen CSRF).
Die Seite setzt ihn selbst.

| Reiter | Was |
|---|---|
| Accounts | alle Konten mit Coins, zuletzt gesehen, Spins, groesstem Gewinn, bestem Score, Kills, Daily-Status. „Manage“: Coins geben/nehmen/setzen (mit Notiz), Daily Wheel zuruecksetzen, ueberall abmelden (wirft auch aus Spiel und Tisch), Konto loeschen (Name muss eingetippt werden) |
| Tickets | offene zuerst, ungelesene markiert, Verlauf, Antworten (Strg+Enter), schliessen/wieder oeffnen |
| Log | jede aendernde Aktion mit Mail, Ziel und Detail (Coins vorher/nachher) aus `DATA_DIR/admin-log.jsonl` |

Oben: wer eingeloggt ist, wer spielt, wer an welchem Tisch sitzt, Konten,
Coins gesamt, offene Tickets. Die Seite fragt alle 5 s neu.

API (alles JSON): `GET /api/overview`, `GET /api/users`,
`POST /api/users/KEY/coins {delta | set, note}`, `POST /api/users/KEY/reset-daily`,
`POST /api/users/KEY/logout-all`, `DELETE /api/users/KEY {confirm: NAME}`,
`GET /api/tickets`, `GET /api/tickets/ID`, `POST /api/tickets/ID/reply {text}`,
`POST /api/tickets/ID/status {status}`, `GET /api/log`.

## Tests

Nur lokal, nie auf `edge` setzen:

- `SNAKE_TEST=1` schaltet die Nachrichten `testEvent {kind}` (startet sofort
  ein Quiz-Event: `flags`, `trivia`, `geo`, `estimate`) und
  `testTable {result}` (naechste Roulette-Zahl am Tisch) frei.
- `SNAKE_EVENT_SPEED=5` laesst alle Event- und Tisch-Phasen fuenfmal schneller
  laufen.
- `ADMIN_PORT=3101 SNAKE_ADMIN_INSECURE=1` startet das Admin-Interface lokal
  **ohne** Anmeldepruefung. Nur fuer Tests, nie auf `edge`. Die
  JWT-Pruefung selbst testet man mit eigenem Schluesselpaar ueber
  `admin._setCerts([jwk])`.
- Zwei Browser-Tests (Playwright) muessen getrennte Kontexte nehmen
  (`browser.newContext()`), sonst teilen sie sich den Login-Token im
  localStorage.

## Protokoll (WebSocket)

Client → Server: `register`, `login`, `resume {token}`, `logout`,
`changePassword`, `deleteAccount`, `join {name?, color}`, `leave`,
`direction`, `cashout {on}`, `chat`, `spin {bet}`, `spin2 {bet, buy}`, `spin2Done`,
`eventAction` (`choice` bei Flaggen/Trivia, `lat`/`lon` bei Where is it?,
`value` bei Guess the number), `tableJoin {kind}`, `tableLeave`,
`tableAction` (`bet`/`clear` beim Roulette, `bet`/`clear`/`move` beim
Blackjack), `daily`, `dailyDone`, `crossStart {bet, diff}`, `crossStep`,
`crossCash`, `tickets`, `ticketNew {subject, text}`, `ticketReply {id, text}`,
`ticketRead {id}`.

Server → Client: `welcome`, `auth`, `authError`, `authExpired`, `account`,
`joined`, `joinError`, `left`, `died` (`cause`, `by`, `byId`, `at`), `swapfx`, `cashedout`, `cashoutCancel`, `state`
(alle 60 ms, mit `arena` und `paused`), `duel`, `gamble`, `box`, `jackpot`,
`feed` (mit `who` und `big` fuer den Sound), `chat`, `chatlog`, `highscores`,
`spin`, `spinError`, `spin2`, `spin2Error`, `event`, `eventEnd`, `eventError`, `resume`,
`table` (Tisch-Zustand, nur an die am Tisch, mit `you`), `tableLeft`,
`tableError`, `lobby`, `daily`, `dailyError`, `cross` (`state`: run, dead,
cashed), `crossError`, `tickets` (`list`, `unread`, `open`), `ticketError`. `welcome` bringt dazu `wheel`, `cross` und `lobby`.

Die Oberflaeche ist seit 23.09.2026 englisch, diese Doku bleibt deutsch.

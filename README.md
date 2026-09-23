# 🐶 Snake and Gamba

(bis 23.09.2026 „Kek Minigames“.) Drei Bereiche:

- **🐍 Snake:** Multiplayer-Snake im Browser, mit Kopf-an-Kopf-Duellen im
  CS:GO-Case-Opening-Stil, Mystery-Boxen, Double or Nothing, Cashout und
  Quiz-Events (Flaggen, Trivia, Weltkarte, Schaetzen).
- **🎰 Gamba (Casino):** Daily Wheel, Slots, Budget Starlight, Crossy Road, Plinko
  und dauerhafte Tische fuer Blackjack, Roulette und Poker (Spieler gegen
  Spieler), an denen man sieht, wer gerade mitspielt.
- **🔫 Arena:** Extraction-Shooter mit Loadout, Cases, Waffen mit Effekten, Salvage und Extraction-Zonen (seit 23.09.2026).

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
| `events.js` | Events im Snake (Flag Quiz, Trivia, Where is it?, Guess the number und die Map-Events): Ablauf, Punkte, Belohnung |
| `achievements.js` | Achievements (#3): Katalog, Pruefungen, Titel |
| `luck.js` | Admin v2: erzwungene Mindestgewinne je Konto und Spiel |
| `shop.js` | Shop (#9): Katalog, was andere von einem sehen |
| `shooter.js` | Arena: Hub (Shop, Cases, Salvage, Loadout) und Raid (Map, Kisten, Beutel, Extraction, Kampf mit Effekten) |
| `arena-items.js` | Arena-Items: Waffen, Ruestungsteile und Sets, Granaten, Grade, Mods, Erzeugung je Quelle, kalibrierte Seltenheit, Salvage-Wert, Migration |
| `minigames.js` | Map-Events (#6): Labyrinth, Coin Rush, Last Snake Standing – Map-Bau, Schritte, Kollisionen, Punkte |
| `tables.js` | Casino-Tische Blackjack (mit Sidebets) und Roulette: Runden, Einsaetze, Auszahlung; haengt auch Poker als dritten Tisch ein |
| `poker.js` | Poker (Texas Hold'em No-Limit, Spieler gegen Spieler): Sitze, Blinds, Setzrunden, Side-Pots, Handbewertung, Showdown |
| `casino.js` | Daily Wheel und Crossy Road (Werte, Wahrscheinlichkeiten); `node casino.js` rechnet nach |
| `plinko.js` | Plinko: 16 Reihen, feste Faecher-Multis je Stufe, Drop; `node plinko.js [N]` zeigt die Tabellen samt RTP (mit N zusaetzlich eine Simulation) |
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
- **Laenge und Score sind unbegrenzt** (seit 23.09.2026, vorher bei 5000
  gedeckelt). Gezeichnet werden hoechstens 5000 Felder (`MAX_BODY`), alles
  darueber zaehlt nur fuer Laenge, Score, Kill-Bonus und Cashout. Koerper
  gehen kompakt ueber die Leitung: Startpunkt + ein Richtungsbuchstabe je
  Segment (`U D L R`). `state` meldet in `len` die echte Laenge.
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
  abmelden, Konto loeschen (mit Passwort). Beim Oeffnen holt sie frische
  Zahlen (`me`), weil Spins nur den Kontostand schicken.

### Statistik (Issue #5)

Seit 23.09.2026 in `stats` je Konto:

- **Je Spiel** `stats.games.NAME = { plays, wagered, won, bestWin, bestX }`
  fuer `slots`, `starlight`, `crossy`, `plinko`, `daily`, `blackjack`,
  `roulette`, `poker`, `don`. `won` ist die Auszahlung inkl. Einsatz (Poker:
  der gewonnene Pot), `bestX` = Auszahlung / Grundeinsatz (Starlight: /
  Einsatz ohne Bonus-Kauf-Aufschlag; Roulette: beste Einzelwette; Blackjack
  inkl. Sidebets). `accounts.game()` verbucht eine Runde.
- **Snake:** `bestScore`, `kills`, `deaths`, `playMs` (Zeit auf dem Feld),
  Cashouts wie bisher.
- **Events:** `eventsPlayed`, `eventWins` (Platz 1 mit Punkten).
- **Arena:** `shooterKills`, `shooterDeaths`.
- **Herkunft der Coins:** `earned` (#11).
- **Zeitraeume** `stats.periods.day` / `.week` (Europe/Berlin, ISO-Woche):
  `bestScore`, `kills`, `bestWin`, `bestX` je Spiel, `casinoNet`,
  `eventWins`, `arenaKills`. Setzen sich beim ersten Zugriff im neuen
  Zeitraum zurueck (`accounts.period()`); Grundlage fuers Leaderboard (#8).
  Beim **Score** zaehlt seit 3.1 jede Runde einzeln: `topRuns` (die besten
  10 Runden je Konto, gesamt und je Zeitraum), damit ein Spieler mehrfach
  auf dem Board stehen kann (Wunsch Max). Alte Konten ohne `topRuns` stehen
  mit `bestScore` drin.
- **Versteckte Gewinne:** Starlight, Plinko und Daily verbuchen ihre Runde
  erst beim Aufloesen (`hideWin(..., onReveal)`), damit Leaderboard und
  Statistik keinen Ausgang vorab verraten.

Aeltere Zahlen vor dem 23.09.2026 gibt es nur in den alten Feldern
(`spins`, `biggestWin`, `bestScore`, `kills`, Cashouts).
- Ein Konto kann nur in einem Fenster gleichzeitig spielen.
- Gaeste duerfen keinen Namen nehmen, der einem Konto gehoert.
- Rate-Limits je IP (`cf-connecting-ip`): 5 neue Konten pro Stunde, 10
  Logins bzw. Passwortversuche pro 5 Minuten.

### 🏆 Achievements und Titel (Issue #3)

Katalog in `achievements.js` (25 Stueck), jedes mit Pruefung gegen Konto und
Statistik (#5). `accounts.stat()` prueft nach jeder Aenderung, `addCoins`
bei Zuwachs ab 1 Mio. Neu erreichte landen in `u.achievements { id:
Zeitpunkt }`; der Server schickt `achievement` an alle Fenster des Kontos
(Toast) und eine Feed-Zeile. **Rueckwirkend:** beim Serverstart werden alle
Konten still geprueft – wer es schon erfuellt, hat es ohne Toast.

Die meisten geben einen **Titel**; angelegt wird er auf der Konto-Seite
(`setTitle {id|null}`, `u.title`). Er steht neben dem Namen auf dem Feld
(`tt` im Zustand), in der Spielerliste, in der Bestenliste, im Chat und an
den Tischen; das Admin-Interface zeigt Anzahl und Titel.

Beispiele: First blood, 100 Kills, 10er-Streak (`stats.bestStreak`), Score
10k/50k, Cashout ueber 5000, 100 Tode, 10 h Spielzeit, Event-Siege, Daily 7
Tage am Stueck (`u.dailyStreak`, `stats.dailyBestStreak`), Starlight 1000×
und Max Win (100.000×), Plinko ×1000, Crossy Hardcore bis zum Ziel
(`stats.crossyHardcoreWins`), Poker-Pot 10k, 100 Blackjack-Haende, 1000
Casino-Runden, 1 Mio Coins, Arena-Kill/50 Kills, Extraction 1×/25×
(`stats.arenaExtracts`), Legendary-/One-in-a-million-Item (`stats.bestOdds`), erstes Ticket (`stats.ticketsCreated`), Shop-Kauf,
die 7 klassischen Skins.

### 🎨 Cosmetic Shop (Issue #9, Umbau 23.09.2026)

Hauptmenue → „🎨 Cosmetic Shop“ (nur Konten). Rein kosmetisch, kein
Spielvorteil. Katalog in `shop.js`, Gekauftes in `u.inventory`, je Kategorie
hoechstens ein angelegtes Teil in `u.equipped` (beim Kauf automatisch
angelegt, „take off“ legt ab). Andere sehen Skin, Kopf, Trail, Namensfarbe
und Todes-Effekt (im Zustand als `sk`, der Todes-Effekt als `deathfx` an
alle), Musik hoert nur man selbst.

**134 Designs** in sechs Kategorien: 40 Skins, 36 Koepfe, 23 Trails, 15
Todes-Effekte, 13 Namensfarben, 8 Musikstuecke, darunter **„☀️ Sunny pop“**
(18.000, Rare, im normalen Rotations-Pool). War von 3.1 bis 3.3 gratis und
ab Werk angelegt (erst als Lo-fi-Jazz, dann poppiger), seit 3.4 auf Wunsch
Max wieder ein normales Shop-Item. Die Mechanik dafuer bleibt: `free: true`
am Item (`shop.FREE`) und `shop.DEFAULTS`, beide derzeit leer. Beim Laden
legt `accounts.js` ein nur gratis angelegtes Sunny pop ab (wer es nicht im
Inventar hat, hat es nicht gekauft). Eigener Sequencer-Modus `pop` (112 BPM,
C–G–Am–F, Kick/Snare/Hi-Hat aus Oszillatoren, pumpender Bass,
Offbeat-Akkorde, Melodie aus einer Liste). Preise 4k–150k (beim Umbau
etwa verdoppelt, Wunsch Max „ein wenig teurer“). Seltenheit nach Preis:
Common < 10k ≤ Rare < 25k ≤ Epic < 60k ≤ Legendary.

**Rotation (Wunsch Max):** Kaufen geht nur, was gerade im Angebot ist.
- ☀️ **Daily**, 8 Teile, neu um Mitternacht (Europe/Berlin): 2 Skins,
  2 Koepfe, Trail, Todes-Effekt, Namensfarbe, ein beliebiges – ohne Legendary.
- 📅 **Weekly**, 4 Premium-Teile, neu Montag 00:00: ein Legendary-Skin plus
  drei Epic/Legendary. Nie gleichzeitig im Daily.
- Die Auswahl ist fest aus Datum bzw. ISO-Woche geseedet
  (`shop.rotation()`), fuer alle gleich, ohne Speicher.
  `node shop.js 60` zeigt, was in den naechsten 60 Tagen drankommt.
- 🎒 **Collection** zeigt Gekauftes je Kategorie (immer anlegbar),
  📖 **Catalog** alles, Nicht-Angebotenes mit 🔒.
- Der Server prueft beim Kauf die Rotation (`Not in the shop right now`);
  der Browser holt sie beim Oeffnen (`shopRot`) und wenn der Countdown
  ablaeuft.

**Aussehen als Daten:** jedes Item hat ein `look` (Skins `fade`, `cycle`,
`hue`, `glint`, `flash` plus Rand/Funkeln; Trails `emoji`, `dot`, `ring`;
Tod `rise`, `boom`, `burst`, `implode`, `confetti`; Namen eine Farbe oder
laufender Verlauf; Musik `arp`/`pad` mit Akkorden). Der Browser zeichnet das
generisch – ein neues Design ist eine Zeile in `shop.js`, kein Client-Code.
Chat-Namensfarben werden als CSS-Klassen `nc-ID` aus dem Katalog erzeugt.

Die Preise sind eine Coin-Senke (#11): `stats.shopSpent`, `earned.shop`
(negativ). Epic- und Legendary-Kaeufe gehen in den Feed. Jackpot und Stern
ueberdecken den Skin fuer ihre Dauer.

### Coin-Wirtschaft (Issue #11)

Ab 23.09.2026 zaehlt jedes Konto in `stats.earned`, woher seine Coins
kommen: `snake` (Cashouts), `events` (Quiz-Belohnungen), `daily` (Daily
Wheel), `don` (Double or Nothing netto, kann negativ sein), `admin`
(Gutschriften/Abzuege im Admin). Das Admin-Interface zeigt oben die Summe je
Quelle ueber alle Konten. Das Casino rechnet je Spiel in `stats.games` (#5).

Stand beim Einfuehren (3 Konten): 43 Cashouts mit zusammen 52.824 Coins,
also **~1230 Coins je Snake-Runde** – die mit Abstand groesste Quelle. Die
Richtwerte danach:

| Quelle | Groessenordnung |
|---|---|
| Snake-Cashout | ~1200 je Runde, linear mit Laenge und Kills, unbegrenzt |
| Quiz-Event | Solo-Sieg ~1–2 Cashouts, mit mehr Spielern bis ×3 |
| Daily Wheel | ~1050 am Tag |
| Casino | Senke: RTP 94–99,5 % je Spiel, Poker neutral (kein Rake) |

Der unbegrenzte Score bleibt: Die laengste Runde bisher brachte 5010, das
sprengt nichts. Nachsteuern mit den `earned`-Zahlen, wenn eine Quelle
davonlaeuft.

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
(`node slots.js`). Ab ×80 gibt es eine Gold-Zeile im Feed – erst wenn die
Walzen stehen (2 s, `hideWin`), sonst verriet der Feed den Treffer vorher. Hoechstens ein
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
  Treffer ~10.000 ×). Steht als goldener Hinweis „MAX WIN 100,000ד neben dem
  Titel, die Info (ℹ️) nennt dazu die Rueckzahlung (`RTP` in `slots2.js`,
  per `welcome` an den Browser).
- **Leertaste = Spin**, bei Budget Starlight und bei Slots (nicht waehrend
  einer Animation und nicht beim Tippen im Einsatzfeld).

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

Hauptmenue → „Enter the casino“. Die Lobby hat drei Tabs (seit 23.09.2026,
Wunsch Max): **🎁 Daily Bonus** (Daily Wheel), **🎰 Slots & more** (Slots,
Budget Starlight, Crossy Road, Plinko) und **🃏 Table Games** (Blackjack,
Roulette, Poker). Der zuletzt offene Tab bleibt im Browser gemerkt
(`localStorage`, nur Komfort). Die Tisch-Kacheln zeigen live, wer gerade
dort sitzt (Nachricht `lobby`); die Poker-Kachel zaehlt offene Tische und
wer dort sitzt. Alles ausser den
Tischen nur mit Konto; an den Tischen duerfen Gaeste zuschauen. Wer im
Casino ist, ist nicht auf dem Snake-Feld (und umgekehrt: `join` wirft einen
vom Tisch, `tableJoin` geht nur ohne Schlange).

### Blackjack, Roulette und Poker (Dauertische, `tables.js`, `poker.js`)

Jeder Tisch dreht Runden, solange jemand daran sitzt; ohne Einsaetze wird
nicht ausgeteilt bzw. gedreht, dann laeuft einfach die naechste
Einsatzphase. Alle am Tisch sehen alle Einsaetze und Haende, rechts steht die
Bilanz jedes Spielers seit er sitzt. ✕ oben rechts = Tisch verlassen. Wer in
der Einsatzphase geht, bekommt den Einsatz zurueck; spaeter gesetzte Chips
laufen weiter und werden ausgezahlt, eine offene Blackjack-Hand bleibt
stehen. Einsaetze frei, eingestellt wie bei Plinko: **− Betrag +** (Stufen
1, 2, 5, 10, 25 … 100.000) oder direkt tippen. Beim Roulette gilt der Betrag
fuer jeden Klick aufs Board, beim Blackjack setzt „Place bet“ Einsatz und
Sidebets auf einmal.

| Tisch | Ablauf |
|---|---|
| 🎡 Roulette | 20 s setzen auf einem echten Board (0 links, 3 × 12, "2:1"-Spalten, Dutzende, Aussenwetten). Rot/Schwarz/Gerade/Ungerade/1–18/19–36 ×2, Dutzend und Spalte ×3, Einzelzahl ×36. Bis 12 Einsaetze je Runde, Chips in Spielerfarbe. Dann 6,5 s rundes europaeisches Rad mit Kugel, 6 s Ergebnis. Oben die letzten 12 Zahlen |
| 🃏 Blackjack | 15 s Einsatz, dann spielen alle gleichzeitig gegen den Dealer, 30 s Zeit. Hit, Stand, **Double** (nur mit 2 Karten), **Split** (einmal, zwei Karten gleichen Werts; geteilte Asse je eine Karte, 21 nach Split ist kein Blackjack). 6 Decks (neu gemischt unter 60 Karten), Dealer zieht bis 17, Blackjack zahlt 3:2 |

Bis 23.09.2026 waren Blackjack und Roulette Events im Snake; die Logik ist
unveraendert umgezogen.

**Blackjack-Sidebets** (seit 23.09.2026, optional, 0 = keine). Beide werden
direkt nach dem Austeilen abgerechnet, egal wie die Hand ausgeht, und zaehlen
zur Bilanz der Runde. Quoten wie im Casino ueblich (X:1, also Einsatz ×
(X + 1) zurueck):

| Sidebet | Treffer | Quote |
|---|---|---|
| Perfect Pairs (eigene zwei Karten) | Mixed pair (andere Farbe) | 6:1 |
| | Colored pair (gleiche Farbe, andere Suit) | 12:1 |
| | Perfect pair (gleiche Suit) | 25:1 |
| 21+3 (eigene zwei + offene Dealer-Karte) | Flush | 5:1 |
| | Straight (A zaehlt unten und oben) | 10:1 |
| | Three of a kind | 30:1 |
| | Straight flush | 40:1 |
| | Suited trips | 100:1 |

Rueckzahlung per Simulation mit 6 Decks: Perfect Pairs ~94 %, 21+3 ~95 %,
also schlechter als die Haupthand – wie im echten Casino.

### ♠️ Poker (`poker.js`, Issue #1)

Texas Hold'em No-Limit, **Spieler gegen Spieler**. Es gibt keinen festen
Tisch, sondern **Lobbys, die Spieler selbst anlegen** (Wunsch Max,
23.09.2026): Poker-Kachel → Liste der offenen Tische (Name, Buy-in, Blinds,
wer sitzt) → „Join“ bzw. „Watch“, wenn voll. Unten „Create a table“:
Name (optional, bis 24 Zeichen), **Buy-in** (100–1.000.000, − / + oder
tippen) und 2, 4 oder 6 Plaetze; wer anlegt, sitzt sofort. Zuschauen darf
jeder, spielen nur mit Konto.

- Der **Buy-in ist je Lobby fest**, alle kaufen fuer denselben Betrag ein.
  Die Blinds folgen daraus: Big Blind = Buy-in / 100 (mind. 2), Small Blind
  die Haelfte. 1000 → 5/10, 100 → 1/2, 10.000 → 50/100.
- Eine Lobby **verschwindet von allein**, sobald keiner mehr zuschaut und
  keiner mehr sitzt (auch nicht als „mitten in der Hand gegangen“).
  Hoechstens 20 Lobbys gleichzeitig.
- Wer eine Lobby verlaesst, landet wieder in der Lobby-Liste.
- Schluessel intern `poker:ID` (`tableJoin {kind: 'poker:ID'}`), angelegt
  per `pokerCreate {buyIn, seats, name}`.

| Regel | Wert |
|---|---|
| Blinds | Buy-in / 100 als Big Blind, Heads-up ist der Dealer Small Blind |
| Buy-in | fest je Lobby, vom Konto; der Stack liegt am Tisch |
| Rake | keiner, alles geht an die Spieler |
| Start | ab 2 Spielern mit Chips, 3 s Pause, danach Hand auf Hand |
| Zugzeit | 20 s, dann Check, wenn moeglich, sonst Fold |
| Raise | Mindest-Raise = letzte Erhoehung (mind. Big Blind); jede Erhoehung oeffnet die Runde wieder, auch ein kurzes All-in (Vereinfachung) |
| All-in | Side-Pots je Stufe, Split mit Rest-Coin an den ersten links vom Dealer; kann keiner mehr setzen, kommen die Karten von allein (1,2 s je Street) |
| Showdown | Karten der Verbliebenen offen, beste 5 aus 7 gelb markiert, 7 s stehen lassen; bei Fold-Sieg nichts zeigen, 3,5 s |

- **Aufstehen**, Tisch verlassen, abmelden, Konto loeschen oder Verbindung
  weg: eine laufende Hand ist gefoldet (was im Pot liegt, bleibt dort), der
  Rest vom Stack geht sofort aufs Konto. Pleite (Stack 0) = nach der Hand
  vom Platz, neu einkaufen geht jederzeit.
- **Ein Konto, ein Platz** (zwei Tabs koennen nicht gegeneinander spielen).
- **Server-Neustart** (`deploy.sh`, SIGTERM): `tables.shutdown()` bucht alle
  Stacks plus die Einsaetze der laufenden Hand zurueck aufs Konto, die Hand
  gilt als nicht gespielt. Ein harter Absturz (kein SIGTERM) verliert, was
  am Tisch liegt.
- Der Server mischt (ein Deck je Hand) und schickt jedem seine eigene Sicht:
  eigene Karten offen, fremde als `??` bis zum Showdown.
- Rechts „At the table“: Bilanz inkl. dem, was gerade am Tisch liegt.
- `node` mit einer Zufalls-Simulation geprueft (Coins bleiben ueber
  Hunderte Haende mit Side-Pots, Splits und Aufstehen erhalten); die
  Handbewertung (`best`, `eval5`) hat eigene Faelle fuer Rad-Straight
  A-2-3-4-5, Kicker und Split.

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

Verkehr (nur Optik): ein Auto je Spur, jede dritte Spur frei. Bis
23.09.2026 waren es zwei grosse Autos je Spur, das sah zu wuselig aus. Am
selben Tag behoben: wer direkt nach dem Tod neu startete, bekam das neue
Huhn als 💥 angezeigt, weil die verzoegerte Todes-Animation sich das Huhn
erst nach 430 ms per ID holte. Jetzt haelt sie das tote Huhn selbst fest.

### 🔻 Plinko

Kugel faellt durch ein Nagelbrett mit **fest 16 Reihen**, je Reihe 50/50
links oder rechts, unten landet sie in einem von 17 Faechern
(binomialverteilt). Stufe Low, Medium oder High. **Der Server wuerfelt den
ganzen Pfad** (`plinko {bet, risk}`) und bucht Einsatz und Gewinn sofort; der
Browser spielt den Pfad nur ab und zieht den Gewinn erst bei der Landung auf
die Anzeige. Mehrere Kugeln duerfen gleichzeitig fallen, der Server nimmt
hoechstens alle 120 ms eine an. Die Stufe ist gesperrt, solange noch eine
Kugel faellt.

Die Multis sind fest vorgegeben (Wunsch Max, 23.09.2026: gerade Zahlen, wie
bei den bekannten Plinko-Automaten). Faecher von aussen nach innen, die
andere Haelfte gespiegelt:

| Stufe | Faecher (Rand → Mitte) | RTP |
|---|---|---|
| Low | 16 · 9 · 2 · 1,4 · 1,4 · 1,2 · 1,1 · 1 · **0,5** | 99,00 % |
| Medium | 110 · 41 · 10 · 5 · 3 · 1,5 · 1 · 0,5 · **0,3** | 98,99 % |
| High | 1000 · 130 · 26 · 9 · 4 · 2 · 0,2 · 0,2 · **0,2** | 98,98 % |

Angezeigt wie im Vorbild: `1K`, `130`, `26`, `9,0`, `0,2`. Farbe je Stufe:
Low blau, Medium gruen, High lila, zum Rand hin heller. Die erste Fassung
(Commit `4af27a8`) hatte 8–16 Reihen mit errechneten Tabellen.

**Mindesteinsatz 10** (sonst ueberall frei): Gewinne werden abgerundet, bei
Einsatz 1 zahlt ein ×0,2-Fach 0 Coins.

Bedienung: DROP oder **Leertaste**, AUTO wirft 10/25/50/100 Kugeln im
Abstand von 260 ms und stoppt bei zu wenig Coins. Rechts die letzten 8
Faecher (auf dem Handy ausgeblendet). Ab ×100 (und mindestens 1000 Coins)
geht eine Zeile in den Feed, wie ueblich erst nach der Landung. Wer den
Screen mitten im Fall verlaesst, bekommt die Anzeige sofort verbucht
(gerechnet hat der Server ohnehin schon).

## 🔫 Arena: Extraction-Raids (seit 23.09.2026)

Ersetzt die drei Arenen (Free / 100 / 1k je Leben, Kopfgeld-Escrow) von
#7/#12. Idee von Max: Loadout bauen, rein in eine grosse Map, Beute machen,
an einem Extraction-Punkt raus – wie Arc Raiders. **Nur mit Konto.**
Runde 2 am selben Tag (Feedback Max): normale Namen, Effekte sehr selten,
Grade-System, vier Ruestungsslots mit Sets, Granaten, Verstecken,
Regeneration, Raid-Inventar, Salvage mit Mehrfachauswahl.

Hauptmenue → Bereich „Arena“ → **Enter the arena** oeffnet den Hub mit vier
Tabs:

| Tab | Inhalt |
|---|---|
| 🪂 Play | Loadout-Ueberblick, **Deploy**, Ergebnis des letzten Raids |
| 🎒 Equip | nur das Loadout: 2 Waffen, Helm, Weste, Hose, Schuhe, **Rucksack**, zwei Verbrauchsgut-Slots (Q/G). Klick auf einen Slot oeffnet darunter die passende Auswahl (nach Score sortiert), Klick ruestet aus, „Take off“ legt ab |
| 📦 Inventory | alle Items als Liste, Filter je Art/Slot; Klick zeigt alles zum Item mit Ausruesten und Salvage |
| Drag & Drop (seit 3.2) | Im Equip-Tab steht ohne offene Auswahl das Lager (mit Filtern); Items auf passende Slots ziehen (passende leuchten gestrichelt), einen Slot zurueck aufs Lager ziehen legt ab. Im Raid-Inventar (Tab) gleich: Rucksack auf Waffen/Ruestung/Rucksack/Q/G, Ausgeruestetes zurueck in den Rucksack. HTML5-DnD, also Maus; auf dem Handy bleibt das Antippen |
| ♻️ Salvage | Knoepfe „alle Common/Uncommon/Rare/Epic“ (ohne Ausgeruestetes und Verbrauchsgut, Scrap-Wert vorab) und Mehrfachauswahl |
| 🎁 Cases | Standard, Mage, Demolition, Elite, Sovereign, Scrap – mit Chancen je Stufe; CS-Band mit 34 Feldern, Treffer auf Feld 29 |
| 🛒 Shop | Grundwaffen, Bandage, Medkit, Frag, Smoke (×1 oder ×5) und Daypack fuer Coins; Verbrauchsgut und „Waffe mit Zufallseffekt“ fuer Scrap. Keine Ruestung |

**Anzeige (Wunsch Max, Runde 4):** Karten und Listen zeigen kompakt
„Rare · ⚡ 66.7k“, Sets nur als Kuerzel [J]. Alles andere – „1 in X“,
Werte, Set-Boni, Effekte – steht im **Tooltip beim Drueberfahren** und in der
Detailansicht.

### Items (`arena-items.js`, Runde 3)

- **Stufen werden je Quelle gewuerfelt** (Common, Uncommon, Rare, Epic,
  Legendary, Mythic, ✦ Ultra rare). Jede Stufe gibt +0/5/10/16/24/34/50 %
  Schaden bzw. HP. Die Chancen stehen im Hub an jedem Case:

| Case | Preis | Rare | Epic | Legendary | Mythic | Ultra |
|---|---|---|---|---|---|---|
| Standard | 1.000 | 12 % | 1 in 34 | 1 in 5.000 | – | – |
| Mage / Demolition | 3.000 | 20 % | 1 in 14 | 1 in 1.000 | 1 in 200.000 | – |
| Elite | 10.000 | 40 % | 20 % | 1 in 400 | 1 in 20.000 | 1 in 200.000 |
| Sovereign | 100.000 | 35 % | 63 % | 1 in 60 | 1 in 1.000 | 1 in 10.000 |
| Scrap | 60 Scrap | 1 in 18 | 1 in 204 | 1 in 10.000 | – | – |
| Kiste im Raid | – | 1 in 11 | 1 in 53 | 1 in 1.000 | 1 in 100.000 | – |

- **Basen ab einer Stufe:** Zu einer gewuerfelten Stufe kommen nur Basen bis
  zu dieser Stufe in Frage, je hoeher die eigene Stufe der Basis, desto
  wahrscheinlicher (Gewicht 4^Stufe) – oben setzen sich die Specials durch.
  Mage- und Demolition-Case ziehen zu 75 % aus ihrem Thema.

| Ab | Waffen | Ruestung (Set) | Verbrauchsgut |
|---|---|---|---|
| Common | Pistol, SMG, Shotgun, Rifle, Sniper, 🪄 Apprentice wand | Scout, Soldier | Bandage, Medkit, Frag, Smoke |
| Uncommon | Revolver | Medic | Stim, Molotov, Flashbang |
| Rare | Golden Deagle, Crossbow, Fire staff, Frost staff | Juggernaut, Archmage | Trauma kit, Fireball scroll |
| Epic | Minigun, Launcher, **Flamethrower**, Storm staff | – | Cluster bomb, Frost nova, Blink scroll |
| Legendary | **Railgun**, Arcane orb | **Phantom** (4 Teile: unsichtbar nach 1,5 s Stillstand) | Phoenix elixir |
| Mythic | **Fat Boy** (Nuke-Werfer), Staff of the Archmage | **Titan** (+150 HP, 25 % Dornen) | **Tactical nuke** |
| Ultra | **Singularity** | – | **Black hole** |

  Staebe und manche Specials haben eingebaute Effekte (`innate`, z. B.
  Crossbow durchschlaegt 2, Arcane orb sucht Ziele).
- **Effekte (Mods)** sind ein Zusatz, **fuer jede Stufe und jede Quelle gleich
  selten**: ~10 % einer, ~1 % zwei, 0,05 % drei (`EFFECT_N`). Sie aendern die
  Stufe nicht, aber „1 in X“ und den Score.
- **„1 in X“** = Stufen-Wert (Common 1, Uncommon 3, Rare 10, Epic 50,
  Legendary 2.500, Mythic 100.000, Ultra 1.000.000) × Effekt-Faktor
  (1 / P(mindestens so viele Effekte) × 1,5 je Effekt-Stufe ueber I). Beispiel:
  Uncommon mit zwei Effekten ≈ 1 in 300.
- **Item-Score (⚡):** so viele Coins gibt man im Mittel aus, bis ein Case
  etwas mindestens dieser Stufe bringt (guenstigster Case), × Effekt-Faktor.
  Shop-Ware: ihr Preis. Grob: Common 1k, Rare 6,7k, Epic 33k, Legendary 3M,
  Mythic 91M, Ultra 1B.
- **Ruestung:** vier Slots × sieben Sets (Werte je Set auf die Teile verteilt,
  Helm 25 %, Weste 40 %, Hose 20 %, Schuhe 15 %); Boni ab 2 und 4 Teilen:
  Scout Tempo/Dodge, Soldier Schaden/Feuerrate, Medic Regeneration und
  doppelte Heilung, Juggernaut HP/weniger Schaden, Archmage Feuerrate und
  zielsuchende Kugeln, Phantom Dodge und Unsichtbarkeit, Titan HP und Dornen.
  **Ruestung gibt es nicht mehr im Shop**, nur aus Cases und Kisten.
- **Verbrauchsgut** liegt in **zwei Slots (Q und G)**, je Slot ein Stapel einer
  Sorte (Stapelgroesse je Sorte). Wuerfe und Blink zielen auf den Mauszeiger.
  Flashbang blendet alle mit Sicht, Nuke (3 s Zuender, 420 Radius, Waende
  schuetzen nicht), Black hole (zieht 1,6 s alle heran, dann 220 Schaden).
- **Migration:** Items aus Runde 1/2 werden beim ersten Hub-Aufruf
  umgestellt (Grade faellt weg, Medkits/Granaten werden Verbrauchsgut und
  wandern in die Slots, Seltenheit und Score neu). Achievements „Loot goblin“,
  neu „Mythical“ und „One in a million“ haengen an der Stufe (`stats.bestTier`).
- **Rucksaecke** (eigener Slot, Runde 4): ohne 12 Plaetze im Raid, Daypack 18
  (Shop, 500), Field pack 22, Assault pack 26, Expedition pack 32, Bag of
  holding 40 (Legendary), Void satchel 50 (Mythic). Einen kleineren nimmt man
  im Raid nur, wenn der Inhalt reinpasst.
- **Salvage** nach Stufe und Effekten (`salvageValue`), seit 3.1 etwa 40 %
  der alten Werte: Common 6, Uncommon 11, Rare 26, Epic 71, Legendary 206
  Scrap, je Effekt-Stufe +6; Verbrauchsgut 1 + 2 je Stufe, Rucksaecke
  4 + 3·3^Stufe. Mehrfach-Salvage fragt immer nach (Menge und Scrap).
- Nachrechnen: `node arena-items.js 400000` (Stufen je Quelle, Effekt-Anteil,
  haeufigste Specials).

### Raid (`shooter.js`)

- **Map** 4000 × 2800, fest aus Seed 1337: 16 Gebaeude mit Tueren, 90
  Hindernisse (seit 3.1 nur Felsen und Mauern, die Kisten-Hindernisse sind
  weg, kleine Felsen steingrau), **60 Buesche**, 44 Loot-Kisten, 4 Extraction-Zonen in den
  Ecken. Beim Bau per Flood-Fill geprueft: alle Kisten und Zonen erreichbar.
- **Rein:** Loadout-Items verlassen das Lager. Ohne Primaerwaffe gibt es die
  **Starter-Pistole** (gratis, geht nie verloren). Spawn weit weg von Zonen
  und anderen Spielern, 3 s Schutz. Bis 24 Spieler.
- **Verstecken:** Wer in einem Gebaeude, Busch oder in Rauch steckt, wird
  Spielern ausserhalb **gar nicht geschickt** (kein Wallhack moeglich).
  Ausnahmen: naeher als 110 und 400 ms nach einem eigenen Schuss
  (Muendungsfeuer). Von aussen liegt ein Dach auf jedem Gebaeude, drinnen
  sieht man hinein; Buesche liegen ueber den Figuren. Oben steht
  „🌿 Hidden“, solange man versteckt ist.
- **Regeneration:** alle +1 HP/s nach 6 s ohne Schaden, dazu Mod und
  Medic-Set.
- **Bewegung** (`slide()` im Server, `shSlide()` im Browser, gleiche
  Logik): in 4-px-Schritten bis an die Wand, an Ecken bis 3/4 Radius
  seitlich vorbei statt haengenzubleiben. Weil Vorhersage und Server gleich
  rechnen, korrigiert der Server an Waenden nicht mehr (war das „Stocken").
- **Kisten 📦** (Taste F): seit 3.1 **nur Granaten und Heilung**, 1–2 Stueck
  aus der Quelle `crate` (`uses: ['heal','throw']`, Waffen, Ruestung und
  Rucksaecke gibt es dort nicht mehr – das Inventar lief zu schnell voll),
  danach 150 s zu.
- **👑 Boss „Raccoon King“:** alle 2–10 min, sonst hoechstens 8 min auf der
  Map. HP 5.000 + 2.500 je Spieler im Raid. Laeuft Wegpunkte ab, jagt den
  naechsten sichtbaren Spieler in 700 (Versteckte sieht er nicht), Dreier-
  Salve (16 je Kugel), alle 9 s ein Ring aus 20 Kugeln, Stampfer (70 in 250,
  0,9 s rot angekuendigt), Beruehrung 45/s. Stirbt er, fallen **3 Beutel mit
  je einem Item aus der Quelle `boss`** (Sovereign-Stufen, nur Waffen,
  Ruestung, Rucksaecke) – wer zuerst da ist, hat sie. Alle sehen ihn auf der
  Minimap, als Pfeil am Bildrand und die Lebensleiste oben. Statistik
  `bossKills`.
- **🪂 Versorgungsabwurf:** alle 3–6 min, 15 s vorher angekuendigt (Zielkreis,
  Minimap, Pfeil), dann ein Beutel mit 2–3 Items aus `airdrop` (etwas besser
  als die Standard-Case, nur Ausruestung).
- Leerer Raid setzt beide Uhren zurueck. Test-Hook (nur `SNAKE_TEST=1`):
  `shTestEvent {boss, drop, bossHp}`. Verbrauchsgut stapelt sich (Medkits bis 6,
  Granaten bis 4 je Sorte), alles andere in den Rucksack (20).
- **Raid-Inventar** (Tab oder I, auf dem Handy 🎒), mittig im Stil von Apex:
  oben die zwei Waffen gross, in der Mitte der Rucksack als Raster (freie
  Felder, dahinter gesperrte 🔒 bis zur naechsten Rucksack-Groesse), unten
  Helm, Weste, Hose, Schuhe, Rucksack und Q/G. Drueberfahren zeigt alles zum
  Item, Klick waehlt aus; dann ausruesten (das Alte wandert in den Rucksack),
  ablegen oder fallen lassen (als Beutel vor die Fuesse).
- **Specials sehen und klingen nach was** (Runde 4, Max: „Railgun ist wie
  ne Deagle“): Railgun ist ein sofortiger Strahl (3000 weit, durch Waende und
  alle Gegner auf der Linie, 250 Schaden, `shBeam`) mit Leuchtstrahl,
  Wackeln und Lade-Zap. Fat Boy ist eine Mini-Nuke (☢ mit Rauchspur, 300
  Radius, 480 Schaden, trifft auch den direkt Getroffenen) mit Feuerball,
  Druckwellen, Rauchpilz, Bildschirmblitz und Grollen. Singularity reisst
  bei jedem Einschlag ein schwarzes Loch auf. Epic und hoeher ziehen
  Leuchtspuren in Stufenfarbe (Ultra: Regenbogen), der Launcher fliegt als
  Rakete, Staebe schiessen leuchtende Element-Kugeln; Minigun, Launcher und
  Staebe haben eigene Toene; Phoenix und Black hole eigene Effekte; Titan-
  und Phantom-Set eine Aura.
- **Brennen und Feuerflaechen** sind seit Runde 4 leise: keine Trefferzahlen,
  kein Ton, kein Wackeln je Tick – nur der Getroffene sieht einen roten Rand
  (`me.burn`); ueber brennenden Figuren ein duenner oranger Ring.
- **Tod:** Der Killer bekommt **alles** – Ausruestung, Verbrauchsgut,
  Rucksack –, soweit er es tragen kann; der Rest faellt als 💰-Beutel
  (5 min, Taste F). Ohne Killer (Verlassen, Verbindung weg) faellt alles als
  Beutel. **Verlassen = Tod** (Entscheidung Max).
- **Extraction:** 6 s in einer 🚁-Zone stehen. Danach landen Ausruestung,
  Verbrauchsgut und Rucksack im Lager und das Mitgebrachte wieder im
  Loadout; was ueber 80 hinausgeht, wird automatisch zu Scrap.
- **Server-Neustart** (SIGTERM): `shooter.refundAll()` extrahiert alle still.
- **Effekte im Kampf:** Crit, Vampir, Brennen, Frost, Tesla (`shZap`),
  Explosion (`shBoom`), Homing, Ricochet, Execute; Ruestung: Dodge, Thorns,
  Regeneration; Sets wie oben.

**Steuerung:** WASD/Pfeile laufen, Maus zielt, Klick/Leertaste schiesst,
1/2 oder Mausrad Waffe, Q und G Verbrauchsgut (auf den Mauszeiger), F (oder E)
Kiste/Beutel, Tab/I Inventar. Schuesse klingen seit Runde 3 dumpfer (Tiefpass, schnelle Waffen leiser). Touch: zwei Sticks, dazu Knoepfe
🔄 💉 ✋ 💣 🎒. Minimap mit Waenden, Gebaeuden, Bueschen, Zonen und
Sichtfenster.

Netzcode: eigene Bewegung wird vorausberechnet und mit Totzone (14
Einheiten) an den Server-Stand von vor einer Laufzeit angeglichen, andere
50 ms verzoegert interpoliert, Kugeln weitergerechnet. Der Server schickt je
Spieler nur, was in Sichtweite (`VIEW` 1400) und nicht versteckt ist.

**Speicher:** `u.arena = { inv, loadout: { primary, secondary, helmet,
vest, pants, boots, util: [{ base, n } | null, …] }, scrap, v: 3 }`.
Statistik: `raids`, `arenaExtracts`, `shooterKills`, `shooterDeaths`,
`casesOpened`, `bestOdds`, `earned.shooter`. Die Bestenliste „Arena kills“
zaehlt ueber `periods.arenaKills`.

**Test-Hook** (nur `SNAKE_TEST=1`): `shTp {x, y}` versetzt die eigene Figur
und hebt den Spawnschutz auf.

## Mini-Events (Snake)

Alle 90–180 s (das erste nach 45–75 s) taucht eine **3 × 3 grosse 🎪
EVENT-Kiste** auf: bunt, pulsierend, mit Ringen, auf der Minimap markiert.
Wer mit dem Kopf in die Kiste faehrt, startet ein Event fuer alle, die gerade
auf dem Feld sind. Ausgelost wird aus sieben Arten: vier Quiz-Runden (unten)
und drei **Map-Events** (seit 23.09.2026, Issue #6, `minigames.js`), bei
denen alle auf eine eigene kleine Map wechseln und dort als Schlange ein
Minispiel spielen:

| Map-Event | Map | Zeit | Ziel | Punkte |
|---|---|---|---|---|
| 🌀 Labyrinth | 21 × 21, zufaellig generiert, mit ein paar Extra-Durchbruechen | 90 s | zuerst zum 🏁. Waende blocken nur, andere faehrt man durch | Ankunft 900, 750, 600 … (mind. 300); wer nicht ankommt, bis 300 nach Restweg |
| 🪙 Coin Rush | 36 × 26, Rand und 6 Bloecke | 60 s | Muenzen sammeln (jede laesst wachsen) | 25 je Muenze; Crash = 2 s Pause, Muenzen bleiben |
| ⚡ Last Snake Standing | 40 × 28, Rand und 3 Bloecke | 90 s | Tron: jede Spur bleibt, wer reinfaehrt, ist raus | Letzter 800, dann −200 je Platz (mind. 100) + 5 je Sekunde; allein 15 je Sekunde (max. 800) |

- Steuerung wie im Spiel (Pfeile/WASD, Steuerkreuz). Der Server leitet
  `direction` waehrend eines Map-Events an das Minispiel um
  (`events.direction`), die eigene Schlange in der Hauptwelt steht.
- 5 s Intro mit Regeln und Map-Vorschau, dann laeuft es; vorbei, wenn die
  Zeit um ist, alle am Ziel sind bzw. beim Tron nur noch einer lebt.
- Der Server rechnet alle Schritte (110–130 ms) und schickt je Schritt eine
  kompakte `mg`-Nachricht an die Mitspieler; die Map (Waende, Ziel) kommt
  einmal mit der `event`-Nachricht (`data.map`).
- Belohnung wie bei den Quiz-Events (Formel unten), danach Podium und
  Double or Nothing.

Fuer alle Events gilt:

- Das Spiel friert fuer alle ein, Effekt-Timer, Duelle und Muenzwuerfe ruhen.
  Laufende Cashouts brechen ab.
- Jeder Teilnehmer sieht das Event mit eigener Event-Rangliste. Wer im Menue
  oder Casino ist, spielt nicht mit.
- Am Ende **Coins = (Punkte × 0,5 + Platz-Bonus) × Spielerfaktor** fuer
  Konten, Platz-Bonus 250 / 120 / 60 fuer die Top 3 (nur mit Punkten).
  Spielerfaktor 1 + 0,5 je weiterem Teilnehmer, hoechstens ×3 (2 Spieler
  ×1,5, 3 ×2, ab 5 ×3). Beispiel: Sieger mit 749 Punkten bei 2 Spielern =
  (374 + 250) × 1,5 = 936. **Laenge = Punkte / 12** fuer alle (749 Punkte →
  +62), dann 5 s **Podium** mit den Top 3. Geschichte: bis 23.09. mittags
  Punkte / 10 Coins; Issue #4 hob auf ×1,5 und Boni 750/400/200 (Sieger
  ~2800); am Abend desselben Tages auf ein Drittel zurueck, weil zu stark
  (Max), dafuer Laenge von Punkte / 40 auf Punkte / 12.
- Dann **Double or Nothing** fuer jeden, der etwas gewonnen hat: 50/50 per
  Muenzwurf, 15 s Bedenkzeit, ohne Antwort wird behalten. Wer noch ueberlegt
  oder wirft, bleibt eingefroren und ist fuer die anderen ein durchsichtiger
  Geist. Wer ablehnt oder fertig geworfen hat, bekommt **3 s Countdown und
  bleibt so lange eingefroren** (laeuft die Event-Pause noch, ab deren Ende).
  Bis 23.09.2026 fuhr man sofort los, waehrend der Countdown noch lief.
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
- **Bestenliste** (nur Konten, dynamisch seit 23.09.2026, Issue #8):
  Auswahl **Kategorie** (⭐ Score, 🪙 Coins, 🗡️ Kills, 💰 Biggest win,
  ✖️ Biggest × je Spiel, 🎰 Casino net, 🎪 Event wins, 🔫 Arena kills),
  bei Biggest × das **Spiel** (Starlight, Slots, Plinko, Crossy, Roulette,
  Blackjack, Poker) und der **Zeitraum** Today / Week / All time (Coins nur
  All time). Die Auswahl merkt sich der Browser (`localStorage`).
  Score/Coins/Kills „All time“ kommen wie bisher per Broadcast
  (`highscores`); alles andere holt der Browser gezielt (`board {cat, game,
  period}`, hoechstens 30/min je Verbindung) und frischt es alle 10 s auf.
  Werte aus `stats` bzw. `stats.periods` (#5); versteckte Gewinne tauchen
  erst nach der Animation auf, weil sie erst dann verbucht werden.
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

## iPad und Handy

Auf Touch-Geraeten (`pointer: coarse` oder `maxTouchPoints`) bekommt `body`
die Klasse `touch`, beim Spielen dazu `playing`.

- **Steuerkreuz** (▲◀▶▼): liegt halbtransparent unten links auf dem Feld. Auf
  dem Handy im Hochformat (≤ 820 px) sitzt es **unter** dem Feld, damit es
  nichts verdeckt. Reagiert auf `pointerdown`, also sofort, mit kurzer
  Vibration.
- **💰-Knopf** zum Gedrueckthalten = Cashout, wie die Leertaste. Das alte
  „lange aufs Feld druecken“ ist weg, es kam dem Lenken in die Quere.
- **Wischen** auf dem Feld lenkt schon waehrend der Bewegung, alle 22 px neu.
  So gehen mehrere Kurven ohne abzusetzen. Frueher kam die Richtung erst beim
  Loslassen.
- `touch-action: none` auf Feld und Steuerung: kein Scrollen und kein Zoom
  durch Doppeltippen beim Spielen. Eingabefelder mit 16 px, damit iOS nicht
  hineinzoomt.
- **≤ 820 px Breite:** Menue, Casino, Slots, Events und Tickets liegen als
  Vollbild ueber allem statt im Feld. Die Casino-Kacheln stehen zweispaltig,
  der Starlight-Kopf bricht in zwei Zeilen um.

Geprueft mit Playwright-Emulation (iPhone 13 hochkant, iPad Pro 11 quer):
Steuerkreuz, Cashout-Halten und Wischen senden die richtigen Nachrichten.

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

## Patch notes

Rechts unter dem Chat steht das Panel **📝 Patch notes**, gespeist aus
`public/patchnotes.json` (neueste oben, offen; der Rest zugeklappt). **Jede
Runde, die live geht, bekommt dort einen kurzen Eintrag** – englisch, eine
Zeile je Aenderung, kein Fliesstext (Wunsch Max, 23.09.2026). Der Eintrag
gehoert in denselben Commit wie die Aenderung.

**Versionen** statt Titeln (Max): normale Runde = +0.1 (2.1 → 2.2), grosse
Aenderung = naechste Hauptzahl (2.x → 3.0). Stand 23.09.2026 abends: 3.0
(neuer Name, Domain, Menue).

## Name und Adresse

Seit 23.09.2026 heisst das Spiel **Kek-Game** (vorher „Snake and Gamba“).
Neue Adresse `game.flashkeks.com`; `snake.flashkeks.com` soll danach per 301
dorthin zeigen. Dafuer gibt es `SNAKE_CANONICAL_HOST` (z. B.
`game.flashkeks.com`): ist er gesetzt, leitet der Server jeden anderen Host
ausser localhost um (WebSockets sind nicht betroffen). Erst setzen, wenn der
neue Name in DNS und Tunnel steht – sonst ist das Spiel weg.

## Bedienung allgemein

**ESC** fuehrt ueberall eine Ebene zurueck (Casino-Spiele → Casino → Menue,
Arena-Hub → Menue, Shop, Konto, Support). Im Arena-Hub schliesst ESC erst
die offene Slot-Auswahl. Im Raid schliesst ESC nur das Inventar – den Raid
zu verlassen waere Tod.

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

**Konto-Dialog (Admin v2, 23.09.2026)** – „Manage“ oeffnet vier Tabs:

| Tab | Was geht |
|---|---|
| 💰 Coins | wie bisher: geben, nehmen, setzen, Daily zuruecksetzen, abmelden, loeschen |
| 🎨 Cosmetics | Besitz je Kategorie; einzeln geben, geben + anlegen, anlegen/ablegen, wegnehmen; alle 134 geben oder alle nehmen. Aenderungen kommen sofort beim Spieler an (`account`) |
| 🎰 Luck | garantierter Mindestgewinn fuer die naechsten N Runden (`u.rig`, `luck.js`): Slots (Drilling mit Quote ≥ Ziel wird gebaut), Budget Starlight fuer Spins und Bonus Buy (neu gewuerfelt bis ≥ Ziel, optional „Freispiele muessen kommen“; Zeitbudget 0,4 s, sonst der beste Versuch), Plinko (Fach ≥ Ziel, Pfad passend gebaut), Daily Wheel (neu gedreht), Crossy Road (N Laeufe ohne Unfall). Jede Runde verbraucht eins; der Spieler sieht nichts davon (`u.rig` geht nie an den Browser) |
| 🔫 Arena | Scrap setzen; Item bauen (Art, Basis, Grade, bis zu drei Effekte mit Stufe, Anzahl) – die Seltenheit wird wie bei einem echten Drop berechnet; Lager ansehen, einzeln/ausgewaehlt loeschen, leeren |

Im Coins-Tab gibt es **„Reset (keep achievements + cosmetics)…“** – wie
unten, aber Achievements, Titel und Cosmetics bleiben (`reset-soft`) – und
**„Reset EVERYTHING…“** (beide: Name eintippen zur Bestaetigung): Coins zurueck auf 100, Statistik, Achievements, Titel,
Cosmetics, Arena-Lager, Daily und Luck weg; Name, Passwort, Farbe und
Sessions bleiben. Laufende Runden (Feld, Tisch, Raid, Crossy) werden vorher
beendet, der Spieler bleibt angemeldet. API: `POST /api/users/KEY/reset-all
{confirm: NAME}`.

Tischspiele (Roulette, Blackjack, Poker) haben kein Luck: die Tische sind
geteilt, ein erzwungenes Ergebnis traefe alle am Tisch.

API (alles JSON): `GET /api/overview`, `GET /api/users`,
`POST /api/users/KEY/coins {delta | set, note}`, `POST /api/users/KEY/reset-daily`,
`POST /api/users/KEY/logout-all`, `POST /api/users/KEY/reset-all {confirm}`, `DELETE /api/users/KEY {confirm: NAME}`,
`GET /api/tickets`, `GET /api/tickets/ID`, `POST /api/tickets/ID/reply {text}`,
`POST /api/tickets/ID/status {status}`, `GET /api/log`,
`GET /api/catalog` (Cosmetics, Arena-Basen und -Effekte, Luck-Spiele),
`GET /api/users/KEY/detail`, `POST /api/users/KEY/cosmetics {op: give|take|equip|unequip|giveAll|takeAll, id}`,
`POST /api/users/KEY/luck {game, n, min, bonus}` (n = 0 loescht),
`POST /api/users/KEY/arena {op: give|delete|scrap|clear, …}`. Alles davon
landet im Admin-Log.

## Tests

Nur lokal, nie auf `edge` setzen:

- `SNAKE_TEST=1` schaltet dazu `shTp {x, y}` frei (Raid-Figur versetzen).
- `SNAKE_TEST=1` schaltet dazu `testGrow {n}` frei (eigene Schlange waechst um
  n, z. B. um Score > 5000 zu pruefen).
- `SNAKE_TEST=1` schaltet die Nachrichten `testEvent {kind}` (startet sofort
  ein Event: `flags`, `trivia`, `geo`, `estimate`, `maze`, `coinrush`,
  `tron`) und
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
`tableAction` (`bet`/`clear` beim Roulette, `bet`/`pp`/`t3`/`clear`/`move`
beim Blackjack, `sit {seat?}`/`stand`/`move` (`fold`, `check`,
`call`, `raise {to}`, `allin`) beim Poker), `pokerCreate {buyIn, seats, name}`, `daily`, `dailyDone`, `crossStart {bet, diff}`, `crossStep`,
`crossCash`, `plinko {bet, risk}`, `board {cat, game, period}`, `me`, `shJoin`,
`shInput {mx, my, a, f, s}`, `shSlot {slot}`, `shMed`, `shInteract`, `shUse {slot: 0|1, x, y}`, `shInv {op: equip|unequip|drop, uid, slot}`, `shPing {t}`, `shLeave`, `arHub`, `arBuy {id, n}`, `arCase {id}`, `arSalvage {uids}`, `arEquip {slot, uid|null, n, base}`, `shopRot`, `shopBuy {id}`, `shopEquip {cat, id|null}`, `setTitle {id|null}`, `tickets`, `ticketNew {subject, text}`, `ticketReply {id, text}`,
`ticketRead {id}`.

Server → Client: `welcome`, `mg` (Schritt im Map-Event), `sh`, `shJoined`
(mit Map und Waffen), `shLeft` (Bilanz, Rueckgabe), `shKill`, `shHit`, `shHurt`,
`shLoot`, `shInv`, `shBoom`, `shFx`, `shFlash`, `shZap`, `shPong`, `shRooms`, `shError`, `arHub`, `arError`, `shopOk`, `shopRot`, `shopError`, `deathfx`, `achievement`, `auth`, `authError`, `authExpired`, `account`,
`joined`, `joinError`, `left`, `died` (`cause`, `by`, `byId`, `at`), `swapfx`, `cashedout`, `cashoutCancel`, `state`
(alle 60 ms, mit `arena` und `paused`), `duel`, `gamble`, `box`, `jackpot`,
`feed` (mit `who` und `big` fuer den Sound), `chat`, `chatlog`, `highscores`, `board`,
`spin`, `spinError`, `spin2`, `spin2Error`, `event`, `eventEnd`, `eventError`, `resume`,
`table` (Tisch-Zustand, nur an die am Tisch, mit `you`), `tableLeft`,
`tableError`, `lobby`, `daily`, `dailyError`, `cross` (`state`: run, dead,
cashed), `crossError`, `plinko` (`path`, `slot`, `mult`, `win`, `balance`),
`plinkoError` (`quiet` bei zu schnellen Drops), `tickets` (`list`, `unread`, `open`), `ticketError`. `welcome` bringt dazu `wheel`, `cross`, `plinko` (Reihen, Stufen, Tabellen) und `lobby`.

Die Oberflaeche ist seit 23.09.2026 englisch, diese Doku bleibt deutsch.

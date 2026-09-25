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
| `km-battle.js` | Kekémon-Kampflogik (3 gegen 3, Energie, Effekte, KI) ohne Netz – testbar per Simulation |
| `km-gyms.js` | Die 8 KI-Arenen: Leiter-Teams, Freischalten, Belohnungen, Fortschritt `u.kmGyms` |
| `cards-moves.js` | Kekémon: Attacken je Figur (SIG) und je Serie (FRAN) |
| `cards.js` | Kekémon (5.0): Karten aus Rohdaten rechnen (Typ, Seltenheit, Werte, Attacken — deterministisch aus der Id), Packs, Katalog fuer den Browser |
| `tools/cards/build.js` | holt die Kartendaten (AniList, Superhero-API, TVMaze) nach `DATA_DIR/cards-raw.json`; `tools/cards/fixture.json` ist eine kleine Stichprobe fuer lokale Tests |
| `public/kekemon.js`, `public/kekemon.css` | Kekémon im Browser: Karten-Look, Pack-Oeffnen, Album |
| `assets.js` | Markt (5.2): handelbare Gueter (Arena-Item, Karte, Cosmetic) pruefen, nehmen, geben, anzeigen |
| `market.js` | Auktionshaus: Sofortkauf/Auktion, Treuhand, Gebote, Abholfach, Ablauf; `DATA_DIR/market.json` |
| `trade.js` | Direkter Handel zwischen zwei Spielern (vorher `arena-trade.js`), jetzt mit Karten und Cosmetics |
| `lobby.js` | Markt-Lobby: Positionen annehmen (Tempo/Grenzen pruefen), zehnmal pro Sekunde verteilen |
| `public/market.js`, `public/market.css` | Markt im Browser: Auction Hall, Lobby-Canvas, Handelsfenster, Einladungen |
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


**Coin-Kurve (5.5, Max):** Der Score bleibt unbegrenzt, beim Cashout gibt es
aber nur bis 10 000 eins zu eins Coins (`cashCoins` in `server.js`, gleiche
Formel im Browser fuer die HUD-Anzeige). Darueber Potenzkurve durch die
Stuetzpunkte 10k -> 10k, 100k -> 30k, 1 Mio -> 100k (Exponent log10(3) bis 100k,
danach log10(10/3)), glatt ohne Spruenge. Beispiele: 20k -> 13 919, 40k ->
19 375, 400k -> 61 933, 4 Mio -> 206 445. Anlass: 40k Laenge x 100 aus Double
or Nothing waren 4 Mio Coins. Statistik `totalCashout`/`bestCashout` zaehlt Coins.

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
  Seit 3.5 genauso bei **Groesster Gewinn** (`topWins` je Spiel und
  Zeitraum) und **Bester Multi** (`topX` je Spiel, je Zeitraum
  `topX[spiel]`), gefuellt in `accounts.game()`. Alte Staende ohne Listen
  stehen mit ihrem Bestwert drin.
  **Bug bis 3.5, behoben in 3.6:** eine fehlende Liste startete beim ersten
  neuen Spiel leer, der alte Bestwert (aus der Zeit vor den Listen) fiel
  damit vom Board (gemeldet: Starlight ×2265 von SINTHSBen weg). Jetzt
  startet sie mit dem alten Bestwert (`addRun(liste, bestwertVorher, wert)`),
  und `accounts.js` ergaenzt beim Start jede Liste, der ihr Bestwert fehlt
  (idempotent, meldet `N Leaderboard-Listen um den alten Bestwert ergaenzt`).
  Beim Herunterfahren (Deploy) werden noch versteckte Gewinne verbucht und
  laufende Snake-Runden gezaehlt, bevor gespeichert wird.
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
| ❓ Mystery-Box | 30, Nachschub nach 3–6 s | kleine Walze nur beim Finder, Wirkung nach 1,6 s. Seit 5.0 auch 🪙 Coins (Gewicht 8): 10 (40), 25 (25), 50 (15), 100 (10), 250 (5), 500 (3), 1000 (1,5), 2500 (0,45), 10 000 (0,05) — 10k also etwa 1 von 30 000 Boxen. Gaeste bekommen +5 Laenge statt Coins |
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
| gold ★ | ⭐ Stern 6 s (unverwundbar, gewinnt jedes Kopf-an-Kopf ohne Walze), 💎 Jackpot +50 (bis 3.4: +12) |
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

**Darstellung (seit 3.5):** der Tisch wird in Teilen aktualisiert
(`pkPatch`: Filz, Mitte, je Sitz ein Teil; nur geaenderte Teile werden
ersetzt). Vorher baute jedes Update den ganzen Tisch neu, dadurch starteten
Deal- und Glow-Animationen staendig neu (das „komische Blinken“). Neue Karten
bekommen ihre Animation erst nach dem Einsetzen (`pkAnimate`). Beim Gewinn:
Banner „YOU WIN“ mit Muenzregen und Fanfare, verloren ein kurzer tiefer Ton.

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

## 🔫 Arena: Aufbau seit 4.0

**Welt-Umschalter** oben unter dem Logo: 🐍 Snake (gruen) oder 🔫 Arena
(pink). Im Arena-Modus (`body.world-arena`) verschwinden Snake-Feld,
Seitenleisten und Legende, Hub und Raid fliessen als Vollseite statt als
Overlay. Waehrend einer Snake-Runde bzw. im Raid laesst sich nicht wechseln.
„Enter the arena“ im Games-Tab und ✕ im Hub schalten ebenfalls um.

**Hub-Tabs:** Play (Modus-Karten: Extraction aktiv, PvP und Zombies folgen)
· Inventory (Unter-Tabs Equip / List / Salvage, merkt sich den letzten) ·
Cases · Shop · Profile. Im Kopf steht das Level (Klick = Profil).

### 🎖️ Leveling (`arena-level.js`)

Wunsch Max: etwas zum Grinden, „extrem competitive und schwer zu leveln“.

- **XP** (`L.XP`): Spieler-Kill 90 (+10 je Level, das der Gegner hoeher
  ist), Todesstoss Boss 1.200, Boss-Schaden anteilig 500, Extraction 150 +
  15 je Item, Kiste 6, 20 je Minute im Raid (auch beim Tod). Veteran-Skill
  +5 %/Rang. Der Browser bekommt je Gutschrift `arXp` (Einblendung, Level-Up
  gross), ab jedem zehnten Level eine Feed-Zeile.
- **Kurve:** `xpNeed(L) = 250 · L^1,85`. Level 10 ≈ 53.500 XP (grob 80
  gute Raids), 20 ≈ 416k, 50 ≈ 5,9 Mio, Maximum 100. Nachsehen:
  `node arena-level.js`.
- **Stat-Punkte:** 2 je Level, je Stat hoechstens 50: Vitality (+4 HP),
  Defense (−0,6 % Schaden, gedeckelt 30 %), Carry weight (+1
  Rucksackplatz je 3), Agility (+0,4 % Tempo), Power (+0,6 % Schaden),
  Dexterity (+0,5 % Feuerrate), Recovery (+0,06 HP/s), Luck (+0,6 %
  Chance auf ein Extra-Item aus Kisten).
- **Skill Tree:** 1 Punkt je Level, 3 Aeste (Assault, Survival, Tactics) mit
  je 10 Knoten, 59 Raenge insgesamt, Voraussetzungen und Mindest-Level
  (12–50). Wirkung in `bonuses()`, angewandt in `gearStats()` bzw. an den
  Stellen im Raid (Crit, Executioner, Rampage, Last stand, Second wind,
  Adrenaline, Fireproof, Boss hunter, Extractor, Ghost, Grenadier, Looter,
  Scrapper im Hub).
- **Verteilen:** im Profil vormerken, „Save points“ schickt
  `arProg {op:'apply', stats, skills}`; der Server prueft die komplette
  Verteilung (`validate`: nur erhoehen, Voraussetzungen, Level, Punkte).
- **Reset:** alles zurueck, 50.000 Coins + 2.500 Scrap, jedes Mal ×1,5
  (`arProg {op:'reset'}`).
- Gespeichert am Lager: `u.arena.prog = { xp, stats, skills, resets }`.
- **Leaderboard:** Kategorie „Arena level“ (`alevel`, nur All time, nach XP).
- **Admin:** im Arena-Tab „Arena XP“ setzen (`op: 'xp'`); ausgegebene
  Punkte ueber dem neuen Level werden dabei zurueckgesetzt.

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

### Extraction-Ausbau (4.2)

- **Map** 7200 × 5000 (vorher 4000 × 2800), Seed 4242: 48 Gebaeude, 280
  Hindernisse, 190 Buesche, 130 Kisten, 6 Extraction-Zonen (Ecken und Mitte
  oben/unten). Reservierte Flaechen: **Stadt** (Mitte) und **Aussenposten**
  (links unten) mit je 🏪 Haendler und ⛑️ Sani, **Militaerlager** (rechts
  oben) als grosses Gebaeude mit drei 🎖️ Militaerkisten (`military`: nur
  Ausruestung, wie eine Standard-Case, 5 min zu).
- **Gegner** (`arena-mobs.js`, Logik `mobTick` in `shooter.js`): Scav
  (Gewehr), Brute (Nahkampf, verfolgt), Sniper (roter Laser 0,8 s vor dem
  Schuss, 34 Schaden), Drone (schnell, schwach), Enforcer (Elite, Schrot,
  bewacht das Lager, 4 Stueck, 3 min Respawn). Bestand 45 + 8 je Spieler
  (hoechstens 120), neue tauchen nur weiter als 1000 von Spielern auf.
  Gegner denken nur, wenn ein Spieler naeher als 1700 ist; Ziel suchen alle
  250–400 ms mit Sichtlinie (Versteckte sehen sie nur aus der Naehe),
  0,6–0,9 s Reaktionszeit. Wer auf einen Gegner schiesst, wird sein Ziel.
  Stadt und Aussenposten koennen sie nicht betreten (Schutzzonen), schiessen
  aber hinein. Drops als Beutel (`npcdrop`: meist Verbrauchsgut), XP 12 /
  Elite 60 (mal `xpMul`), Statistik `npcKills`.
- **Bosse** (einer zur Zeit, alle 2–10 min, nie zweimal derselbe
  hintereinander): Raccoon King (Salven, Kugelring, Stampfer), Iron Golem
  (sehr zaeh, explodierende Felsen, grosser Stampfer), Hive Queen (zielsuchende
  Kugeln, ruft bis 8 Drohnen). Beute wie gehabt: 3 Beutel aus `boss`.
- **Sani:** voll heilen fuer 40 Scrap aus dem Lager, 60 s Abklingzeit.
  **Haendler:** Verbrauchsgut gegen Scrap kaufen, Rucksack-Items fuer 60 %
  des Salvage-Werts verkaufen (`shTrade {op: buy|sell}`; Fenster schliesst
  beim Weggehen, ESC, oder `shTrader {close}` vom Server).
- Spieler spawnen nicht im/am Militaerlager und nicht naeher als 650 an
  Gegnern.
- Test-Hooks (`SNAKE_TEST=1`): `shTestEvent {boss: 'golem'|..., mob, dx, dy,
  clearMobs, bossHp, drop}`.
- Protokoll: `sh` hat jetzt `mobs` ([id, art, x, y, hp, max, winkel,
  zielt-ms]) und `boss` mit Art an Stelle 7; Kisten mit Militaer-Flag.

### ⚔️ PvP-Arena (4.3, `arena-rooms.js`)

- **Welten:** `shooter.js` kennt jetzt mehrere Welten (`makeWorld(map, w, h)`:
  Map + Wandtest + Rutschen). `createArena(h, opts)` baut eine Instanz mit
  `opts.mode` ('extract' Standard, 'pvp') und `opts.world`. Die Extraction
  ist die bisherige Einzel-Instanz, jedes PvP-Match eine eigene.
- **Maps:** vier kleine, spiegelsymmetrische Maps 2100 × 1300 (Courtyard,
  Depot, Crossing, Yard; `PVP_WORLDS`), Team 🔵 Blue links, 🔴 Red rechts.
- **Lobbys:** Play → PvP arena. Erstellen (1v1/2v2/3v3), einem Team
  beitreten, Team wechseln, verlassen. Sind beide Teams voll, startet das
  Match nach 5 s. Wer in einer Lobby ist, kommt nicht in die Extraction und
  umgekehrt. Lobby leert sich bei Logout/Verbindungsende.
- **Match:** Best of 5 (erste 3 Runden), 3 s Countdown (alle eingefroren),
  90 s je Runde; Zeit um: mehr Leben (anteilig) gewinnt. Tote warten auf die
  naechste Runde. Kein Beschuss unter Teamkameraden (Kugeln fliegen durch).
  Keine Kisten, Beutel, Gegner, Extraction.
- **Keine Verluste:** gespielt wird mit Kopien des Loadouts (Waffen,
  Ruestung, Verbrauchsgut bis zur Menge im Lager); jede Runde wieder voll.
  Level-Boni gelten.
- **Wertung:** Elo (K 32, Teamdurchschnitt), Start 1000, gespeichert in
  `u.arena.pvp = { rating, wins, losses, draws, kills, deaths }`. XP: Sieg
  300, Niederlage 80, Unentschieden 150, je Kill 60. Aufgeben/Verlassen
  zaehlt als Niederlage (−20). Leaderboard „PvP rating“.
- Protokoll: `pvpList`, `pvpCreate {size}`, `pvpJoin {id, team}`,
  `pvpSwitch`, `pvpLeave`; Server schickt `pvpLobbies`, im Match `sh.pvp =
  { round, score, phase, left, last, team }`, Spieler mit `tm`.

### 🧟 Zombies (4.4)

- **Lobby:** Play → Zombies, bis 4 Spieler in einem Team (`arena-rooms.js`,
  `kind: 'zombies'`). Der Host startet („Start now“), bei 4 Spielern geht es
  von selbst los. Eigene Instanz `createArena({mode: 'zombies'})` auf der Map
  „Kek Mall“ (2600 × 1800, offen, Saeulen und kurze Mauern).
- **Wellen:** Welle n: (6 + 4n) × (1 + 0,5 je weiterem Spieler) Zombies, HP
  ×(1 + 0,2 (n−1)), Nachschub von 12 Randpunkten (nicht direkt neben
  Spielern), hoechstens 22 + 4 je Spieler gleichzeitig. Ab Welle 2 Runner, ab
  3 Spitter (Fernkampf), ab 4 Tanks, jede 5. Welle die Abomination (Boss,
  ruft Runner). 12 s Pause zwischen den Wellen, 6 s vor der ersten.
- **Zombies** (`arena-mobs.js`, `zombie: true`) jagen immer den naechsten
  lebenden Spieler (keine Sichtlinie noetig), Spitter schiessen nur mit Sicht.
- **Punkte:** Start 500, je Treffer 10 (nicht fuer Brennen), Kill 60, Tank
  150, Boss 1000. **Stationen** (F): Wandwaffen (SMG 750, Shotgun 1000,
  Rifle 1400, Sniper 1500), Mystery Box 950 (zufaellige Waffe aus `elite`),
  Pack-a-Punch 5000 (bis Stufe 3, je Stufe ×1,6 Schaden, ×1,12 Feuerrate),
  Perks: Juggernaut 2500 (+100 HP), Rapid Fire 3000 (+25 % Feuerrate),
  Stamina 2000 (+15 % Tempo), Regeneration 1500 (Heilung nach 2 s, +2
  HP/s); bis 4.6 hiessen sie Jugger-Kek, Speed Kek, Stamina Kek, Quick Kek. Gekaufte Waffen: zweiter Slot, sonst ersetzt die aktuelle.
- **Tod:** raus bis zum Ende der Welle, dann zurueck. Alle tot = Ende.
- **Keine Verluste:** Kopien des Loadouts wie im PvP.
- **Belohnung:** XP je Welle (20 × n am Wellenende) und am Schluss
  40 × Wellen^1,35 (Welle 10 ≈ 900); Kills XP wie NPCs. Gespeichert in
  `u.arena.zombies = { bestWave, games, kills, coins }`, Leaderboard „Zombies: best
  wave“.
- **Coins (5.9):** am Spielende je Spieler (alle tot oder selbst verlassen),
  `zCoins()` in `shooter.js`: eigene Kills 5 (Tank 20, Abomination 250) plus
  Wellenbonus 50 × (1 + 2 + … + n) fuer n ueberstandene Wellen. Solo grob:
  Welle 5 ≈ 1,2k, Welle 10 ≈ 4k, Welle 20 ≈ 15k. Gebucht als
  `earned.shooter`, ab 5000 Coins eine Zeile im Feed. `shLeft` traegt `coins`.
- **Kill-Counter** je Spieler: `zb.kills` (Anzeige unten links im Spiel und
  im Game-Over-Screen), dazu `zb.kc` = Coin-Wert der eigenen Kills.
- Protokoll: `pvpCreate {kind: 'zombies'}`, `pvpStart`; im Spiel `sh.zmb =
  { wave, phase, left, zombies, pts, perks, team: [[name, pts, kills, tot]] }`.

### 4.6: Rueckmeldungen von Max

- **Extraction ohne Stationen:** Haendler, Sani, Stadt und Aussenposten sind
  wieder raus (die Beschreibung unter 4.2 ist insoweit ueberholt). Gegner,
  Bosse und Militaerlager bleiben. Der Haendler-/Sani-Code bleibt fuer
  spaeter liegen, die Map hat nur keine Stationen mehr.
- **Nahkampf-Treffer** (Brute, Zombies, Boss-Beruehrung) kommen je Tick;
  sie werden gesammelt und alle 350 ms als `shHurt {melee}` geschickt – roter
  Rand und rote Zahl ueber dem eigenen Kopf (auch fuer normale Treffer).
- **Boss-Angriffe:** Ansturm (`charge`: Warnbahn, dann schnell auf die Stelle,
  2,5× Beruehrungsschaden) fuer King, Queen, Abomination; Einschlaege
  (`strikes`: Warnkreise, dann Explosion, der erste genau aufs Ziel) fuer
  Golem (6 Felsen) und Abomination (Saeure); der King ruft Scav-Wachen.
  Formen im Browser (`drawBoss`): King mit Umhang, Golem als Fels mit Faeusten
  und gluehenden Augen, Queen als Biene mit schlagenden Fluegeln,
  Abomination als wabernder Blob.
- **Zombies:** am Wellenende alle voll geheilt, zwei 💉 Heal-Stationen (600
  Punkte, 25 s Abklingzeit), Stationen kleiner gezeichnet.
- **Ergebnis-Screen** (`shResult`): nach Tod, Extraction, PvP und Zombies
  ueber dem abgedunkelten letzten Bild – Titel, Todesursache mit Waffe, Zeit,
  Kills, XP des Laufs, verlorene bzw. gesicherte Items, „Deploy again“ /
  „Play again“ / „Back to the hub“ (ESC). `shLeft` schickt dafuer `kills`,
  `secs`, `weapon`.

### 🤝 Handel (4.5, `arena-trade.js`)

- Hub-Tab „Trade“: Anfrage an einen Namen (muss online sein, 60 s gueltig),
  der andere sieht sie in jedem Hub-Tab oben und im Trade-Tab.
- Nach dem Annehmen stellen beide ihr Angebot zusammen: bis 20 Items aus dem
  Lager (nicht aus dem Loadout), Scrap, Coins. Jede Aenderung nimmt beiden
  „Ready“ weg. Sind beide ready, tauscht der Server in einem Schritt, nach
  erneuter Pruefung (Besitz, Loadout, Coins/Scrap, Platz im Lager 100).
- Abbrechen, Offline gehen oder Logout beendet den Handel. Jeder Tausch
  landet als `trade: A ↔ B: …` im Journal von `snake.service`, Statistik
  `trades`.
- Protokoll: `trReq {name}`, `trAccept/trDecline {id}`, `trSet {items,
  scrap, coins}`, `trReady {on}`, `trCancel`, `trState`; Server:
  `trInvite`, `trState {me, them}`, `trClosed`, `trDone`, `trInfo`.

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

## 🃏 Kekémon (5.0)

Sammelkarten im Pokemon-Stil, eigene Welt im Umschalter oben (🃏) und im
Hauptmenue-Tab. Ausbau: 5.0 Karten, Packs, Album — 5.1 Varianten, neue Chancen, Kartentrick —
5.2 Kaempfe gegen KI-Arenen (3 gegen 3, Energie je Zug) — 5.3 PvP-Duelle und
Kartentausch.

**Daten.** `tools/cards/build.js` holt auf `edge` (als Deploy-User, Ziel
`/srv/snake-data/cards-raw.json`, damit im Backup) die Rohdaten:

| Reihe | Quelle | Menge | Rang |
|---|---|---|---|
| `anime` (AN) | AniList GraphQL, Charaktere nach Favoriten (MAL/Jikan war beim Bau down, gleiche Rangliste) | 1000 | Favoriten |
| `hero` (HV) | Superhero-API (akabab), Marvel/DC/Star Wars … mit powerstats | 563 | Summe der Kampfwerte |
| `tv` (TV) | TVMaze: Hauptcast der beliebtesten englischen Serien (Gewicht ≥ 97, Bewertung ≥ 7,5), je Serie bis 6 | 437 (fuellt auf 1000 Film/Serie auf) | Serien-Gewicht |

Reine Film-Charaktere (Harry Potter, Herr der Ringe) braeuchten TMDB — das
will einen Schluessel, den Max anlegen muesste (bleibt dann auf `edge`).
Bilder werden direkt von den CDNs geladen (`referrerpolicy=no-referrer`,
bei Fehler Typ-Symbol). Neu bauen:
`cd /srv/snake && node tools/cards/build.js /srv/snake-data/cards-raw.json`,
dann Dienst neu starten. Laeuft laenger als 60 s → im Hintergrund starten.

**Karte** (`cards.js`, deterministisch aus der Id, gleiche Daten = gleiche
Karten, also bleiben Sammlungen gueltig):
- *Typ* (9: Fire, Water, Electric, Nature, Psychic, Dark, Light, Fighting,
  Steel, je mit Schwaeche ×1,5) aus den Genres; Helden aus dem staerksten
  Kampfwert, Schurken oft Dark.
- *Seltenheit* aus dem Rang in der Reihe: Common 40 %, Uncommon 25 %, Rare
  19 %, Epic 11 %, Legendary 4 %, Secret Rare 1 % der Karten.
- *Werte* HP/ATK/DEF/SPD nach Seltenheit (Helden aus powerstats).
- *Attacken*: eine 1-Energie-Attacke und eine grosse (2–3 Energie) mit
  Effekt (burn, stun, pierce, heal, drain, boost). Kampfregeln folgen in 5.1.

**Packs und Chancen** (5.1a, `PACKS`, `ODDS`, `VARIANTS`): Anime Booster,
Heroes & Series Booster und (5.2) Waifu Booster (nur `gender` weiblich aus
AniList/Superhero-API, Anime + Helden) je 10 000 Coins fuer 5 Karten (1 garantierter Platz
mind. Rare), Kek Mega Booster 50 000 fuer 8 (3 garantiert, bessere Chancen
ueberall, Varianten doppelt so oft). Gewichte je Platz:

| Platz | Common | Uncommon | Rare | Epic | Legendary | Secret |
|---|---|---|---|---|---|---|
| normal | 64 | 27 | 7,5 | 1,3 | 0,18 | 0,02 |
| garantiert | – | – | 92 | 7 | 0,9 | 0,1 |
| Mega normal | 60 | 28 | 10 | 1,7 | 0,28 | 0,02 |
| Mega garantiert | – | – | 86 | 11,5 | 2,2 | 0,3 |

Stand 5.4 (Max: „16 % Legendary im Mega ist way zu hoch", „bei allen deutlich
seltener"): Standard-Pack Legendary 1,6 %, Secret 1 in 556; Mega-Pack
Legendary 7,8 %, Secret 1 in 100 — Mega ist damit so viel wert wie 5
Standard-Packs zum selben Preis. Rueckfluss beim Verkauf ~54 % / ~31 %.
Varianten je Karte bleiben: Pokeball 2,5 %, Masterball 0,25 %, Shiny 0,1 %
(Mega ×2) — Max: nur die Karten-Seltenheiten sollten runter. Auf der Karte
als POKÉBALL / MASTERBALL / ✦ SHINY beschriftet.
Der Shop rechnet die Tabelle „Drop chances" im Browser aus denselben Zahlen.

Verkaufswert (`SELL`): Common 250, Uncommon 600, Rare 1800, Epic 7000,
Legendary 35 000, Secret 250 000; Pokeball ×3, Masterball ×20, Shiny ×25.
Ein Standard-Pack bringt im Schnitt ~75 % zurueck, ein Mega ~60 %. Von jeder
Karte bleibt immer ein Exemplar; „Sell duplicates" verkauft nur normale.

Sammlung `u.cards`: Schluessel = Id oder `Id~Variante` (`p`, `m`, `s`,
kombiniert z. B. `ms`). Legendary+, jeder Masterball und jedes Shiny landen im
Feed.

**Reset 5.5** (Max: allen alle Karten weg, Stand auf 0, damit fair): alle
Sammlungen und `stats.packs` geleert, diesmal **ohne** Erstattung (Max'
Entscheidung); Karten im Auktionshaus/Abholfach verfallen, Gebote darauf gehen
zurueck. Merker `db.meta.kmReset2` und `market.json` `kmReset2`. Live 24.09.2026:
Kek 5, SINTHSBen 64, Schmoggi 28, plori 29 Karten, ein Angebot von plori.
Sicherung vorher: `/srv/snake-data/*.bak-kmreset2-*`.

**Reset 5.1a** (Max): beim ersten Start mit dem neuen Code wurden alle
Sammlungen geleert und die netto fuer Packs ausgegebenen Coins erstattet
(`earned.cards`); Merker `db.meta.kmReset`, laeuft nie wieder.

**Attacken** (`cards-moves.js`): eigene Attacken fuer die bekannten Figuren
(`SIG_*`, Name exakt), sonst Pool der Serie (`FRAN_*`, Praefix von `from`),
sonst der Pool des Kartentyps. Helden mit eigenen Attacken zaehlen fuer die
Seltenheit +350 (die Superhero-API kennt nur Kampfwerte, sonst waere Batman
Common). Doppelte Figuren (gleicher Name, gleiche Serie) und „Presenter"/
„Narrator" fliegen beim Laden raus.

**Pack oeffnen**: Pack antippen → Karten verdeckt aufgefaechert → Riffle →
Stapel → Stapel dreht sich → Karte fuer Karte wischen (Maus/Finger, Tippen,
→/Leertaste), schwaechste zuerst, beste zuletzt; ab Epic Lichtkranz, ab
Legendary/Masterball/Shiny grosser Strahlenkranz und Wackeln → Uebersicht.

**Technik.** Sammlung je Konto in `u.cards` (`{id: Anzahl}`). Der Katalog
(~2000 Karten, ~0,5 MB, gzip) kommt per HTTP `/cards.json?v=HASH` (lange
cachebar), nicht ueber den Socket (`maxPayload` 4 KB gilt nur eingehend, aber
der Katalog muss nicht jedem Tick-Kanal zur Last fallen). Nachrichten:
`kmState`, `kmBuy {pack}`, `kmSell {id, n}`, `kmSellDupes`. Coins laufen in
der Statistik unter `earned.cards`.

## Auslieferung und Messung (5.4)

- **Snake-Zustand** (`state`, 16/s) geht nur noch an Browser in der
  Snake-Welt (`SNAKE_OFF`: `arenahub`, `shooter`, `kekemon`, `market` nicht).
  Messung vorher: 95 % des ausgehenden Traffics waren `state`, auch an Leute
  im Raid, die ihn nie sehen.
- **Spawns in Waenden** (Zombies, Bosse): `spawnMob` sucht mit `freeNear`
  spiralfoermig die naechste Stelle frei fuer den eigenen Radius; `mobTick`
  schiebt alle 0,5 s raus, wer doch in einer Wand steckt. Vorher lag jeder
  9. Zombie und 60 % der Bosse (Radius 46) an den Zombie-Spawnpunkten in der
  Wand.

- **Cache:** Cloudflare setzt fuer `.css`/`.js` `max-age=14400` (4 h), egal
  was der Server schickt (Zone-Einstellung *Browser Cache TTL*). Nach einem
  Deploy liefen dadurch alte `kekemon.js`/`market.js`/CSS gegen neues
  `index.html` — Pack-Oeffnen blieb nach dem Platzen haengen, Markt-Karten
  reagierten nicht. Seit 5.4 baut der Server `index.html` einmal je Start und
  haengt an jede eingebundene Datei `?v=MD5-Anfang` (auch `patchnotes.json`);
  solche Adressen gehen mit `immutable` raus. `index.html` selbst ist
  `no-cache` und bei Cloudflare `DYNAMIC`.
- **Messung:** jede Minute eine Journal-Zeile
  `perf: loop p99 … ms, max … ms · N Verbindungen · raus … KB/s · Top-Nachrichten`
  (`perf_hooks.monitorEventLoopDelay`, Zaehler in `send`/`broadcast`).
  Ablesen: `journalctl -u snake | grep perf:`.

## Cases und Cosmetics (5.3)

- **Cosmetics** kosten seit 5.3 das Doppelte (alle 135). Die Seltenheit wird
  aus dem Preis gerechnet (`RARITIES.min` in `shop.js`), die Schwellen sind
  mitverdoppelt (20k/50k/120k) — Verteilung unveraendert 43/54/26/12.
- **Arena-Cases** (`CASES`/`SOURCES` in `arena-items.js`): Mage case entfernt
  (Quelle `mage` bleibt fuer alte Verweise). Elite gibt es dreifach, je 10k:
  *General* (`elite`, alles), *Weapons* (`elite_w`, nur Waffen), *Armor*
  (`elite_a`, Ruestung 85 % + Rucksaecke 15 %). Dazu je eine **Elite+** fuer
  50k (`elite50`, `elite_w50`, `elite_a50`) mit Stufen
  `elite + 0,25 × (sovereign − elite)`: ein Viertel des Wegs zur 100k-Sovereign,
  bewusst nicht die Mitte (Max: sonst waere 50k fuer Waffen mehr Meta als 100k).

| Stufe | Elite 10k | Elite+ 50k | Sovereign 100k |
|---|---|---|---|
| Uncommon | 40 % | 30 % | – |
| Rare | 40 % | 38,75 % | 35 % |
| Epic | 19,745 % | 30,61 % | 63,22 % |
| Legendary | 0,25 % | 0,60 % | 1,67 % |
| Mythic | 1 in 20 000 | 1 in 3 478 | 1 in 1000 |
| Ultra | 1 in 200 000 | 1 in 34 783 | 1 in 10 000 |

## 📈 Karten-Level (6.7, Plan und alle vier Schritte 24.09.2026)

Ideen aus „vorschlaege kek games" (Flashkeks = Max, SINTHSBen): Level fuer
Karten als Grind-Faktor, normale Gegner zum Leveln, Gyms mit Level, Geld von
Gegnern, Booster-Teile. Entscheidungen Max:

- **Level 1–50, +4 % je Level** auf HP und Angriff (Lv 50 = x3), Def/Spd halb
  so stark. Bewusst: eine gegrindete Common schlaegt eine frische Epic.
- **Duelle mit echten Leveln** (kein Angleichen).
- **Level haengt an der Kopie und ist handelbar.** Umbau: Kopien ohne XP
  bleiben ein Zaehler (`collection[id][v]`), Kopien mit XP einzeln
  (`u.cardXp['id~v'] = [xp, …]`, absteigend). Pick nimmt die hoechste,
  Handel/Markt waehlen eine Kopie, Verfuettern nimmt die schwaechste.
- **Training** (neu): wilde KI-Teams in drei Bereichen (Lv 1–10, 10–30,
  30–50), unbegrenzt, XP immer voll, Coins und Booster-Teile fallen nach X
  Kaempfen am Tag ab.
- **Booster-Teile:** 10 Teile = 1 Booster.
- **Duplikate verfuettern:** Kopie opfern = viel XP.
- **Gyms mit Level** (Sprout 5 … Champion 50), Leiter-Karten auf diesem
  Level, ersetzt grossteils `mul`; neu einstellen mit `tools/km-sim.js`.
- **Neuer Gym-Reset** beim Start (wie 6.4: kein zweites Erstsieg-Pack).

Reihenfolge: 1) Level-Datenmodell, XP aus Gyms/Duellen, Werte, Anzeige;
2) Training + Coins + Booster-Teile; 3) Gym-Level + Sim + Reset;
4) Verfuettern; Handel/Markt mit Level. Spaeter, eigene Runden: Skill-Punkte
auf Attacken, PP-Item im Kampf, zwei Elemente je Karte, Videospiel-Set.

**Schritt 1 (6.7, gebaut):**

- `km-level.js`: Kurve `need(L) = round(20 * L^1.5)` XP fuer L -> L+1
  (Summe Lv 10 = 2.222, Lv 30 = 37.806, Lv 50 = 137.901). `statMul`:
  HP/Angriff +4 %/Lv, Def/Tempo +2 %/Lv. `node km-level.js` zeigt die Summen.
- Speicher `u.cardXp['id~v'] = [xp, …]` absteigend, `normalize()` kuerzt auf
  `u.cards[key]` — geht eine Kopie weg (Verkauf, Handel, Markt, Admin), faellt
  die schwaechste raus. Handel/Markt waehlen die Kopie noch **nicht** (Schritt 4).
- Kampf: `B.fighter(card, v, mul, lv)`; es kaempft und lernt immer die beste Kopie.
- XP je Karte im Team: Gym `(30 + 12 * Gym-Nr.) * (Sieg ? 1 : 0,4)`,
  Duell 60/30; Niederlage vor Zug 3 gibt nichts (kein Aufgeben-Farmen).
  Duelle: volle XP fuer die ersten 10 am Tag (`u.kmXpDay`), danach 20 %.
- Anzeige: Lv-Badge unten links im Kartenbild (ab Lv 2 in der Sammlung,
  immer in der Auswahl), Level-Zeile mit XP-Balken in der Detailansicht,
  `Lv N` im Kampf, `+XP` / `⬆ Lv a → b` im Ergebnis. Sortierung „Level".
- Test: `gymws.js` (Sprout-Sieg -> 5 Karten je +30 XP, Lv 1 -> 2), `gym.js lv`.

**Schritt 2 – Training (`km-gyms.js` `ZONES`):**

- Drei Bereiche: Wild Meadow (Lv 1–10, Common/Uncommon, KI 0), Wild Canyon
  (10–30, Uncommon/Rare, KI 1), Wild Summit (30–50, Rare/Epic, KI 2). Gegner:
  fuenf Zufallskarten der Seltenheit, Level = Schnitt des eigenen Teams -1…+3,
  in den Bereich geklemmt. Laeuft ueber denselben `c.kb` wie die Gyms
  (`c.kb.zone`), Nachrichten `kbStart` mit `gym: 'meadow'` usw.
- XP je Karte immer voll: 25 / 70 / 150 (Niederlage ab Zug 3: 40 %).
- Coins 250 / 600 / 1200 und Booster-Teile +1 / +1 / +2 nur beim Sieg, nach
  Siegen am Tag gestaffelt (`TRAIN_FALL`, `u.kmTrain = { day, wins }`):
  Sieg 1–10 voll, 11–30 25 % Coins und 30 % Chance auf Teile, danach 5 % / 5 %.
- Booster-Teile `u.kmFrag`; `kmFragBuy` tauscht 10 gegen einen **Trainer
  Booster** (`cards.js` `train`, `wheel: true` = nicht im Shop, Chancen wie
  die 10k-Packs). Leiste im Gym-Tab und unter Packs.
- Ergebnis-Knopf „Again" startet mit demselben Team (`kbP.gym.lastTeam`).
- Test: `train.js meadow 30` -> 27/30 Siege, Coins ab Sieg 11 auf 63, 12 Teile,
  `kmFragBuy` -> `inv.train = 1`.

**Schritt 3 – Gyms mit Level:**

- `GYMS[].lv`: Sprout 5, Tide 10, Blaze 15, Volt 20, Dojo 26, Mind 33,
  Shadow 41, Champion 50. Leiter-Karten `B.fighter(card, '', g.mul, g.lv)`;
  Kachel und Karten zeigen das Level.
- `mul` neu eingestellt fuer ein Spielerteam **auf Gym-Level**
  (`PLAYER_CARD_LV=gym` in `tools/km-sim.js`, neu: `gym-5`, feste Zahl).
  Die 6.4-Kurve (55 % … 2 %) waere bei gleichem Level geblieben – dann waere
  der Champion auch mit Lv-50-Team kaum zu schlagen. Ziel jetzt: auf
  Gym-Level ~80 % Sprout bis ~25 % Champion, drueber leichter.

  Messung auf edge (1990 Karten, je 100 Kaempfe, Spieler-KI 2, Pool wie 6.4):

  | Arena | Lv | mul | zufall | vorteil |
  |---|---|---|---|---|
  | Sprout | 5 | 0,72 | 87 % | 74 % |
  | Tide | 10 | 0,75 | 58 % | 92 % |
  | Blaze | 15 | 0,78 | 70 % | 92 % |
  | Volt | 20 | 0,95 | 61 % | 69 % |
  | Dojo | 26 | 0,82 | 49 % | 70 % |
  | Mind | 33 | 1,00 | 39 % | 77 % |
  | Shadow | 41 | 0,73 | 38 % | 56 % |
  | Champion | 50 | 0,66 | 20 % | 26 % |

  Frisches Team (alle Lv 1) gegen Sprout: 58 % / 38 %. `mul` ist sehr steil
  (Sprout 0,7 -> 87 %, 0,8 -> 62 %), 60 Kaempfe streuen um ~10 Punkte.

- Reset: `GYMS_V = 3` (vorher 2). Gleiche Migration wie 6.4: Geschafftes nach
  `u.kmGymsPaid`, `u.kmGyms = {}`; Erstsieg-Pack gibt es fuer bezahlte Gyms
  nicht nochmal. Journal: `Gym-Fortschritt von N Konten zurueckgesetzt (Stand 3)`.

**Schritt 4 – Verfuettern, Handel und Markt mit Level:**

- `km-level.js` `feed()`: opfert die schwaechste Kopie von `source` (ist
  `source == target`, nie die beste) und bucht `FEED[Seltenheit]` (60 / 120 /
  250 / 600 / 1500 / 4000) + 50 % ihrer XP auf die beste Kopie von `target`.
  Nur dieselbe Karte, Variante egal. Nachricht `kmFeed { target, source, n }`,
  Knoepfe in der Detailansicht je Variante („Feed 1 → gewaehlte Variante").
- `assets.js`: Karten-Verweis traegt `xp` (0 = ungelevelte Kopien, sonst genau
  diese XP). `take` nimmt die Kopie aus `u.cardXp`, das Gut traegt `xp: [..]`,
  `give` haengt sie beim Empfaenger an. Handel und Markt laufen darueber,
  Namen zeigen „(Lv N)". Ohne `xp` im Verweis gilt 0 – eine gelevelte Kopie
  geht also nie aus Versehen weg.
- Browser (`market.js` `mkMine`): jede gelevelte Kopie einzeln, die
  ungelevelten als Stapel.
- „Doppelte verkaufen" laesst gelevelte Kopien stehen; einzeln verkaufen
  nimmt weiter die schwaechste.
- Test `s4.js` (Kopien per `srvx.sh` vorbelegt): Verfuettern in sich selbst,
  fremde Karte abgelehnt, Doppelte-Schutz, Handel mit `xp: 0` abgelehnt, mit
  `xp: 800` kommt Lv 6 bei bobby an, Markt-Einstellen und Rueckkauf behalten
  die 800 XP.

## 🔫 Arena 6.6: Items, Uniques, Kisten-Stufen, Boss-Wege

Max (24.09.2026): mehr Items bis in die hoechste Stufe, Uniques nach Anime-
Vorbild mit krassen Animationen, Grundware nicht ueber Epic, Kisten und
Gegner-Beute in Stufen, Raid-Bosse haengen an Ecken.

- **Stufen-Grenze** (`arena-items.js` `maxTierOf`): tier 0 hoechstens Epic,
  tier 1 hoechstens Legendary, sonst offen (`max` am Eintrag ueberschreibt).
  `pickBase` beachtet sie fuer Waffen und Ruestung. Alte Items bleiben, wie sie sind.
- **Neue Grundwaffen** (Common–Epic): Micro Uzi, Carbine, DMR, LMG, Burst
  rifle, Double barrel, Slingshot, Nail gun, Throwing knives, Flare gun, Musket.
- **Uniques** (`unique: true`, Gewicht x`UNIQUE_W` = 0,12 innerhalb der
  Stufe; Sovereign: ~1 Unique je 600 Cases):
  - ab Legendary: Rasengan, Zangetsu (Getsuga Tensho), Amaterasu, Spirit Gun
  - ab Mythic: Gate of Babylon, Kamehameha, Dragonslayer
  - nur Ultra: Venuzdonoa, Hollow Purple
  Mechaniken: `portals` (Kugeln aus Portalen hinter dem Spieler), `wave`
  (schneidet durch alles, `hitR`), `erase` (dazu durch Waende), `beamW`
  (breiter Strahl), `rift` (schwarze Loecher an bis zu 3 Getroffenen).
  Durchschlag-Grenze gilt fuer `wave`/`erase` nicht. Optik: `look` an der
  Kugel (9. Feld im `bullets`-Tupel) bzw. am `shBeam`, gezeichnet in `zfx.js`.
- **Ruestung** ohne Set (`fx`: dmg/rate/taken/regen/dodge/thorns/crit):
  Kevlar vest, Bike helmet, Knee pads, Running shoes, Riot helmet, Ghillie
  pants; Uniques Scouter, Straw Hat, ODM Gear, Hokage Cloak (Legendary+),
  Kamina's Shades, Saitama's Cape (Mythic+), Iron Man Suit und Susanoo
  (Ultra, `full`: Ganzkoerper, andere Teile wirken dann nicht; am Spieler
  gezeichnet ueber `fb`).
- **Verbrauchsgut**: Energy drink (0), Sticky bomb (1), Adrenaline shot (2),
  Chidori (4, Blitz-Sprint mit 280 Schaden), Senzu Bean (5), Spirit Bomb (5,
  750 im Radius 400), Infinite Void (6, Gegner 6 s erstarrt, +50 % Schaden
  – `m.stunUntil`, Spieler 95 % langsamer), World Ender (6, 4,5 s
  Countdown, dann stirbt alles ausser Werfer und Team; `shWorldEnd`
  arm/boom, Vollbild-Sequenz). Ultra-Verbrauchsgut kommt praktisch nur aus
  Sovereign/Elite (Kisten wuerfeln keine Ultra-Stufe).
- **Kisten-Stufen**: `cr.g` 0/1/2 (87/11/2 %, neu beim Nachfuellen) ->
  Quellen `crate`/`crate2`/`crate3` (golden: auch Ausruestung, +1 Item,
  3x XP). Tupel `crates` hat Feld 6 = Stufe.
- **Gegner-Beute** (`npcdrop`): Stufe 1 `npcdrop` 👝, Stufe 2 (1 in 8)
  `npcrare` 💼, Stufe 3 (1 in 50) aus `boss` 💎 mit Lichtsaeule und Pfeil.
  Beutel-Tupel `kind` 3/4/5.
- **Raid-Bosse**: nutzen das Wegfeld (Raster fuer grosse Koerper, r 44,
  frei nach `mobBlocked`), verfolgen 9 s statt 3,5 s ohne Sicht. Startzellen
  im Umkreis, wenn der Spieler nah an einer Wand steht. Test (Mauer dazwischen,
  9 s): Boss erreicht den Spieler 8/12 vorher, 10/12 jetzt.
- **6.6.1:** Effekt-Chancen `EFFECT_N` = 77,9 / 20 / 2 / 0,1 % (0–3 Effekte).
  Lager voll: nichts mehr automatisch zu Scrap (Avalon verlor so eine
  Legendary Crossbow beim Extrahieren). Ueberschuss wartet in
  `a.overflow` (max. 200, erst darueber geht das Schlechteste zu Scrap),
  `flushOverflow` bei jedem `sendHub` schiebt nach, sobald Platz frei ist.
  Im Inventory grau angezeigt, einzeln verschrottbar (`arSalvage` nimmt
  auch wartende uids).
- **Test** (nur `SNAKE_TEST=1`): `shTestEvent` mit `give` (Waffe, Ultra),
  `giveUtil`, `giveArmor`.

## 🧟 Zombies 6.5: haerter, Bosse, neue Arten, Baeume je Modus, Loadouts

Max (24.09.2026): zwei Level-3-Spieler kamen mit Mystery-Box-Waffen locker
bis Welle 10. Dazu Feedback Schmoggi: Punkte je Treffer -> mit der SMG Geld
farmen. Wuensche: neue Bosse mit festen Wellen bis mind. 25, mehr normale
Arten mit Faehigkeiten, Skill Tree je Modus mit geteiltem Level, Loadouts,
Menue-Umbau, Zuschauen ohne Ruckeln.

- **Skalierung** (`shooter.js` `zHp`/`zDmg`/`zSpd`): HP `1 + 0,3(w-1) +
  0,015(w-1)^2` (Welle 10 x5,3, 25 x17), Schaden +6 %/Welle, Tempo +1,5 %/Welle
  (max +40 %). Zombies je Welle `(8 + 5w) x (1 + 0,6 je weiterem Spieler)`,
  Bosswellen halb so viele. Nachschub alle `max(180, 1000 - 55w)` ms,
  gleichzeitig hoechstens `24 + 5 x Spieler`. `m.dm`/`m.sp` am Gegner
  tragen Schaden/Tempo, auch fuer Brut und Boss-Faehigkeiten.
- **Punkte** je echtem Schaden (`Z_PTS_PER_DMG = 1`, Overkill zaehlt nicht,
  Brennen zaehlt), Kill-Bonus wie bisher (`def.pts`).
- **Bosse** (`arena-mobs.js` `ZBOSSES`): 5 Abomination, 10 `necro`, 15
  `brood`, 20 `inferno`, 25 `storm`, 30 `overlord`, danach Kreislauf mit
  HP x(1 + 1,2 je Runde) und +10 % Tempo. Faehigkeiten in `bossSkills()`:
  `blink`, `spiral`, `trail`, `vortex` (zieht Spieler per `slide`), `beam`
  (drehend, `twin` = zwei), `enrage` (ab 50 % HP: Cooldowns x0,65, Tempo
  x1,25). `strikes.fire/zap/acid` hinterlassen Feuer/Saeure (`fires` mit
  `acid`). Auftritt: `shBossIntro` (Vollbild-Karte), 2,8 s Pause, FX
  `bossin`/`bossdie`/`enrage`/`raise`/`vortex`/`zblink`. Boss-Kill:
  Punkte/Coins/XP x(Boss-Nummer), XP anteilig fuer alle Schuetzen.
- **Neue Zombies** (ab Welle): Bloater 5 (platzt bei Beruehrung/Tod,
  Saeurepfuetze), Leaper 6 (Sprung), Shade 8 (Teleport, halb durchsichtig),
  Riot 9 (-45 % Schaden, Schild), Acid Spewer 10 (Saeure-Einschlaege),
  Screamer 12 (ruft Runner).
- **Optik** in `public/zfx.js` (eigene Datei, eingebunden nach `market.js`):
  Figuren fuer alle Zombies, Boss-Koerper, Kugeln (`tier` 11–15 an
  Boss-Kugeln), Einschlaege, FX, Intro. `index.html` ruft `zDrawMob`,
  `zDrawBoss`, `zDrawBullet`, `zDrawStrike`, `zDrawAcid`, `zDrawFx`,
  `zFxSound`, `zBossIntro` an je einer Stelle.
- **Skill Trees je Modus** (`arena-level.js`): `prog.trees[mode].skills`,
  Punkte je Baum = Level - 1, Stats global. Migration beim ersten Zugriff
  (`ensureTrees`): alter Baum -> Extraction und PvP. `ZSKILLS` wirken ueber
  `bonuses(prog, 'zombies')` (`zDmg`, `zBoss`, `zCull`, `zChain`, `zTaken`,
  `zBossTaken`, `zDodge`, `zSecond`, `zPts`, `zStart`, `zDisc`, `zPerk`,
  `zBox`, `zCoins`). Reset getrennt: Baum eines Modus oder Stats.
- **Loadouts** je Modus: Extraction `a.loadout`, PvP/Zombies
  `a.loadouts[mode]` (Kopien); `a.presets[mode]` bis 5 (`arPreset`
  save/load/delete/copy). `arEquip` hat `mode`.
- **Menue**: Game Modes (Play/Loadout/Skills je Modus), Inventory (List,
  Salvage), Cases, Shop. Die alten `hubTab`-Werte `equip`/`profile` sind
  jetzt Unterseiten von Game Modes.
- **XP** gab es schon: Kills, `20 x Welle` je ueberlebter Welle,
  `40 x Welle^1,35` am Ende; Bosse jetzt x(Boss-Nummer).
- **Zuschauen**: im `WATCH`-Modus keine Vorhersage (`shPredict` nimmt die
  interpolierte Server-Position), Sprung je Frame vorher bis 90 px, jetzt
  <= 6 px. Anmeldung erst nach `load`.
- **6.5.1** (Max, nach ersten Runden bis Welle 20, ~15k Coins je Spiel):
  Zombies mit Hitboxen untereinander (`zSeparate`, Paare werden nach
  Radius^2 gewichtet auseinandergeschoben, Bosse fast unbeweglich, Shade
  ausgenommen) – vorher klebte alles auf einem Punkt, eine Armbrust mit
  Durchschlag raeumte ab (Messung: tiefe Ueberlappungen max 15 -> 2).
  Geld: `Z_COINS` kill 3 / tank 12 / boss 200 / wave 30, `Z_PTS_PER_DMG`
  0,5. Tempo: `zSpd` ab 1,12, Pause `zBreak` = 4 s + 0,6 s je Welle (max
  12 s), Start 4 s, Nachschub `max(160, 750 - 45w)` ms.
- **6.5.1 Nachtrag:** Wegfeld (`navBuild`/`zNav`, Raster 40 px, Breitensuche
  von allen lebenden Spielern alle 250 ms, 8 Richtungen ohne Ecken-Schnitt);
  Zombies laufen direkt nur nah (< 160 px) oder mit freier Bahn fuer ihren
  Radius (`clearFor`). Test: nach 20 s beim Spieler 50 % -> 71 %.
  Durchschlag max 2 (`PIERCE_MAX` in `arena-items.js`, gilt ueberall), je
  durchschlagenem Gegner -20 % Schaden. Neue Stationen: Ruestung (bis 4x
  +25 max HP, +50 % Preis je Platte), Granaten (+2 Frag), Power-up-Altar
  (Double Points 30 s, Insta-Kill 15 s, Nuke, Fire Sale 30 s; `zb.fx`),
  Team wiederbeleben, Perks Deadshot (+12 % Krit) und Vulture (+25 %
  Punkte), Pack-a-Punch bis 5 (Preis `zPapPrice`). Map-Optik fuer
  „Kek Mall" in `zfx.js` (`zMallFloor`, `zMallDecor`, `zMallWall`,
  `zDrawStation`) – nur Optik, Deko blockiert nichts. `shJoined.map.name`
  traegt den Kartennamen.
- Snake-Events: Nachspann kuerzer (Ergebnis 4 s, Podium 3 s, Double or
  Nothing 10 s statt 8/5/15 s).
- **Test** (nur `SNAKE_TEST=1`): `shTestEvent` mit `zwave` (naechste Welle),
  `god`, `zBossHp` (Anteil), `zmob` (Arten neben den Spieler).

## ⚔️ Kekémon 6.4: 5 gegen 5, schwere Arenen, Gym-Reset

Max (24.09.2026): Spieler (Avalon_Gold) schafften fuenf Arenen am Stueck,
also „deutlich schwerer" – und nicht nur ueber Seltenheit, sondern ueber
Koennen: 5 statt 3 Karten je Seite.

- `km-battle.js`: `TEAM_SIZE = 5`, exportiert; Gyms, Duelle und Browser
  (`KB_TEAM`) lesen den Wert. Auf dem Handy passen die fuenf Plaetze in eine
  Reihe (`.kb-slot` in `kekemon.css`).
- `km-gyms.js`: Arenaleiter nehmen ihre fuenf staerksten Karten (`power =
  hp + 1.3*max(atk,spa) + 0.8*(def+spd) + 0.9*spe`), der Champion fuenf
  verschiedene Typen. Seltenheiten angehoben (Sprout Uncommon … Champion
  Legendary/Secret), ab Tide KI-Stufe 2 (Vorausschau). Staerke `mul` je
  Arena per `tools/km-sim.js` auf edge mit echten 1990 Karten eingestellt,
  Spieler-KI Stufe 2 mit realistischem Pool (siehe `AUTO_RAR` im Skript).
  Messung (je 60 Kaempfe, Spieler-KI Stufe 2, „zufall" = fuenf zufaellige
  Karten aus dem Spieler-Pool, „vorteil" = fuenf mit Typvorteil):

  | Arena | mul | Spieler-Pool | zufall | vorteil |
  |---|---|---|---|---|
  | Sprout | 0,85 | Rare | 55 % | 60 % |
  | Tide | 0,90 | Rare | 33 % | 78 % |
  | Blaze | 0,95 | Rare | 32 % | 80 % |
  | Volt | 1,00 | Rare | 23 % | 47 % |
  | Dojo | 0,90 | Rare+Epic | 17 % | 37 % |
  | Mind | 1,15 | Rare+Epic | ~12 % | ~40 % |
  | Shadow | 1,00 | Epic | 8 % | 12 % |
  | Champion | 0,90 | Epic+Legendary | 2 % | 2 % |

  `mul` ist nicht vergleichbar zwischen Arenen, weil die Leiter-Seltenheit
  mitwaechst. Der Champion ist gewollt fast unschlagbar („wirklich sehr
  schwer bei den spaeteren"); gute Spieler mit Plan liegen ueber der
  KI-Stufe 2, echte Quoten also etwas hoeher.
- Reset: einmalige Migration beim Start (`u.kmGymsV !== 2`). Jede geschaffte
  Arena wandert nach `u.kmGymsPaid[gid] = true`, dann `u.kmGyms = {}`.
  Journal: `kekemon: Gym-Fortschritt von N Konten zurueckgesetzt (6.4)`.
  Wer eine bezahlte Arena neu schafft, bekommt sie freigeschaltet und die
  Wiederholungs-Coins (15 %), aber kein zweites Erst-Pack (`res.already`).
- Admin, Reiter „Kekémon" im Konto-Dialog: Packs geben/nehmen, Karten
  geben (Suche ueber Name · Seltenheit · id, Variante) und nehmen, Gyms
  zuruecksetzen (bezahlte bleiben bezahlt) oder freischalten (ohne Belohnung).
  `POST /api/users/:key/kekemon` mit `op`, jede Aktion im Admin-Log als
  `kekemon-OP`, der Spieler sieht die Aenderung sofort (`pushKm`).
- Feed leiser (Max): `feedTo(ids, …)` schickt eine Zeile nur an bestimmte
  Spieler. Mystery-Box, Muenzwurf unter ×10, Kirsche/Mango und Schild-Treffer
  sieht nur der Ausloeser; wen eine Box trifft (Swap, Eis, Schockwelle, Raub,
  Slow-all), der sieht sie auch (`hitIds` in `applyBox`). Fuer alle bleiben:
  Legenden-Fruechte, Box-Coins ab 10 000, Muenze ab ×10, Kills, Cashouts.
- Map-Events (`minigames.js`): `safeSpawn` sucht einen Platz mit mind. 6
  freien Feldern geradeaus (Richtung mit dem laengsten Auslauf, bevorzugt zur
  Mitte, kein fremder Kopf im Umkreis 4) – fuer Coin-Rush-Respawn und fuer
  Startplaetze, die vor einem Block liegen. Respawn 1 s statt 2 s. Messung
  (30 Laeufe x 6 Bots, geradeaus): Tod nach hoechstens 3 Schritten vorher
  16 %, jetzt 2 %. Im Intro schickt `events.js` schon ein Bild
  (`frame(true)`, `intro: true`, Richtung `d` je Schlange); der Browser zeigt
  den eigenen Start mit Ring, Pfeil und „YOU".
- Admin: Passwort-Reset (`POST /api/users/:key/password`, Knopf „🔑 Reset
  password" im Konto-Dialog). Leer = zufaelliges 12-Zeichen-Passwort ohne
  verwechselbare Zeichen, sonst das eingegebene (mind. 6). Alle Sessions
  weg, offene Verbindungen gekickt. Das Passwort wird einmal angezeigt und
  nie geloggt (Admin-Log: `password` mit `own`, `sessions`).
- Klang: Event-Fanfaren nur fuer Mitspieler oder wer auf dem Feld ist,
  Jackpot-Banner und fremde grosse Treffer nur mit `joined` – im Casino, in
  der Arena usw. bleibt es still.

## 🎁 Case oeffnen neu (6.2)

Max: Band endete rechts (Server schickte 34 Items, Gewinner auf 29), Animation
langweilig, gleicher Klang fuer jede Stufe, Kauf gehoert in den Shop, Shop zu
gross. Jetzt: Server schickt 70 Items, Gewinner auf 55 (`reelWin`), Feed-Zeile
nach 8 s. Browser: Vollbild-Overlay `#case-open` (Kiste wackelt und springt
auf, Band per requestAnimationFrame mit Klick je Feld, 5,6 s bzw. 6,8 s ab
Legendary), Gewinner leuchtet, Rest abgedunkelt; ab Epic Strahlen, ab
Legendary Konfetti, ab Mythic Wackeln; Klang je Stufe (`caseSound`: Common
dumpf … Ultra orbEpic + Bonus-Fanfare). Skip-Knopf, „Open another (N left)".
Case-Kauf im Shop-Tab, Shop als kompakte Zeilen (`.shop-row`).

## 🎡 Inventar fuer Packs und Cases, Tages-Raeder (6.1)

Max (24.09.2026, Vorschlag SINTHSBen „daily kekmon free pack"):

- **Packs landen im Inventar** `u.packs = { packId: n }`: gekauft (`kmBuy {pack,
  n}`), Gym-Erstsieg, Rad. Geoeffnet wird im Tab 📦 Packs (`kmOpen {pack}`).
  Tabs jetzt: 🛒 Pack Shop · 📦 Packs · 📖 Collection · 🏟️ Gyms · ⚔️ Duels (der
  alte Trade-Tab ist weg – Handel laeuft im Markt).
- **Neue Packs, nur aus dem Rad** (`wheel: true`, nicht kaeuflich): Daily
  Booster (alle Reihen, Chancen wie die 10k-Packs, 5 Karten) und Jackpot
  Booster (Mega-Chancen, 12 statt 8 Karten, 5 statt 3 sicher Rare+).
- **Daily Pack Wheel** / **Daily Case Wheel** (`wheels.js`), je einmal pro Tag
  (Europe/Berlin, `u.dailyPackDay` / `u.dailyCaseDay`): 40 % 1×, 25 % 2×,
  10 % 3× Grundpreis (Daily Booster bzw. Elite case General), 20 % gross
  (Kek Mega Booster bzw. Elite+ case General), 5 % Jackpot (Jackpot Booster
  bzw. Jackpot case – Sovereign-Chancen, nur aus dem Rad). 12 Felder als Optik,
  gezogen wird nach Gewicht. Nachrichten `kmWheel`, `arWheel`.
- **Cases** genauso: `arCase {id, n}` kauft nach `arena.cases`, `arCaseOpen {id}`
  oeffnet (Band-Animation wie bisher).
- **Handelbar:** `assets.js` kennt `{ k: 'pack' | 'case', id, n }` – direkter
  Handel und Auktionshaus, mit Stueckzahl wie Karten; Name/Icon kommen vom
  Server mit.
- **Beim Aufdecken** rechts Kurzinfo: Seltenheit, Wert, Pokéball/Masterball
  (×3 / ×20), Shiny (×25). Wert = Grundwert der Seltenheit (`SELL`) × Ball × Shiny.

## ⚔️ Kekémon-Kampfsystem 6.0 (nach Pokémon Showdown)

Max (24.09.2026): „das Karten Fighting System ist ein wenig boring … jeder hat
2 Attacken und Energie aufladen. Orientier dich am Kampfsystem von Pokémon
Showdown." Entscheidungen Max: **3 gegen 3** bleibt, **4 feste Attacken je
Karte** (kein Teambuilder).

**Karten** (`km-moves.js`, von `cards.js` beim Start gerechnet, eigener fester
Zufall je Karte – die sichtbaren Werte HP/ATK/DEF/SPD bleiben unveraendert):

- `style` physisch oder speziell (Kampf-, Stahl-, Dunkel-, Natur-Typen eher
  physisch). Kampfwerte Level-50-artig: HP = Karten-HP, Angriff = 30 + ATK
  (der andere Angriffswert ×0,75), Def/SpD = (45 + DEF × 2,2) × 0,85–1,15,
  Spe = SPD.
- Vier Attacken: 1. kleine eigene (Kartentyp, Staerke 65, 20 PP); 2. grosse
  eigene (Kartentyp, aus dem alten Effekt: none 110/90 % Genauigkeit, burn 90
  + 30 % Verbrennen, stun 85 + 30 % Paralyse, pierce 90 + hohe
  Volltrefferchance, heal 80 + 25 % Heilung, drain 80 + halber Schaden als
  Heilung, boost 85 + Angriff +1); 3. Abdeckung (anderer Typ, der die
  Schwaechen des Kartentyps trifft, 75); 4. Hilfsattacke aus dem Pool des
  Typs (Will-O-Wisp, Thunder Wave, Toxic, Hypnosis, Swords Dance/Nasty Plot,
  Calm Mind, Bulk Up, Iron Defense, Agility, Recover-artig, Protect-artig oder
  Prioritaets-Attacke +1).
- Typ-Tabelle `CHART` (×2 / ×½ / ×0, Psycho trifft Dunkel nicht), die alten
  Einzelschwaechen sind darin enthalten. Status-Immunitaeten: Feuer brennt
  nicht, Elektro wird nicht paralysiert, Stahl nicht vergiftet.

**Kampf** (`km-battle.js`): beide waehlen gleichzeitig (Attacke oder Wechsel),
Wechsel zuerst, dann Prioritaet, dann Speed (Paralyse halbiert). Schaden
`floor(floor(22 · Staerke · A / D) / 50) + 2`, × Zufall 0,85–1, STAB 1,5,
Typ, Volltreffer 1,5 (1/24, hoch 1/8, ignoriert eigene Minus- und fremde
Plus-Stufen), Verbrennung halbiert physisch. Werte-Stufen ±6, weg beim
Auswechseln. Status: brn 1/16 je Zug, psn 1/8, par 25 % bewegungsunfaehig,
slp 1–3 Zuege. Protect hintereinander 1, 1/3, 1/9 … PP-los: Struggle
(Rueckstoss ¼). Ausgeschiedene Karte: Seite waehlt am Zugende die naechste.
Nach 60 Zuegen gewinnt der hoehere HP-Anteil. Simulation: 3000 Kaempfe KI
gegen KI ohne Haenger, im Schnitt ~10 Zuege, ein Treffer nimmt ~40 % HP.

**KI:** Stufe 0 haut drauf, Stufe 1 gierig mit echter Schadensrechnung
(K.o. zuerst, Status/Aufbau/Heilung, wenn es passt), Stufe 2 Vorausschau
(jede Option 8× drei Zuege gegen gierige Antworten, beste gewinnt). Gemessen
(`tools/km-ai.js`): Zufall gegen Stufe 0 27 %, Stufe 0 gegen 1 37 %, Stufe 1
gegen 2 ~48 %. Mehr Vorausschau brachte kaum etwas – die Schwierigkeit kommt
ueber die Arena-Staerke. Falle beim Messen: `step()` spielt mehrere Zuege am
Stueck; Test-KI-Stufen gehoeren deshalb an die Seite (`side.level`), sonst
gilt die Stufe nur fuer den ersten Zug.

**Arenen neu eingestellt** (`tools/km-sim.js /srv/snake-data N`, auf edge mit
den echten 1990 Karten; Spieler = KI-Stufe 1, Zufallsteam der
Arena-Seltenheit / Team mit Typvorteil): Sprout ×0,75 86/73 %, Tide ×0,85
71/87 %, Blaze ×0,9 63/71 %, Volt ×0,93 57/61 %, Dojo ×1,07 51/70 %, Mind
×1,18 42/66 %, Shadow ×1,02 42/57 %, Champion ×1,44 30/33 %. „Typvorteil"
hilft weniger als frueher, weil jede Karte eine Abdeckungs-Attacke gegen ihre
Schwaechen hat.

**Browser:** Attacken-Knoepfe in Typfarbe mit Staerke, Genauigkeit, PP und
Schadensvorschau gegen die aktive Gegnerkarte (Spanne in % inkl. „KO",
gleiche Formel wie der Server); Wechsel-Knoepfe darunter; Status-Abzeichen
BRN/PAR/PSN/SLP, Stufen-Chips (+2 Atk), Team als Baelle; Gegner-HP in %;
Protokoll mit Showdown-Saetzen (Desktop rechts, Handy aufklappbar); Details
einer Karte zeigen Kampfwerte und alle Attacken. Katalog `cards.json`
traegt je Karte `[style, [hp, atk, def, spa, spd, spe], Attacken]`, dazu
`chart` und `immune`.

Duelle: gleichzeitige Wahl, 45 s je Entscheidung; wer nicht waehlt, bekommt
einen Zug der KI-Stufe 1; drei verpasste Entscheidungen am Stueck = Aufgabe.

## ⚔️ Kekémon-Kaempfe gegen KI-Arenen (5.6, bis 5.10 – Historie)

Tab „Gym battles" in Kekémon. Server rechnet (`km-battle.js`), der Browser
spielt die Ereignisliste als Animation ab (Ausfallschritt, Wackeln,
Schadenszahl, K.o.) und zeigt danach den Endstand.

**Regeln:** 3 gegen 3, aktive Karte + zwei auf der Bank; die schnellere
aktive Karte beginnt. Zugbeginn: aktive Karte +1 Energie (bleibt an der
Karte beim Wechseln, Angriffe verbrauchen ihre Kosten). Eine Aktion je Zug: Angriff
(Energie ≥ Kosten), Aufladen (+1 extra) oder Auswechseln; Aufgeben geht immer.
Schaden = Attacke + Boost, ×1,5 bei Schwaeche, minus 40 % Verteidigung (nicht
bei Pierce), mind. 10. Effekte: Brennen 15 fuer 3 Zuege, Betaeuben (Zug
faellt aus, danach bis zur naechsten eigenen Aktion immun – sonst
Dauerbetaeubung), Heilen 30, Aussaugen halber Schaden, Boost +20 dauerhaft.
Nach 40 Runden gewinnt, wer anteilig mehr HP hat (Heilen gegen Heilen).
Varianten: Pokeball +3 %, Masterball +8 %, Shiny +10 % HP und Schaden.

**KI** (Stufe je Arena): 0 haut um, wenn moeglich, sonst staerkster Angriff;
1 laedt auf, wenn die grosse Attacke dadurch eine Runde frueher kommt; 2
wechselt bei schlechter Paarung. Simulation 5000 Zufallskaempfe: kein Haenger,
kein Timeout, im Schnitt 8 Runden, Zufallsteam gegen Zufallsteam 43 %.

**Arenen** (`GYMS`), eine schaltet die naechste frei:

| Arena | Typ | Leiter-Karten | Staerke | KI | 1. Sieg | Pack |
|---|---|---|---|---|---|---|
| 🌱 Sprout Gym | Nature | Common | ×1,1 | 0 | 3000 | Anime |
| 💧 Tide Gym | Water | Common/Uncommon | ×0,9 | 1 | 4000 | Heroes & Series |
| 🔥 Blaze Gym | Fire | Uncommon | ×0,9 | 1 | 5000 | Anime |
| ⚡ Volt Gym | Electric | Uncommon/Rare | ×1,0 | 1 | 6500 | Waifu |
| 👊 Iron Dojo | Fighting | Rare | ×1,0 | 1 | 8000 | Heroes & Series |
| 🔮 Mind Tower | Psychic | Rare/Epic | ×1,1 | 2 | 11 000 | Anime |
| 🌑 Shadow Gym | Dark | Epic | ×0,95 | 2 | 15 000 | Waifu |
| 👑 Kek Champion | alle | Legendary/Secret | ×1,0 | 2 | 30 000 | Mega |

**Energie wird verbraucht (5.7, Max: „man kann unendlich Energie nutzen"):**
Angriffe kosten ihre Energie, vorher blieb sie liegen und die grosse Attacke
ging ab drei Energie jede Runde. Kaempfe dauern jetzt ~14 statt ~8 Runden;
sparen auf die grosse Attacke lohnt. Balance danach neu per Simulation (Spieler
spart wie die KI; Zufallsteam / Team mit Typvorteil): Sprout 83/75 %,
Tide 61/92 %, Blaze 45/74 %, Volt 54/86 %, Dojo 51/89 %, Mind ~40/65 %,
Shadow 38/43 %, Champion 27/26 %.
Leiter-Teams sind fest (aus der Arena-Id gewuerfelt). Danach je Sieg 15 %
der Coins, hoechstens 3 belohnte Siege je Arena und Tag. Ein Kampf lebt nur im
Speicher (`c.kb`); Server-Neustart oder Tab zu = Kampf weg, ohne Strafe.

## ⚔️ Kekémon-Duelle (5.10, `km-duels.js`)

Tab „Duels" in Kekémon (der Arena-Tab heisst seit 5.10 „Gyms"). Spieler gegen
Spieler mit denselben Regeln wie die Arenen.

- **Gegner finden** (Max: beides): offenes Duell, das jeder annehmen kann, oder
  Herausforderung an einen Spieler, der gerade online ist. Der bekommt ein
  Banner (in jeder Welt) mit Annehmen/Ablehnen. Offene Duelle verfallen nach
  10 min oder wenn der Eroeffner offline geht.
- **Einsatz** (Max: Einsatz + Rating): 0 bis 100 000, beide zahlen ihn beim
  Kampfbeginn, der Sieger bekommt beide. Keine Coins aus dem Nichts. Waehrend
  des Kampfes liegt der Einsatz als `u.kmDuelEscrow` am Konto; stirbt der
  Server mitten im Kampf (Deploy!), zahlt der naechste Start ihn zurueck.
  Gebucht als `earned.cards` (Sieger +Einsatz, Verlierer −Einsatz).
- **Ablauf:** annehmen → beide waehlen drei Karten (90 s, Gegner-Team bleibt
  bis zum Kampf verborgen) → Kampf. 30 s je Zug; laeuft die Zeit ab, laedt der
  Server fuer den Saeumigen auf bzw. schickt die naechste Karte. Drei verpasste
  Zuege am Stueck = Aufgabe. Der Kampf haengt am Konto, nicht an der
  Verbindung: Seite neu laden geht.
- **Rating:** Elo, Start 1000, K = 32, in `u.kmDuel = { rating, wins, losses,
  won }`; Leaderboard „🃏 Kekémon duel rating" (`kmduel`). Feed-Zeile nach
  jedem Duell, gold ab 10k Einsatz.
- **Technik:** `km-battle.js` kennt seit 5.10 zwei menschliche Seiten
  (`createBattle(..., { ai: false })`, `play(b, c, s)`, `auto(b)`,
  `waitingOn(b)`). `view(b, me)` und `flip(ev, me)` drehen Ansicht und
  Ereignisse so, dass die eigene Seite immer Seite 0 ist – der Browser zeichnet
  Arena und Duell mit demselben Kampf-Bildschirm.
- Protokoll: `kdState`, `kdCreate {stake, target?}`, `kdJoin {id}`,
  `kdDecline {id}`, `kdCancel`, `kdTeam {team}`, `kdAct {a, i?, to?}`; vom
  Server `kdState { me, open, mine, duel, online, ev?, result?, duelDone? }`,
  `kdInvite`, `kdInfo`.

**Kampf-Bildschirm neu (5.10, Max: „fighting interface bissl ueberarbeiten"):**
passt samt Knoepfen auf einen Bildschirm; Gegner oben rechts, man selbst unten
links; Zug-Anzeige mit Zeit in der Mitte oben; Energie als Punkte mit
Kosten-Strichen; Bank als Knoepfe mit Name und HP (antippen = wechseln);
Laufschrift fuers letzte Ereignis, volles Protokoll aufklappbar; Knopfleiste
klebt unten, Angriffe zeigen Schaden inkl. ×1,5, „Knocks it out" oder „Needs N
more ⚡"; Aufgeben als kleine Flagge oben. Am Handy: kleinere Karten, Tabs in
einer Zeile.

## 🏛️ Markt (5.2)

Vierte Welt im Umschalter (🏛️ Market) und im Hauptmenue. Zwei Tabs.

**Handelbare Gueter** (`assets.js`): Arena-Items aus dem Lager (nicht im
Loadout), Kekémon-Karten (jede Variante einzeln, beliebig viele Exemplare —
die „eins bleibt"-Regel gilt nur beim Verkauf an das Spiel), gekaufte
Cosmetics (Gratis-Sachen nie; angelegt wird es beim Einstellen abgelegt).
Scrap und Coins nur im direkten Handel.

**Auction Hall** (`market.js`, `DATA_DIR/market.json`):
- Einstellen als *Buy it now* (Festpreis) oder *Auktion* (Startgebot,
  optional Sofortkauf-Preis), Laufzeit 1/6/12/24/48 h, hoechstens 20 Angebote
  je Spieler.
- **Treuhand:** Eingestelltes ist beim Verkaeufer sofort weg und liegt in
  `market.json`. Gebote werden sofort abgebucht; ueberboten = Coins sofort
  zurueck. Naechstes Gebot mind. +5 %. Gebot in der letzten Minute verlaengert
  auf eine Minute (kein Sniping). Stornieren nur ohne Gebot.
- Verkauf: Verkaeufer bekommt Preis minus **5 % Gebuehr** (Coin-Senke).
- Ware kommt direkt ins Konto, auch offline. Nur wenn das Arena-Lager voll ist
  (`INV_MAX`), wartet sie im **Abholfach** (📦 Collect).
- Ablauf alle 5 s geprueft: Auktion mit Gebot → verkauft, sonst zurueck.
- Aenderungen gehen gebremst (400 ms) an alle, die den Markt offen haben
  (`c.mkWatch`). Journal: `market: …`.
- `market.json` wird atomar geschrieben (tmp + rename), 0,5 s nach jeder
  Aenderung und beim Beenden. Ist sie kaputt, startet der Server nicht (sonst
  waeren verwahrte Sachen weg) → aus dem Backup holen.

**Lobby** (`lobby.js`, `public/market.js`): Platz 2400 × 1500 mit Auction
Hall (Tuer: F → Auktionshaus), Brunnen, vier Staenden (F → Kekémon, Arena,
Cosmetic Shop, Casino), Baeumen, Laternen, Gluehwuermchen. Kein Kampf. Der
Browser bewegt sich selbst (Hindernisse kennt nur er), der Server prueft
Tempo und Grenzen und schickt alle Positionen alle 100 ms. Chat-Zeilen
erscheinen als Sprechblasen. **F neben einem Spieler** schickt eine
Handelsanfrage. Handy: tippen = hinlaufen, F-Knopf unten rechts.

**Handel** (`trade.js`, vorher `arena-trade.js` im Arena-Hub): gleicher
Ablauf (Anfrage, beide stellen zusammen, jede Aenderung nimmt Ready weg,
Server prueft beim Tausch alles nochmal), jetzt mit Items, Karten, Cosmetics,
Scrap, Coins. Einladungen und Handelsfenster haengen am Body, erscheinen also
in jeder Welt. Der Trade-Tab im Arena-Hub ist weg.

## In game und Chat (5.0)

- **In game** (rechte Spalte) zeigt neben den Schlangen alle eingeloggten
  Spieler, die gerade woanders spielen: der Browser meldet seinen Schirm
  (`where`), der Server ergaenzt, was er selbst weiss (Raid, PvP/Zombies-Match,
  Casino-Tisch). Alle 3 s ein Broadcast `where {list, online}`, nur bei
  Aenderung. Menue, Konto und Support zaehlen nicht.
- **Chat**: Titel kleiner, 🏷️ blendet sie aus, 🔔 schaltet den Ping-Ton.
  `@Name` wird hervorgehoben; ist man selbst gemeint, ist die Zeile markiert
  und es klingt leise (nicht bei der Chat-Historie beim Verbinden). Tab nach
  `@Anf` ergaenzt aus Chat, Feld und Online-Liste. Rein im Browser, der Server
  kennt keine Pings.
- **Heist** (Mystery-Box 🤏): nimmt jedem anderen 10 % seiner Laenge
  (`HEIST_PCT`, mind. 1, nie das letzte Stueck), vorher flat 3. Wer ⭐ Star
  hat, ist sicher.
- **Achievement-Anteil**: `achRates` zaehlt ueber alle Konten, wie viele
  jedes Achievement haben (60 s Cache), die Kontoseite zeigt den Prozentwert
  wie bei Steam; unter 5 % golden.

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


### 🥤 Shell Game (Huetchenspiel, seit 3.5)

Event wie die Quiz-Events (`events.js`, Art `cups`): 5 Runden. Je Runde
zeigt der Server den Stein unter einem von 3 Bechern (1,8 s), dann folgen
Tausche (Runde 1: 5 a 560 ms, jede Runde +2 und 70 ms schneller, mindestens
250 ms), Phase `shuffle`. Danach 6 s tippen (`question`), dann Aufloesung.
Richtig: 100 + 20 je spaetere Runde + bis 50 Tempobonus. Der Browser spielt
die Tausche aus `start`/`moves`/`moveMs` selbst ab (Startzeit aus
`left`/`total`); getippt wird der Platz, nicht der Becher. Die Loesung ist
aus den gesendeten Zuegen ableitbar – das ist bei einem Huetchenspiel ohnehin
alles, was man sieht.

**Labyrinth:** seit 3.5 schickt eine Sackgasse (Feld mit nur einem freien
Nachbarn, Start ausgenommen) zurueck an den Start (`resets` im Frame als
`r`, der Browser meldet es mit Ton und Kopfzeile).
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
**Seit 24.09.2026 (Max): deutlich kompakter und ohne Spoiler.** Nur Stichworte
je Bereich, keine Namen, Wellen, Zahlen oder Mechaniken von neuen Inhalten –
z. B. „Zombie changes: different zombies + bosses", „Visual changes",
„Menu change and skill trees". Details gehoeren in dieses README.

**Versionen** statt Titeln (Max): normale Runde = +0.1 (2.1 → 2.2), grosse
Aenderung = naechste Hauptzahl (2.x → 3.0). Stand 23.09.2026 abends: 3.0
(neuer Name, Domain, Menue).


**💡 Suggest an improvement** (seit 4.0): Knopf unter den Patch Notes, oeffnet
das Support-Fenster mit „💡 Suggestion: “ im Betreff. Landet als normales
Ticket im Admin (nur Konten).
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


### Zuschauen und „Now" (6.3, nicht in den Patchnotes)

- Spalte **Now**: was der Spieler gerade macht (Snake mit Laenge/Score, Raid,
  PvP, Zombies, Tisch, sonst Bildschirm + Tab, z. B. „🃏 Kekémon · packs"),
  dazu „idle N min", Anzahl Tabs und 👁, wenn gerade jemand zuschaut. Quelle:
  `activityOf(key)` in server.js; der Spiel-Client meldet dafuer alle 0,7 s
  bei Aenderung `ui` (world, screen, joined, kmTab, hubTab, mkTab, mkSub).
- Alle Spaltenkoepfe sortieren per Klick, nochmal klicken dreht um. Standard:
  zuletzt online oben (wer online ist, zaehlt als „jetzt").
- **👁 Watch**: `POST /api/users/KEY/watch` erzeugt einen Einmal-Link
  (`https://game.flashkeks.com/?watch=TOKEN`, 60 s gueltig), der im neuen Tab
  aufgeht. Dieser Tab bekommt alles, was der Server dem Spieler schickt
  (`send()` spiegelt an `c.watchers`), plus dessen Bildschirm/Tab
  (`watchUi`). Session-Token wird nie mitgeschickt (`auth` -> `watchAuth`),
  Abmelden des Spielers beendet nur das Zuschauen. Der Zuschauer sendet
  nichts ausser `watch` (Server ignoriert den Rest). Einstieg mitten im
  Raid/Match: `joinedMsg()` der Arena geht nur an den Zuschauer. Mehrere Tabs:
  der zuletzt aktive. Der Spieler merkt davon nichts. Jeder Start steht im
  Admin-Protokoll (`watch`).

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

## ⚠️ Neustart-Warnung (6.7, Wunsch Max)

Vor einem Deploy im Admin (`admin-game…`, Leiste ueber den Konten)
**Restart warning** mit 1–15 Minuten und optionalem Text ausloesen. Alle
Spieler sehen oben ein Banner mit Countdown (in der letzten Minute rot), neue
Verbindungen bekommen den Stand im `welcome`.

- Server `server.js`: `setRestart(minutes, msg, by)`, Nachricht
  `{ type: 'restart', restart: { left, msg } | null }`. In den letzten 2 Minuten
  (`RESTART_LOCK_MS`) lehnt der Server `kbStart` (Gyms, Training) sowie
  `kdCreate`/`kdJoin` ab; laufende Kaempfe laufen weiter.
- Neugestartet wird **nicht** automatisch – das macht weiter `deploy.sh`. Kommt
  kein Neustart, raeumt sich die Warnung 10 min nach Ablauf selbst weg.
- Admin-API: `GET/POST/DELETE /api/restart` (POST `{ minutes: 0.5–60, msg }`),
  landet im Admin-Log als `restart-warn` / `restart-cancel`. „Call off" hebt auf,
  Spieler bekommen „Restart called off"; nach einem echten Neustart „The server
  is back".
- Nicht in den Patch Notes (Admin-Funktion).
- Test `rs.js` (srvat.sh): Banner mit Text, `kbStart`/`kdCreate` abgelehnt,
  „Call off" nimmt das Banner weg, Log-Eintraege da.

## 🎮 6.8: Game-Set, Ace League, Team-Slots, XP-Fix (24.09.2026, Wuensche Max)

**XP nur fuer besiegte Gegner** (`km-level.js` `battleXp`): je K.o.
`2 + 0,6 × Gegner-Level`, Sieg ×1,2, Gyms ×1,5; gilt fuer Training, Gyms und
Duelle (Duelle weiter mit Tageslimit). Vorher gab es 40 % schon fuers
Durchhalten ab Zug 3 – Lv-1-Karten im Summit bekamen mehr als im Meadow.
Test: Lv-1-Team im Summit -> 0 XP; Meadow 14–22 je Karte.

**Trainer Booster:** 3 statt 1 sichere Rare-oder-besser (Max: „min 3 rare").

**Team-Slots:** `u.kmTeams` (6 Slots, `{ name, keys }`), Nachricht
`kmTeamSave`, Leiste im Auswahl-Schirm (Gyms, Training, Duelle). Laden nimmt
nur Karten, die man noch hat.

**Typ-Gyms staerker:** Seltenheit eine Stufe hoeher (Sprout Rare, Tide
Rare/Epic, Blaze/Volt Epic, Dojo Epic/Legendary, Mind Legendary, Shadow
Legendary/Secret). Reicht der Typ in der Seltenheit nicht, fuellt die
naechst-niedrigere desselben Typs auf (vorher: fremde Typen). Champion
unveraendert (Max: „kann bleiben").

**Ace League** (`series: 'ace'`, `after` = Freischalt-Kette, Ace 1 nach
Sprout): sieben Gyms auf den Leveln der Typ-Gyms, gemischte Teams
(`aceTeam`: stark, jeder Typ einmal, Attacken mit moeglichst viel
Typ-Abdeckung, keine gehaeufte Schwaeche, jede Stufe eigene Karten) und
KI-Stufe 3 (`km-battle.js`: Vorausschau mit 16 Stichproben, 4 Zuege, auch
beim Einwechseln; gegen Stufe 1 37/60 statt 29/60 bei Stufe 2).

Messung auf edge (1990 Karten ohne Game-Set, je 80 Kaempfe, Spieler-KI 2,
Spielerteam auf Gym-Level, Pool wie 6.4). „vorteil" = Team mit Typvorteil –
das ist bei den Typ-Gyms der Massstab, bei der Ace League „zufall":

| Gym | Lv | mul | zufall | vorteil |
|---|---|---|---|---|
| Sprout | 5 | 0,81 | 45 % | 54 % |
| Tide | 10 | 0,97 | 23 % | 71 % |
| Blaze | 15 | 0,87* | 6 % | 29 % (bei 0,91) |
| Volt | 20 | 0,94 | 26 % | 53 % |
| Dojo | 26 | 1,02 | 5 % | 30 % |
| Mind | 33 | 1,25 | 15 % | 31 % |
| Shadow | 41 | 0,84* | 14 % | 40 % (bei 0,80) |
| Champion | 50 | 0,66 | unveraendert |  |
| Ace 1 Rookie Cup | 5 | 0,65 | 46 % | 57 % |
| Ace 2 Ace Arena | 10 | 0,62 | 53 % | 53 % |
| Ace 3 Chess Club | 15 | 0,77* | 26 % (bei 0,80) | 39 % |
| Ace 4 Veteran Hall | 20 | 0,58 | 28 % | 24 % |
| Ace 5 War Room | 26 | 0,62 | 25 % | 23 % |
| Ace 6 Elite Spire | 33 | 0,63 | 19 % | 24 % |
| Ace 7 Grandmaster | 41 | 0,88* | 6 % (bei 0,92) | 8 % |

\* nach der Kontrollmessung zwischen zwei Messpunkten nachgezogen. `mul` ist
steil (wirkt auf HP und Schaden): Ace 1 bei 0,5 -> 98 %, bei 0,7 -> 28 %.

**Game-Set** (`tools/cards/games.js` -> `DATA_DIR/cards-games.json`, von
`cards.js` dazugeladen; `cards-raw.json` bleibt unberuehrt): 1033 Figuren aus
amiibo (Nintendo/Smash-Gaeste, 242), PokeAPI (225), League of Legends (171),
Dota 2 (126), Brawl Stars (106), Genshin (85), Overwatch (51), Valorant (27).
Typ je Figur (`ktype`: Pokemon-Typ, Genshin-Element, Rolle, Serie),
Beliebtheit aus Quelle + Liste `STARS` (Secret: Mario, Link, Pikachu, Sonic,
Kirby, Samus, DK, Cloud …). Neu bauen: `sudo -u deploy node
tools/cards/games.js /srv/snake-data/cards-games.json`, dann Neustart.
**Game Booster** (10k) im Shop; Mega/Daily/Trainer/Jackpot ziehen auch Game-
Karten; Erstsieg Volt und Ace 3 = Game Booster. **Waifu Booster** raus aus dem
Shop (`wheel/retired`), vorhandene lassen sich oeffnen und handeln.

**Zombies, Punkte in der Runde** (Max: Bens Runde bis Welle 24): Schaden
zaehlt geteilt durch `zHp(Welle)`, Kill 60 -> 50. Solo je Welle: W10 ~12k ->
~4,6k, W20 ~46k -> ~8,6k Punkte. Die Coin-Auszahlung am Ende ist unveraendert.

**Scroll-Position** (`keepScroll` in `index.html`): Kekemon, Markt, Handel,
Arena-Hub, Raid-Inventar, Haendler, Shop und Erfolge halten ihre Scroll-
Position beim Neuzeichnen. Nachgestellt im Markt: 150 -> 0, jetzt bleibt 150.

## 🐉 6.9: Bullet-Hell-Bosse, Raid-Bosse, Capture the Flag, Fixes (24.09.2026, Max)

**Gefahrenzonen** (`arena-hazards.js`): Zone wird erst rot angekuendigt
(`total` ms), dann aktiv (`dur`): Sofortschaden je Spieler einmal (`dmg`)
und/oder Dauerschaden (`dps`), optional bewegt (`vx/vy`) oder drehend (`va`).
Formen: Kreis, Rechteck/Strahl, Ring mit Luecke, Sektor, „alles ausser Inseln"
(`s`, im Raid mit Reichweite `lim`), `blue` trifft nur, wer sich bewegt.
Snapshot-Feld `hz`, gezeichnet in `zfx.js` `zDrawHazards`.

**Zombie-Bosse ohne Minions** (Welle 30/35/40, danach 45 Kek Eye, dann Zyklus):
Judge Bones (Knochenwaende mit Luecke, Gaster Blaster, Knochen-Raster, Karma-
Inseln, blaue Phase), Solaris (Nova-Ringe, Sonnenstrahlen, Meteore,
Laserkreuz, Supernova – zum Boss hin), Omega (Void-Schachbrett, Lanzen,
Klingen, Kollaps, Doppelwaende, Freeze). Zonenschaden = Basis × (1 + halbe
Wellen-Staerke). Test `hzsim.js`, Screenshots `hza.js`.

**Raid (Extraction):** Boss geht nur noch, wenn 60 s kein Treffer und niemand
in 1100 px (vorher stur nach 8 min – Bug aus einer Runde, Boss fast tot).
Bosse alle 1–4 min (vorher 2–10), weiter nur einer zur Zeit. Neu: **Titan
Mk-IV** (Raketen, Drehlaser, Schockwellen, Minenfeld, Wandpaar) und **The
Reaper** (Sensen-Kegel, Todesmarken, Seelenernte-Inseln, Klingenkreuz,
Stillstand) – Zonen nur in einer 2000er-Box um den Boss und nur mit Spieler
in der Naehe. **Capture the Flag**: alle 4–9 min Flagge + Ziel (≥ 1600 px
auseinander), Beruehren = tragen, Tod/Abgang = faellt, Ziel = Beutel mit 2–3
Items aus `generate('sovereign')`, 6 min Laufzeit. Test `ctf.js`.
Gelandeter Supply Drop bleibt markiert (📦), bis der Beutel leer ist.

**Arena-Fixes:** Items schuetzen (`arFav`, Stern; kein Salvage, kein
Haendler-Verkauf, Sammelknoepfe lassen sie aus). Drag & Drop aus dem Raid-
Rucksack laesst den ganzen Stapel fallen. Positions-Korrektur im Browser mit
Wandtest (Wand-Glitch, nicht nachgestellt). Gehaltene Tasten werden beim
Inventar-Oeffnen und bei Drag & Drop zurueckgesetzt (Endlos-Laufen).

**Lag-Suche:** Server-Loop sauber (48 h: Minuten-Maxima p99 ~60 ms, CPU auf
edge im Leerlauf). Neu gemessen: App-Ping je Client (perf-Zeile: RTT p50/p95/
max, „RTT-Spitze" bei ≥ 2 haengenden Clients) und Browser-Luecken im
laufenden Spiel („Browser-Luecke" ab 1,5 s). Kekemon-KI mit Zeitbudget 10 ms
(Stufe 3 brauchte bis 50 ms im Hauptthread). Verdacht: Tunnel ueber QUIC,
einzelne Verbindungen brechen ab (cloudflared-Log) – Entscheidung Max offen.

## 💰 6.10: Zombie-Wirtschaft, zweiter Nerf (24.09.2026, Max)

Anlass: schmoggi hatte auf Welle 11 seine Waffe voll gepackt (Pack-a-Punch 5)
und hat danach die Mystery Box im Dauerbetrieb gedreht. Max: Box und Altar
teurer, insgesamt noch weniger Punkte.

| Was | vorher | jetzt |
|---|---|---|
| Punkte je Schaden (geteilt durch `zHp(Welle)`) | 0,5 | 0,35 |
| Punkte je Kill (normaler Zombie) | 50 | 30 |
| normaler Zombie gesamt | ~80 | ~51 (−36 %) |
| Mystery Box | 950 fest | 2000 + 500 je eigenem Kauf (`p.boxN`) |
| Power-up-Altar (Mitte) | 3000 fest | 6000 + 3000 je Kauf in der Runde (`zb.shrineN`) |
| Pack-a-Punch Stufe 1–5 | 5k/7,5k/10k/12,5k/15k = 50k | 5k/10k/15k/20k/25k = 75k |

- Der Box-Zaehler laeuft je Spieler, der Altar-Zaehler je Runde (sein Effekt
  trifft das ganze Team, sonst kauft jeder reihum zum Grundpreis).
- Rabatte (Bargain, Fire Sale bei der Box) gelten weiter auf den aktuellen Preis.
- Der Snapshot traegt `zmb.box` und `zmb.shrine`, `stationLook()` im Client
  zeigt damit den echten naechsten Preis.
- Richtwert solo bis Welle 11: ~418 normale Zombies ≈ 21k Punkte roh, mit
  vollem Baum und Vulture ≈ 38k – eine volle Pack-a-Punch-Waffe (75k) ist
  damit erst deutlich spaeter drin.
- Test (lokal, `zStation` ueber `shInteract`): Box 2000/2500/3000/3500,
  Altar 6000/9000/12000, PaP 5k…25k, Stufe 6 abgelehnt; Snapshot-Preise stimmen.

### 6.10, Teil 2: Schwierigkeit, Box-Chancen, Brand-Piep (Max)

**Schwierigkeit.** Der Host waehlt sie beim Erstellen der Lobby
(`pvpCreate` mit `diff: 'easy'|'normal'|'hard'`, `arena-rooms.js` merkt sie als
`l.diff`, gibt sie als `opts.diff` an die Arena). In `shooter.js` steht `Z_DIFF`:

| | HP | Schaden | Tempo | Anzahl | Coins + XP am Ende |
|---|---|---|---|---|---|
| 🟢 Easy | ×0,65 | ×0,6 | ×0,92 | ×0,8 | ×0,5 |
| 🟡 Normal | ×1 | ×1 | ×1 | ×1 | ×1 |
| 🔴 Hard | ×1,5 | ×1,35 | ×1,08 | ×1,2 | ×1,75 |

- Gilt fuer normale Zombies, Bosse und die Brut der Bosse.
- Punkte je Zombie bleiben auf jeder Stufe gleich: der Schaden wird durch
  `zHp(Welle) * zd.hp` geteilt. Hard bringt nur ueber die Menge (×1,2) mehr Punkte.
- Easy zaehlt nicht fuer `bestWave` (sonst waere die Bestenliste wertlos).
  Neu ist `a.zombies.bestBy[stufe]` mit der besten Welle je Stufe; das Hub zeigt sie.
- Snapshot `zmb.diff`, HUD zeigt das Symbol vor der Welle (nicht bei Normal).
  `shLeft` traegt `diff`.
- Test lokal (Welle 6): Easy 29 Zombies, Normal 37, Hard 45; Ende Welle 10
  solo: XP 448/895/1567, Coins 825/1650/2887; Easy laesst `bestWave` auf 0.

**Mystery Box.** Eigene Quellen `zbox` (statt `elite`) und `zbox_s` (statt
`sovereign`, Lucky box aus dem Baum), nur Waffen. Legendary, Mythic und Ultra
doppelt so oft, der Aufschlag geht von der untersten Stufe ab.
Stichprobe 400k: Legendary 1030 -> 1957, Mythic 28 -> 42.

**Brand-Piep (Amaterasu).** `hurtMob` hat bei jedem Brand-Tick (je Server-Tick,
je brennendem Zombie) ein `shHit` geschickt, der Client piept bei jedem. Mit
Amaterasus Dauerbrand auf vielen Zombies wurde das zum Dauerton. Jetzt schickt
ein Brand-Tick (`w.dot`) nur beim Kill ein `shHit`, genau wie bei Spielern.
Test: Zombie brennt ~1 s bis zum Tod -> genau ein `shHit` mit `kill: true`.

### 6.10, Teil 3: Utility-Kiste, Lager 200, Lager-voll-Anzeige (Max)

**Utility-Kiste** (`ubox`, rechts neben der Mystery Box, `ZMB_W/2 + 220`).
Quellen `zubox`/`zubox_s` in `arena-items.js`: dieselben Stufen-Chancen wie
`zbox`/`zbox_s`, nur Verbrauchsgut. Neues Quellen-Flag `exact`: `pickBase`
nimmt dann nur Items genau der gewuerfelten Stufe (sonst zieht es alles bis zu
der Stufe, gewichtet mit 4^Stufe, und die Chancen stimmen nicht mehr).
Stichprobe 400k: uncommon 159k, rare 160k, epic 79k, legendary 2003, mythic 29, ultra 2.
- Preis 1500 + 400 je eigenem Kauf (`p.uboxN`), Fire Sale halbiert, Lucky box
  aus dem Baum gilt auch hier.
- Menge: halber Stapel, aufgerundet (Stapel 1 -> 1). Liegt dasselbe Item schon
  im Slot und hat Luft, wird aufgestockt.
- Ohne freien Verbrauchsgut-Slot wird **vor** dem Bezahlen abgelehnt
  („Free one of your two consumable slots first").
- Snapshot `zmb.ubox` mit dem naechsten Preis; eigene Zeichnung in `zfx.js`.

**Lager.** `INV_MAX` 100 -> 200 (`arena-items.js`, gilt fuer Cases, Handel, Raid-Ueberlauf).

**Voll-Anzeige.** Der Tab-Knopf „🎒 Inventory" zeigt ab 90 % `used/max` in
Orange und bei vollem Lager (oder wartenden Items) ein rotes `FULL`. In der
Liste steht bei vollem Lager ein Banner, der Zaehler faerbt sich mit.

### 6.10, Teil 4: Wand-Glitch in Haeusern, Reaper-Nerf, Boss-Schonfrist (Max)

**Wand-Glitch in Haeusern.** Ursache gefunden: die optionale Trennwand in
normalen Haeusern begann 60 px unter der Oberkante, also 38 px Schlitz zur
Aussenwand (22 px dick) – der Spieler ist 36 px breit (`R = 18`) und quetschte
sich durch, Client-Vorhersage und Server liefen dabei auseinander. Scan der
Extraction-Map: 19 Schlitze < 40 px, alle in Haeusern, draussen keiner.
Jetzt setzt die Trennwand an der Aussenwand an; liegt oben eine Tuer davor,
beginnt sie 80 px unter der Aussenwand (sonst teilt sie die Tuer in zwei
Schlitze). Unteres Ende und `rand()`-Folge unveraendert, der Rest der Map
bleibt gleich. Nachher: engste Luecke 53 px. Kisten in/an Waenden 3 -> 1.

**Reaper-Nerf** (`PATTERNS.reaper` in `arena-hazards.js`):

| Angriff | vorher | jetzt |
|---|---|---|
| Sensen (Kegel) | 85 | 65 |
| Todesmarken | 70 | 55 |
| Seelenernte | 95, Inseln r 160 | 70, Inseln r 200 |
| Klingen-Wirbel | 110/s, 3,8 s, Drehung 0,8 (wuetend 1,1), 80 breit | 70/s, 3,0 s, 0,6 (0,85), 70 breit, Warnung 1,3 s |
| Stillstand | 60/s | 45/s |

**Boss-Schonfrist.** Leert sich der Raid (letzter Spieler tot oder raus),
solange ein Boss lebt, steht die Welt `EMPTY_KEEP = 30 s` still: keine KI,
keine Timer, Geschosse und Gefahrenzonen weg, Boss behaelt seine HP. Kommt in
der Zeit jemand rein, laeuft es weiter; die Pause wird auf `hitAt` der Gegner
und die Event-Uhren (Boss, Drop, CTF) aufgeschlagen, sonst ginge der Boss
sofort wegen „lange kein Treffer". Nach 30 s wird wie bisher geraeumt. Nur
Extraction (nicht Zombies/PvP). Test: 10 s Pause -> Boss da, HP gleich;
35 s -> weg.

### 6.10.1: Raid-Kisten und seltene Gegner-Beute gekappt (Max)

Anlass: Avalon_Gold zog in einer Stunde 5 Legendary+ aus Raids, zuletzt ein
Phoenix Elixir (Legendary-Verbrauchsgut, kommt aus `crate2`/`crate3`).
Nachgerechnet mit `crateGrade()` (87 % normal, 11 % blau, 2 % gold, 1,5 bzw.
2,5 Items): im Schnitt **1,4 % Legendary+ je geoeffneter Kiste** – fast so viel
wie ein Item aus dem 100k-Sovereign-Case (1,8 %), aber gratis und 150 Kisten
auf der Map, Nachfuellen alle 150 s.

| Quelle | Legendary | Mythic | Ultra |
|---|---|---|---|
| `crate2` | 3,7 -> 0,8 % | 0,3 -> 0,03 % | – |
| `crate3` | 10 -> 3 % | 1,8 -> 0,2 % | 0,2 -> 0,02 % |
| `npcrare` (Gegner, Stufe 2) | 3,7 -> 0,8 % | 0,3 -> 0,03 % | – |

Der Rest geht an Epic. Schnitt je Kiste jetzt 0,43 % (÷3,3). Gegner-Drops je
Kill von ~0,22 % auf ~0,08 %. Boss-Loot (`boss`, 3 Items Sovereign-Stufen)
unveraendert, offen bei Max.

Nachtrag 6.10.1 (Max: „Ja, auf ~1/250"): **Boss-Loot** `boss` Legendary+ je
Item 1,78 % -> 0,4 % (Leg 0,37 %, Myth 0,03 %, Ultra 0,003 %), Rest an Epic.
Trifft auch die Top-Gegner-Beute (1 in 50 zieht aus `boss`). CTF bleibt bei
`sovereign` (Max wollte ausdruecklich Sovereign-Niveau).

**Aufsammel-Anzeige** (`onShLoot`/Toast): jedes Item in der Farbe seiner
Seltenheit (`TIER_COLOR`, Ultra schillert), Rahmentext bleibt gelb. Passt die
Zeile nicht in die Breite, faellt sie auf den alten einfarbigen Text zurueck.

### 6.10.2: Legendary+ je Ereignis nach Max' Vorgabe

Max hat die Werte „Legendary+ pro Mal" (mindestens ein Legendary oder besser
beim Oeffnen/Looten) direkt vorgegeben. Umgesetzt durch gleichmaessiges
Skalieren von Legendary/Mythic/Ultra je Quelle, der Rest geht an Epic.
Nachgemessen mit 1,5 Mio. Ziehungen je Quelle ueber `I.generate()` (also mit
der echten Basis-Auswahl, nicht nur den `t`-Werten):

| Quelle | Items | vorher | Vorgabe | gemessen |
|---|---|---|---|---|
| Kiste normal (`crate`) | 1,5 | 0,10 % | bleibt | 0,10 % |
| Kiste blau (`crate2`) | 1,5 | 0,84 % | ~0,3 | 0,30 % |
| Kiste gold (`crate3`) | 2,5 | 6,57 % | 0,9 | 0,90 % |
| Militaerkiste (`military`) | 1,25 | 1,22 % | 0,75 | 0,76 % |
| Supply Drop (`airdrop`) | 2,4 | 4,60 % | 1,1 | 1,12 % |
| Capture the Flag (neu: `ctf`) | 2,35 | 3,87 % | 1,0 | 0,99 % |

- CTF zog vorher aus `sovereign` – das ist auch die Quelle des 100k-Cases,
  deshalb eigene Quelle `ctf` (Sovereign-Arten, gekappte Stufen). Die Ansagen
  sagen jetzt „top loot" statt „Sovereign loot".
- Unveraendert: Boss (1,16 % je Boss), Gegner-Drops (0,16 % je Beutel),
  Enforcer (0,23 %), alle Cases.

### 6.10.3: Verbrauchsgut verlor seine Stufe (Max: „Chidori jetzt Common?")

`I.plain()` gab fest `tier: 'common'` aus. Verbrauchsgut-Slots (`p.util`,
`{ base, n }`) werden nach dem Raid, beim Umpacken und beim Ablegen ueber
`plain('util', base)` wieder zu Items – ein legendaeres Chidori kam so als
„Common" (odds 1, score 300) zurueck. Das Item selbst wirkte weiter wie
vorher, nur Anzeige, Salvage-Wert und Handelswert waren falsch.
- `plain()` nimmt fuer `util` und `pack` jetzt die Stufe der Basis (wie `generate()`).
- `migrate()` repariert v3-Utils/-Rucksaecke mit falscher Stufe; `st()` laesst
  das einmal je Konto ueber Lager und Ueberlauf laufen (`a.fixTier1`).
- Test: `plain('util','chidori')` -> legendary, bandage bleibt common,
  altes Common-Chidori -> legendary, zweiter Lauf aendert nichts.

## 🔥 6.11: Fuse, Q/G droppen, Random-Effekt-Waffe raus (25.09.2026, Max)

**Fuse** – neuer Hub-Tab zwischen Inventory und Cases. Hauptwaffe waehlen,
dann beliebig viele Waffen **derselben Basis** hineinfusen; die sind danach weg.
Logik in `arena-items.js` `fuse(main, others)`, Server-Nachricht `arFuse`
(`{ main, with: [uids] }`, in `server.js` an `hubAction` geroutet).

| Regel | Wert |
|---|---|
| Kosten | `FUSE_COST` = 500 Scrap je hineingefuster Waffe |
| gleicher Effekt, gleiche Stufe | garantiert +1 (Sharp I + Sharp I = Sharp II), hoechstens das Maximum des Effekts |
| gleicher Effekt, andere Stufe | die hoehere Stufe |
| neuer Effekt als 2. / 3. | `FUSE_ADD` 10 % / 1 % |
| Hauptwaffe ohne Effekt | verboten (Max: „dummer Fuse, man kann nur minus machen") |
| Waffe, die nichts bringt | verboten: kein Effekt, nur niedrigere Stufe (Sharp I in Sharp II), Effekt schon am Maximum, neuer Effekt bei 3 Effekten |
| Effekte hoechstens | 3 (`FUSE_MAX_MODS`) |
| Seltenheit der Hauptwaffe | bleibt, Odds/Score neu gerechnet |

- Geschuetzte (⭐) Waffen koennen nicht hineingefust werden; ausgeruestete schon
  (Rueckfrage im Client, `fixLoadout` raeumt danach auf) – wie beim Salvage.
- Der Client zeigt eine Vorschau (garantiert / Chance) und fragt vor dem Fusen nach.
- Test: Logik 200k Mal – 2. Effekt 9,98 %, 3. Effekt 1,00 %, Tesla bleibt bei max 1.
  Im Browser gegen lokalen Server: Legendary-Railgun Sharp I + drei Epic-Railguns
  -> Sharp II, −1500 Scrap, drei Waffen weg, Meldung korrekt.

**Q/G droppen:** Verbrauchsgut laesst sich jetzt auch direkt aus den Q/G-Slots
aus dem Fenster ziehen (ganzer Stapel, `shInv` `op: 'drop'`, `slot: 'util0'|'util1'`).
Die Items kommen ueber `plain()` mit der Stufe ihrer Basis raus.

**Shop:** „Weapon with a random effect" (`s_modded`, 600 Scrap) raus. Die Quelle
`modded` bleibt definiert.

Nachtrag 6.11 (Max): sinnlose Fuses verboten. `fuseUseless(main, others)` (Server
und gleich gebaut im Client) liefert die erste Waffe, die nichts bringt – gerechnet
in Auswahl-Reihenfolge mit den garantierten Aufstiegen davor (zwei Sharp I in eine
Sharp-I-Waffe: die zweite bringt nach Sharp II nichts mehr). Zufalls-Effekte zaehlen
dabei nicht, die koennen ausbleiben. Der Server lehnt ab, der Client graut solche
Waffen aus und zeigt als Hauptwaffe nur Waffen, fuer die es mindestens einen
sinnvollen Partner gibt. `FUSE_ADD[0]` ist 0.

### 6.11.1: Fuse fuer Ruestung (Max)

Gleiche Regeln wie bei Waffen, Effekte aus `ARMOR_MODS` (Plating, Swift, Regen,
Thorns, Dodge). `fuse()`/`fuseUseless()` nehmen die Effekt-Tabelle nach
`main.kind`, der Server erlaubt `weapon` und `armor` und verlangt gleiche Art
und Basis. Der Tab zeigt Waffen und Ruestungsteile in zwei Abschnitten.
Test im Browser: Scout cap Plating I + Scout cap Plating I -> Plating II, −500 Scrap;
Rare-Cap ohne Effekt ausgegraut.

## 🪟 6.12: Eigenes Bestaetigungs-Overlay (Max: Browser-Popups sehen schlecht aus)

`uiConfirm(text, { title, ok, danger })` -> `Promise<boolean>` und
`uiPrompt(text, value, { title, ok })` -> `Promise<string|null>` in `index.html`
(global, auch von `kekemon.js` und `market.js` genutzt). Enter bestaetigt, Esc
oder Klick daneben bricht ab; Tasten gehen waehrend des Dialogs nicht ans Spiel
(Capture-Listener mit `stopPropagation`, gehaltene Bewegungstasten werden
zurueckgesetzt). Alle 20 `confirm()`/`prompt()` im Spiel ersetzt: Aufgeben/
Verlassen, Fuse, Salvage, Loadouts, Skill-Reset, Karten verkaufen/fuettern,
Duell aufgeben, Team umbenennen, Markt kaufen/bieten, Konto loeschen, Bonus-Kauf.
Das Admin-Panel ist nicht betroffen.

### 6.12: Homing traf keine Gegner (Max: „Homing scheint nicht zu funktionieren")

Die Kugel-Lenkung suchte ihr Ziel nur unter **Spielern** (380 px Umkreis). Raid-
Gegner, Zombies und Bosse wurden nie angesteuert – im PvE (Raid-Gegner, Zombie-
Modus) war Homing damit wirkungslos, im PvP ging es. Jetzt suchen Spieler-Kugeln
auch Gegner (Abstand bis zum Rand, `m.def.r` abgezogen); Gegner-Kugeln (`b.w.mob`)
suchen weiter nur Spieler.
Test: Gegner 120 px neben der Schusslinie, Gewehr, 1 s Dauerfeuer:
ohne Homing 0 Schaden, Homing II vorher 0, jetzt 121.

### 6.12: Disconnect im Raid (Max: Items sollen droppen und min. 2 min liegen)

Sauberes Schliessen (Tab zu, Verbindung weg) lief schon: `ws close` -> `shooter.leave`
-> `die(..., 'left')` -> Beutel mit allem, `BAG_LIFE` 5 min, auch im leeren Raid.
Nicht erkannt wurden **stille** Verbindungen (Handy im Standby, Tunnel weg ohne
Schliessen): die Figur stand weiter im Raid. Jetzt merkt `server.js` die Zeit der
letzten Nachricht (`c.lastMsg`); kommt im Raid `SILENT_MS` = 90 s nichts (der
Browser schickt sonst mindestens alle 5 s einen App-Ping, im Spiel alle 250 ms
Eingaben), gilt der Spieler als weg: `die(p, null, 'left', 'lost connection')`,
Items als Beutel. Beutel von Verlassenen liegen `BAG_LIFE_LEFT` = max(BAG_LIFE, 2 min).
Nur Extraction (PvP/Zombies haben eigene Regeln). 90 s statt weniger, weil Browser
Timer in Hintergrund-Tabs drosseln.
Test: Spieler 91 s still -> raus, Beutel mit seinen Items, 300 s Lebenszeit,
der andere Spieler bleibt.

### 6.12: Admin „Create item" → Armor ging nicht (Max)

Die Basisliste im Admin-Panel schrieb je Ruestung `A.sets[x.set].name`. Seit 6.6
gibt es 14 Ruestungen ohne Set (Kevlar, Bike helmet, Knee pads, …) – dort warf
das einen Fehler, die Liste wurde nie gezeichnet, beim Wechsel auf „Armor" passierte
nichts. Jetzt wird das Set nur gezeigt, wenn es eins gibt. Die Server-Seite
(`accounts.adminArena` op `give`) war in Ordnung.

## 🕳️ 6.12: Untergrund, Raid-Optik, Analyser (25.09.2026, Max)

**Untergrund** (`arena-under.js`): zwei Ebenen neben der Oberflaeche in derselben
Welt (Abstand 2600 > Sichtweite), `MAP.regions` = surface/bunker/lab. `makeWorld`
laesst nur innerhalb einer Ebene stehen (`outside()`), der Client (`shBlocked`)
genauso. Treppen sind Stationen `kind: 'portal'` mit `to`; F teleportiert (1,5 s
Sperre und Schutz, Flaggentraeger nicht). Oben 3 Luken -> Keller (Ebene −1,
verlassener Militaerstuetzpunkt: 4 × 3 Betonraeume, Sandsaecke, Lampen, Munitionskisten
aus `military`), dort eine Treppe ins Labor (Ebene −2: Halle mit 10 DNA-Tanks, einige
zerbrochen, Fluegel mit Konsolen und Kryo-Liegen, Bio-Container aus `labcrate`).
Gegner unten: eigener Bestand (`UNDER_MOBS`), zaehlt nicht zu den Streunern oben.
Keller 16 (Scav/Brute/Sniper/Drone/Enforcer, HP ×2,5, Schaden ×1,7, Tempo ×1,1),
Labor 13 Monster (Mutant, Stalker, Acid Horror, Failed Experiment – max 2).
Nachschub nie naeher als 900 px an Spielern oder 400 px an Treppen. Extraktion nur oben.

**Raid-Optik** (`public/rfx.js`): Boden je Ebene (Gras mit Erdflecken/Blumen, Beton
mit Warnstreifen, Labor-Fliesen mit Leuchtleitungen), Felsen statt grauer Kloetze,
Ziegelmauern, Holzboeden und Ziegeldaecher, Deko, Kisten und Treppen, eigene Figuren
fuer alle Raid-Gegner (`rDrawMob`). Kamera, Rand und Minimap richten sich nach der Ebene.

**Analyser** (Markt-Tab, `analyser.js`, Nachrichten `mkAna`/`mkAnaInv`): eigene
Arena-Items (auch ausgeruestete), Karten, Cosmetics, Packs, Cases auswaehlen.
Arena-Item: Stufe (1 in TIER_ODDS), Basis innerhalb der Stufe (Gewichte wie
`pickBase`), genau n Effekte (`EFFECT_N`), genau diese Effekte (alle Zieh-Reihenfolgen,
ohne Zuruecklegen), je Level (`decay`) -> „diese exakte Kombination 1 in N“, dazu
Zaehler auf dem Server (gleiche Basis, gleiche Stufe, exakt gleiche Effekte).
Formel gegen 2 Mio. echte Wuerfe geprueft (0,0233 % gerechnet, 0,0238 % gemessen).
Karte: Chance je Pack fuer genau diese Karte samt Variante, Varianten-Chance, Kopien
und Besitzer auf dem Server. Cosmetic: Besitzer, im Shop ja/nein. Pack/Case: Tabellen.

### 6.12.1: Weniger und schlechtere Untergrund-Kisten (Max)

| | vorher | jetzt |
|---|---|---|
| Keller-Kisten | 20 (2 je Raum ohne Treppe, 1 mit) | 4 (max. 1, gut die Haelfte der Raeume ohne Treppe) |
| Labor-Kisten | 7 | 3 (mind. 700 px auseinander) |
| Keller-Quelle | `military` (Leg+ 0,76 % je Kiste) | `bunkercrate` (0,2 % je Item, 2. Item 15 %) -> 0,23 % je Kiste |
| Labor-Quelle | `labcrate` ~1,2 % je Kiste | 0,28 % je Item, 2. Item 30 % -> 0,36 % je Kiste |

Gemessen mit 1,5 Mio. Ziehungen je Quelle. Weil weniger `rand()`-Aufrufe im Keller
stattfinden, verschiebt sich auch das Labor-Layout leicht (nichts davon wird gespeichert).

Nachtrag 6.12.1 (Max: „Stalker zu op, man kann ihn nicht hitten, wenn er an einem dran ist"):
- **Nahkampf-Treffer:** Kugeln entstehen `R + 6` = 24 px vor der Spielermitte und
  pruefen Treffer erst ab dem ersten Teilschritt. Ein Gegner, der sich in den Spieler
  schiebt (Stalker: klein und schnell), stand dahinter und wurde nie getroffen – das
  galt fuer alle Nahkaempfer. Jetzt trifft ein Schuss sofort jeden Gegner, der am
  Spieler klebt (`< R + r + 8`) und nicht hinter ihm steht; Durchschlag/Explosion wie
  bei normalen Treffern. Test: Gegner 10 px neben der Mitte, 1 s Feuer: vorher 0
  Schaden, jetzt 169 (bei 20 und 34 px unveraendert 169).
- **Stalker:** HP 300 -> 220, Nachsetzen 390 -> 300, Tempo 210 -> 190, Biss 48 -> 30/s,
  Sicht 560 -> 460.
- **Brutes** (Max: zu stark fuers Early Game) laufen oben nicht mehr herum
  (`ROAMERS` ohne `brute`), nur noch im Keller.

### 6.12.2: Zombie-Punkte −60 %, Heilen gestaffelt (Max)

- **Punkte** (Max: „knapp 60 % weniger Geld" – wie bei Bens Runde als Punkte in der
  Runde gelesen): `Z_PTS_MUL = 0.4` auf alles, was Punkte gibt – Schaden, Kill, Tank-
  und Boss-Kill, Nuke-Bonus. Normaler Zombie ~51 -> ~20 Punkte. Die Coins am Ende der
  Runde (`Z_COINS`, nach Wellen und Kills) sind davon unberuehrt.
- **Heil-Stationen:** `zHealPrice(welle, kaeufe) = 600 + 60 × Welle + 300 × eigene Kaeufe`.
  Test: Welle 1 -> 660, 960, 1260; Welle 10 (nach 3 Kaeufen) -> 2100, 2400.
  Snapshot `zmb.heal`, Preisschild zeigt den echten naechsten Preis.
- **Boss-Schaden nach Entfernung** (Max: Railgun macht Bosse von ultra weit weg platt),
  nur Zombie-Modus: `zBossFalloff(d)` in `hurtMob` – bis 500 px voll, dann linear bis
  30 % ab 1400 px, gemessen vom Schuetzen zum Boss. Test mit Legendary-Railgun:
  300/500 px 310, 800 px 238, 1000 px 189, 1400/2000 px 93 Schaden.
- **Raid-Boss-Beute nach Schwierigkeit** (Max: Waschbaer leicht -> 1–2, Golem -> 3–4):
  neues Feld `loot: [min, max]` je Boss in `arena-mobs.js`, vorher immer 3.
  Hive Queen / Raccoon King 1–2, Iron Golem 3–4, The Reaper / Titan Mk-IV 4–5.
  Pro Item ein Beutel (Quelle `boss`, Legendary+ 0,4 % je Item). Ansage und Kill-Feed
  nennen die echte Zahl; „Sovereign loot" in der Boss-Ansage -> „big loot" (seit 6.10.1
  nicht mehr Sovereign). Test: je Boss 12 Kills, Anzahl immer im Bereich.
- **Untergrund-Events** (Max: „im Militaer- und Laborbereich sollen Events passieren"):
  - *Containment Breach* (Labor): alle 2,5–5 min, wenn jemand im Labor ist, wird ein
    intakter DNA-Tank 250–900 px von einem Spieler gewaehlt. 3,5 s Warnung (Ansage an
    alle im Labor, Tank blinkt rot mit Rissen – Snapshot `tanks: [[deco-Index, 1|2]]`),
    dann platzt er: 2–3 Monster (10 % Failed Experiment). Nach 6 min ist der Tank wieder voll.
  - *Patrouille* (Keller): alle 3–5 min, wenn jemand im Keller ist und keine Patrouille
    laeuft, startet ein Trupp (Enforcer + 3 Scav/Sniper, Keller-Staerke) auf einem
    Punkt der Route, der ≥ 1000 px von allen Spielern weg ist. Route (`B.route`,
    34 Punkte) schlaengelt durch alle 12 Raeume ueber die Tueren; Sandsaecke auf der
    Route werden beim Bauen entfernt. Ohne Ziel folgt der Trupp der Route (hin und
    zurueck), sieht er jemanden, kaempft er. Nach 6 min loest er sich auf (normale Gegner).
  - Test: Breach mit Zeitsprung – Warnung, Snapshot `[[71,1]]`, danach 3 Monster aus
    dem Tank; Patrouille startet, laeuft ueber Tueren durch 6 Wegpunkte und wendet am Ende.

## 🔫 25.09.2026: Fuse-Odds, Achievements, Boss-Aggro, 30 Uniques mit Mechanik

### Fuse und Analyser
- `fuse()` merkt sich beim ersten Fuse die Effekte des Originals in `item.drop`
  (bleibt danach fest) und zaehlt gefressene Items in `item.fused`.
- `odds` eines gefusten Items = Drop-Chance des Originals. `score` = Original +
  halbe Differenz zum nativen Wert des Ergebnisses (Max: 26,6k -> 33k statt 40k
  bei Sharp 1 -> 2).
- Analyser: Drop-Chance aus `item.drop`, Abschnitt „Fused on top" (gefuste
  Items, neue Effekte, Stufen alt -> neu). Items, die vor diesem Stand gefust
  wurden, haben kein `drop` – dort rechnet alles wie vorher.

### Achievements (6.12.3)
30 -> 86. Neu u. a. fuer Zombies (`u.arena.zombies`), PvP (`u.arena.pvp`),
Arena-Level (`levelOf(prog.xp)`), Kekemon (verschiedene Karten, Shiny/Masterball,
Gyms ueber `km-gyms.GYM_IDS`), Markt, Handel, Bosse, Faelle, Fuse. Neue
Statistik `s.fuses`, `s.fuseMaxed`. Zustandsbasierte Achievements werden beim
naechsten `stat()` bzw. beim Serverstart (still) vergeben.

### Boss-Aggro gegen Fernschuetzen (6.12.3)
Treffer von ausserhalb der Reichweite (`def.range || def.aggro`) provoziert
einen Raid-Boss `BOSS_PROVOKE` = 8 s: Sprint x`BOSS_SPRINT` 2,2 zum Schuetzen,
alle `BOSS_RETAL` 2,6 s drei Einschlaege mit Vorwarnung (55, r 110, der erste
vorgehalten). Zombie-Modus unveraendert (dort `zBossFalloff`).

### Raid-Inventar
Shift-Klick: Rucksack-Item anlegen (Waffe in freien Slot, Starter-Pistole
zaehlt als frei, sonst die gehaltene; Q/G nach gleicher Sorte, frei, sonst Q),
Angelegtes zurueck in den Rucksack. Nur Client (`shInvQuick`).

### 30 neue Uniques (6.13–6.13.2)
Wunsch Max: je Typ 10, stark durch Mechanik statt Werte. Je Typ 4 Legendary,
4 Mythic, 2 Ultra.

**Droprate:** gleich viele Unique-Drops wie vorher. Alle Uniques einer (Art,
Stufe) teilen sich das Gewicht der 17 Uniques vom Stand 6.12
(`LEGACY_UNIQUES`, `uniqueScale`, `baseWeight`). Verbrauchsgut hatte keine
Uniques, dort `UNIQUE_W` je Item. Der Analyser rechnet mit `baseWeight`.

**Taste R** (`shAbility` -> `ability()`): macht alles zugleich, was die
Ausruestung kann – Titan Shift, Rock Lees Gewichte, Killer-Queen-Zuender,
Flash Step. HUD zeigt die verfuegbaren Faehigkeiten.

| Item | Art, Stufe | Mechanik (Flag) |
|---|---|---|
| 🌊 Nichirin Blade | Waffe L | `combo`: Treffer in 1,5 s +10 % (max 10), bei 10 Wasserdrache (Welle x2,5) |
| 🔫 Revy's Cutlasses | Waffe L | `smart`: Ricochet 3, je Abpraller +50 % und springt zum naechsten Ziel |
| 🤜 Gum-Gum Pistol | Waffe L | `grapple`: Treffer an Wand/Gegner zieht den Schuetzen hin (`p.grap`) |
| 🪚 Chainsaw | Waffe L | `rev`: Dauerfeuer dreht in 3 s auf x3, 25 % Lifesteal |
| 🩸 Kagune | Waffe M | `berserk`: bis x2,5 Schaden und 28 % Lifesteal bei wenig HP |
| 🔱 Spear of Longinus | Waffe M | `pure` (ignoriert taken/Dodge/Mob-Reduktion), `pin` (2 s betaeubt, Bosse/Spieler langsam) |
| 🔨 Mjölnir | Waffe M | `boomerang` (zurueck durch Waende, trifft auf beiden Wegen), `chain` (Blitz auf 2 Mobs) |
| 💣 Killer Queen | Waffe M | `stick`: Treffer pflanzen Bomben (max 8, 20 s), R sprengt (`kqBombs`) |
| 🌀 Portal Gun | Waffe U | `portal`: Fehlschuss setzt Blau/Orange; Spieler, Mobs (ohne Bosse), Kugeln gehen durch (`portals`) |
| 🌸 Senbonzakura | Waffe U | `orbit`: Klingenkreis 110 px, 130 dps, frisst Kugeln; Schuss = Schwarm als Bumerang |
| 👁️ Byakugan | Helm L | `see`: `canSee` immer wahr (auch Kyoka), immun gegen Flash |
| 🎭 Kaneki's Mask | Helm L | `killHeal`: Kill heilt 25 %, +25 % Tempo 3 s (`onKill`) |
| 🏋️ Rock Lee's Weights | Hose L | `weights`: -15 % Tempo, R: +40 % Tempo, +25 % Rate bis Raid-Ende |
| 🌙 Geppo | Stiefel L | `geppo`: Feuer/Saeure und Verlangsamung wirken nicht |
| 💪 All Might's Suit | Weste M | `plusUltra`: unter 25 % (auch toedlich) Schockwelle + 3 s Schutz, 60 s CD |
| ⚡ Killua's Godspeed | Hose M | `counter`: 12 % Dodge, jeder Dodge schlaegt mit 120 zurueck |
| 🔴 Geass | Helm M | `geass`: 1 s Blick auf Nicht-Boss -> 8 s verzaubert (`m.charm`, `charmTick`) |
| 💨 Flash Step | Stiefel M | `flashstep`: R, 260 px, 300 ms Schutz, 3 s CD |
| 🪞 Kyoka Suigetsu | Weste U | `mirror`: bei Treffer 2 s unsichtbar + Trugbild 3 s (`decoys`), 12 s CD |
| 🦖 Titan Shift | Ganzkoerper U | `titan`: R einmal je Raid, 15 s +1500 HP, Stampfer statt Schuss |
| 🗡️ Hiraishin Kunai | Util L | Kunai werfen, zweiter Einsatz teleportiert (gratis), 30 s |
| ⛓️ Chain Jail | Util L | Gegner am Cursor 3 s ohne Laufen/Schiessen (`jailUntil`), Bosse langsam |
| 👹 Hollow Mask | Util L | 10 s +60 % Schaden, +30 % Rate, 15 % Lifesteal, -5 HP/s |
| 🚪 Door-Door Fruit | Util L | 3 s durch Waende (`phaseUntil`), danach zur naechsten freien Stelle |
| 📓 Death Note | Util M | Ziel stirbt nach 40 s, ausser der Schreiber ist weg; Bosse -30 % |
| 💎 Philosopher's Stone | Util M | 60 s: toedlicher Treffer -> 50 % HP |
| 🌐 Shinra Tensei | Util M | r 380 wegstossen, +120 bei Wandaufprall, loescht Gegner-Kugeln |
| 💊 Hoi-Poi Capsule | Util M | Turm 20 s, 30 Schaden alle 330 ms (`turrets`) |
| ⏱️ Za Warudo | Util U | 4 s Zeitstopp (`zw`): Mobs, andere Spieler, fremde Kugeln, Granaten, Einschlaege stehen |
| 👥 Kage Bunshin | Util U | 3 Klone 15 s, schiessen mit 35 %, fangen je eine Kugel (`clones`) |

Snapshot-Felder dazu: `me.kunai/combo/doom/abil/buff/kq/phase/gaze/inv/zw/zwMe/titan`,
Spieler `ob/ti/cl`, `turrets`, `portals`, Mob-Feld 12 = verzaubert.

**Tests** (Skripte gegen die Raid-Engine mit virtueller Zeit, nicht im Repo):
je Welle ein Skript mit mindestens einer Pruefung je Item (23 + 15 + 18), dazu
36 s Zombie-Modus, 90 s PvP und 3 min Extraction-Chaos mit drei Spielern und
zufaelligen neuen Uniques ohne Absturz.

### Gegner-Drops, Gegner-Level, Waffen-Level, Lager, Boss-Sprung (6.14, 25.09.2026)
- **Drops** (`MOB_DROP_MUL` 0,5): Dropchance aller normalen Gegner in der
  Extraction halbiert, ueberall. Seltenheiten der Quelle bleiben; nur Gegner-
  Beute an der Oberflaeche und im Keller wuerfelt Epic+ mit halbem Gewicht
  (`MOB_EPIC_MUL`, `generate(src, epicMul)`), das Labor wie vorher.
- **Gegner-Level** (`MOB_LEVELS`): Oberflaeche 1–10, Keller 20–30, Labor 40–50,
  gewuerfelt in `spawnMob` nach `regionAt`. Innerhalb der Ebene je Level +6 % HP,
  +4 % Schaden (auf die Ebenen-Faktoren aus `UNDER_MOBS` obendrauf), XP je Kill
  x(1 + 0,05 x (Level−1)). Mob-Tupel Feld 13 = Level, Client zeigt „Lv N".
- **Waffen-Level** (`WLV`, `weaponLevel`): `item.wxp`, Level 1–30, XP gesamt
  100 x (L−1)^1,7. Je Level +1,5 % Schaden, +5 % Feuerrate bei 10/20/30. XP
  = die XP des Spielers fuer Kills mit der gehaltenen Waffe (Gegner, Boss,
  Spieler, Zombies, PvP; in PvP/Zombies auch ans Original im Lager). Fuse:
  Haupt-Item + halbe XP der gefressenen (Entscheidung Max: halb).
- **Lager-Upgrade** (`INV_UP`, `invMaxOf`): +25 Plaetze je Stufe, max 12 Stufen
  (500). Kosten Coins 25k x 1,9^(n−1) und Scrap 150 x 1,75^(n−1), beides noetig.
  Hub-Aktion `arInvUp`.
- **Boss-Sprung** (Ticket #6, Maddy): `bossStuckCheck` – unter 60 px Fortschritt
  in 2,5 s, obwohl der Boss hin will (mit Ziel nur ohne freie Schusslinie) ->
  `bossJump` an eine freie Stelle mit kleinerer Wegfeld-Entfernung, nie naeher
  als r+R+80 an Spielern; 700 ms Warnkreis, Landung mit Druckwelle, 5 s CD.
- **Tesla-Fix** (`teslaArc`): Tesla springt auch zwischen Mobs (vorher nur Spieler).

### Ruestungs-Level und Awakenings (6.15, 25.09.2026)
- **Ruestungs-Level:** gleiche Kurve wie Waffen (`itemLevel`, `item.wxp`). Jeder
  Kill gibt der gehaltenen Waffe UND jedem angelegten Ruestungsteil die volle XP.
  Je Level +2 % HP des Teils (`WLV.armorHp`), je Meilenstein 10/20/30 2 % weniger
  Schaden (`WLV.armorTaken`). Fuse gibt auch bei Ruestung die halbe XP weiter.
  Level-up einer Ruestung ruft `gearStats` neu auf.
- **Awakening ab Level 20** (`WLV.awake`, `isAwake`, Text im Feld `awake` am
  Eintrag, im Tooltip gesperrt/erwacht): Waffen ueber `w.awake`/`w.base` aus
  `weaponStats`, Ruestung ueber `armorStats().awake` -> `p.aw` (Set der Basen).
  - Waffen: Rasengan Schneide-Zone 2 s (`zones`); Zangetsu jeder 3. Hieb x2 und
    breiter; Amaterasu Brand springt beim Tod ueber (`burn.spread`); Spirit Gun
    jeder 4. Schuss 8 Kugeln; Gate of Babylon alle 10 s Schwert-Regen (`blasts`,
    x4 Schaden, r 170); Kamehameha Strahl 1 s haltend (`kameUntil`, `railBeam`
    leise); Dragonslayer Kill = +10 % Rate 5 s (x5); Venuzdonoa Getroffene 5 s
    +50 % (`exposeUntil`); Hollow Purple zieht Gegner in die Bahn; Nichirin Combo
    3 s, Drache bei 8; Cutlasses 5 Abpraller; Gum-Gum Gear Second (+40 % Tempo
    und Rate 3 s); Chainsaw voll hochgedreht 50 % Lifesteal; Kagune unter 30 % HP
    doppelter Faecher; Longinus unbegrenzt durchbohrend; Mjoelnir Blitzschlag auf
    dem Rueckweg (60 %); Killer Queen Kettenexplosion (Tiefe 3); Portal Gun bis 3
    Paare (`portals` jetzt `{ pairs, until }`); Senbonzakura Kreis 165 statt 110.
  - Ruestung: Scouter +8 % Crit; Straw Hat Haki (alle 20 s ein Treffer ab 30
    daneben); ODM R-Enterhaken zur anvisierten Wand (4 s); Hokage unter 50 %
    +3 HP/s; Kamina je Kill +3 % Schaden (max +30 %, bis Raid-Ende); Saitama
    jeder 10. Treffer x5 (Explosionen zaehlen als Treffer); Iron Man R 8
    zielsuchende Raketen (12 s); Susanoo unter 30 % Schild 4 s, 80 % weniger
    (45 s); Byakugan +15 % Schaden bis 400 px; Kaneki Kill heilt 40 %, 5 s Tempo;
    Rock Lee Gewichte ab = 6 s +60 % Schaden; Geppo +10 % Tempo, Chain Jail
    wirkungslos; All Might alle 30 s, 300 Schaden; Killua +6 % Dodge, Konter
    springt auf 2 weitere; Geass 15 s, 1,5 s CD; Flash Step 1,5 s CD mit
    Nachbild; Kyoka 3,5 s unsichtbar, 8 s CD; Titan 25 s, +2500 HP.
- **Gewollt (Entscheidung Max, 25.09.2026: so lassen):** Die schwarzen Loecher von Singularity und den
  Venuzdonoa-Rissen treffen beim Zusammenfallen auch den eigenen Schuetzen
  (`blast()` wie bei Granaten) – im Test 921 Schaden am Schuetzen, wenn er
  neben dem getroffenen Gegner steht.
- Tests: Einzelpruefung je Awakening (31/31), Extraction-Chaos, PvP und
  Zombies mit allen Items auf Level 20 ohne Absturz. Dabei gefunden und
  behoben: `ability()` nutzte `aw` vor der Definition (Rock Lee + R).

## 🏚️ Map-Umbau Phase 1: Dungeons (25.09.2026)
Max: Labor/Militaer zu einfach und nur 4-eckige Boxen; Gesamtkonzept neu – groessere
Oberflaeche mit 3–4 Gegner-Stuetzpunkten und 2 Friendly-Bereichen (Missionen,
PvE-Partys), von dort in Militaerbasis/Labor mit Spezial-Charakteren. Entscheidungen:
Instanz je Party, danach zurueck zum Friendly-Bereich, Tod wie im Raid, Dungeons zuerst.

**Waehrend des Umbaus** kommt nur Kek in die Extraction (`EXTRACT_ONLY`, Standard
`kek`; `SNAKE_EXTRACT_ONLY=''` in `snake.service` oeffnet fuer alle).

- **Generator** (`dungeons.js`, Vorschau `node dungeons.js bunker|lab SEED`):
  Kachelraster 80 px, Raeume Rechteck/L/Kreuz/Halle mit Saeulen/Tank-Raum, Spannbaum
  plus Schleifen, Gaenge mit L-/Z-Knick. Waende = feste Kacheln an Boden (zeilenweise
  zusammengefasst). Deckung nur, wenn alles erreichbar bleibt. Kisten in den
  entferntesten Raeumen, `farRooms` fuer Spezial-Charaktere, Ausgang am Start.
- **Instanzen** (`dungeon-rooms.js`): Luke oben (Station `dungeon`) -> neue Instanz
  mit neuem Seed; wer binnen 20 s durch dieselbe Luke steigt, kommt mit (max 4) –
  Zwischenloesung bis Missionen/Partys. `detach`/`attach` in `shooter.js` uebergeben
  den Spieler samt Ausruestung, Rucksack und HP. Ausgang (Station `exit`) -> zurueck an
  die Luke. Tod/Aufgeben/Verbindung weg wie im Raid.
- **Oberflaeche:** die alten Ebenen daneben sind raus, von `arena-under.js` bleiben die
  drei Luken-Plaetze (2x Militaerbasis, 1x Labor).
- **Gegner** (Modus `dungeon`, `pve` teilt Level/Drops/Wegfeld mit der Extraction):
  neu Heavy Gunner, Grenadier, Riot Trooper (`shield`: -80 % von vorn), Attack Dog
  (`pack` 3) / Acid Spitter, Phase Shade (`blink` jetzt auch fuer normale Gegner),
  Leech Swarm (`pack` 5), Cryo Experiment (verlangsamt). Schluessel `trooper`,
  `acidspit`, `phaseshade`, weil `riot`/`spitter`/`shade` Zombies sind.
- **Spezial-Charaktere** (`special`, `SPECIALS`, `SPECIAL_CHANCE` 15 % je Run nach
  45–90 s, Level = Ebene + 5, 3 Beutel aus `boss`, Name + Leiste im Client):
  Rick Sanchez (Portal-Sprung, Meeseeks, Flachmann), Satoru Gojo (Infinity: > 300 px
  nur 15 % Schaden; Hollow Purple; Infinite Void setzt 2,5 s fest + Einschlaege),
  Tanya Degurechaff (fliegt ueber Waende, explodierende Kugeln, Salve), Roy Mustang
  (Flammen-Schnipp mit Feuerflaeche, Flammenring).
- **Dazu:** Wegfeld ueber die ganze Welt, alle PvE-Gegner nutzen es; Gegner-Level ab
  Lv 1 (+4,5 % HP / +3 % Schaden je Level, Lv 45 = x3 HP); Oberflaechen-Bosse
  Legendary+ -30 %.

## 🏰 Map-Umbau Phase 2: Optik, Missionen, Guild Houses (25.09.2026)
Max: Labor haesslich -> viel bessere Grafik, keine Minimap auf Zufallskarten, Sicht nur
drumherum; Missionen im Spiel-Menue mit Easy/Normal/Hard, Bosse je Stufe anders;
Guild House mit Lager und Versicherung (Scrap + Mission Tokens); groessere Oberflaeche
mit 3–4 Stuetzpunkten und 2 Friendly-Bereichen. Entscheidungen: versicherte Items
„Zurueck ins Lager", Versicherung „pro Item", Ziel „Boss besiegen + raus".

- **Dungeon-Optik** (`public/dfx.js`): Boden je Raumstil in Chunks vorgebacken,
  2,5D-Waende, Lichter mit Flackern, Sicht per Strahlen (nur was in Sichtlinie liegt),
  Nebel + Vignette; Server schickt nur, was der Spieler sehen kann (`los()`).
- **Oberflaeche** 9600 x 6400, bis 170 Gegner. **Zwei Guild Houses** (Holzboden,
  Teppich, Feuer; Tore links/rechts/unten): drinnen kein Schaden, weder von Spielern
  noch von Gegnern, Gegner kommen nicht rein. **Drei feindliche Stuetzpunkte**
  (Mauerring mit Luecken, Sandsaecke, Militaerkisten, Wachen mit Respawn).
- **Missionen** (Station `missions`, Panel `msMenu`): Party erstellen/beitreten (max 4),
  Host waehlt Dungeon und Stufe. Easy: Gegner-Lv -10, Mobs x0,8, Boss-HP x0,7, 1 🎟️;
  Normal 2 🎟️; Hard: Lv +10, Mobs x1,4, Boss-HP x1,6, 4 🎟️. Start nimmt alle mit, die
  im Guild House stehen; eigene Instanz, Ziel-Boss (Spezial-Charakter) im entferntesten
  Raum. Boss tot + Ausgang = Tokens, zurueck ins Guild House. Bosse je Stufe: Hard
  bekommt Extras (Rick Falle + Ring, Gojo Red + schnellere Void + staerkere Infinity,
  Tanya Elinium-Nuke, Mustang Flammenwand), Easy ist langsamer/schwaecher ohne
  Void/Ring.
- **Guild stash** (Station `stash`, Panel `gStash`): Rucksack <-> Lager im Raid.
- **Versicherung** (Station `insure`, Panel `gInsure`): pro angelegtem Item, kostet
  Scrap `INSURE_SCRAP` und Tokens `INSURE_TOKENS` je Stufe (Common 30/1 … Ultra
  1000/6), gilt eine Mission. Tod in der Mission -> versicherte Items zurueck ins Lager.
- Tokens liegen im Konto (`arena.tokens`), Statistik `missions`, `missions_DIFF`.

**Noch offen:** Tokens im Hub anzeigen, weitere Missionsarten.

## 🌳 Hub: Skills-Tab statt Fuse, ein Baum fuer Extraction + PvP (25.09.2026)
Max: „Fuse Menue weg, stattdessen … Button im Inventar … dort wo das Fuse-Menue ist,
ziehen die Skills hin … triggern zwischen Skills und Skills Zombie Mode. Die Skills fuer
PvP und Extraction werden zu einem."

- **Fuse** hat keinen Tab mehr. Im Inventar steht rechts beim Item ein 🔥-Fuse-Knopf,
  sobald es eine Kopie gibt, die es verbessert (`canFuse`). Der Knopf oeffnet die
  bekannte Fuse-Ansicht mit dem Item als Haupt-Item, „Back to inventory" fuehrt zurueck.
- **Skills** sitzen im alten Fuse-Tab (Game Modes hat nur noch Play / Loadout).
  Umschalter „🌳 Skills" (Extraction & PvP) / „🧟 Skills Zombie Mode"; der Tab zaehlt
  freie Punkte beider Baeume.
- **Server** (`arena-level.js`): `TREE_OF(mode)` – PvP nutzt den Baum `extract`.
  Migration in `ensureTrees`: hatte ein Konto getrennte Baeume, bleibt der mit mehr
  vergebenen Punkten, die Punkte des anderen sind wieder frei (Level bestimmt die
  Summe, verloren geht nichts ausser der Verteilung). Resets = Maximum beider.

## 🎨 Grafik-Paket (25.09.2026, Max: „wirklich komplett das Design huebscher machen")
- **Guild House** (`public/gfx.js`): Dielen mit Steinrand, Laeufer und Rundteppich,
  Kamin mit Feuer und Funken, Tische mit Baenken, Faesser, Kisten, Waffenstaender,
  Pflanzen, Banner, Fackeln mit Lichtschein, Fachwerk-Steinmauern, offene Holztore,
  Holzschild „GUILD HOUSE" ueber dem Tor. Hooks in `index.html`: `gGuildFloor` vor den
  Waenden, `gWall`/`gDoor` statt Standard, `gGuildTop` danach.
- **Stationen als Objekte** statt Kreis mit Emoji (`gStation`): Quest Board, Truhen vor
  Schrankwand (Lager), Tresen mit Schreiber (Versicherung), Marktstand (Haendler),
  Sanitaetszelt (Medic). Holzschild darunter, Leuchten, wenn man davorsteht.
- **Figuren** (`public/bfx.js`): Raccoon King, Iron Golem, Hive Queen; Dungeon-Gegner
  (Heavy, Grenadier, Riot Trooper, Attack Dog, Acid Spitter, Phase Shade, Leech, Cryo);
  Spezial-Charaktere (Rick, Meeseeks, Gojo, Tanya, Mustang).
- **Quest-Board-Menue** im Holz/Pergament-Look, Bosse geheim. **Missions-Tod** zeigt eine
  Uebersicht und schickt zurueck ins Guild House (`msRespawn`).
- **Luken weg:** Dungeons nur noch ueber das Quest Board.

### Item-Icons
Normale Items bleiben Emojis (Max: die game-icons-Variante „sieht arsch aus", zurueckgenommen).
Nur Uniques haben eigene Grafiken:
- **Uniques** (`public/unique-icons.js`): 51 SVGs (viewBox 64) mit echten Filtern – Bloom
  (`ug-glow`, `ug-halo`), Turbulenz fuer Feuer/Portale (`ug-fire`, `ug-fire2`), Metall- und
  Stoffverlaeufe. Helfer `orb()` (Energiekugel mit Wirbeln, Referenz Max: Rasengan-Bild),
  `bolt()` (Blitz), `blade()` (Katana), `flame()`. Filter/Verlaeufe haengen einmal im
  Dokument (`UNIQUE_DEFS`). Bilder aus dem Netz gehen aus dem Container nicht (Bild-Hosts
  gesperrt), deshalb gezeichnet.
- **Spezial-Charaktere als Pixel-Sprites** (`PX` + `bDrawSide` in `public/bfx.js`; Max:
  die gezeichneten Figuren sahen „interessant" aus -> Pixel-Design): Raster 16 x 22, Palette
  je Zeichen, zwei Bein-Frames, 1-px-Umriss, einmal gerendert und ohne Glaettung skaliert.
  Blickrichtung links/rechts, Wippen beim Laufen; Glow an Portal-Gun/Hollow Purple/Elinium,
  Gojo mit Infinity-Ringen, Tanya fliegt mit Mana-Schweif, Mustang schnippt Funken.

## 🛠️ Creative Mode (25.09.2026, Max)
Pro Konto im Admin-Panel schaltbar (Arena-Bereich, „Creative mode", `adminArena` Op
`creative`, Feld `arena.creative`). Wirkt sofort, auch mitten im Raid:
- `damage()` tut nichts, solange das Konto Creative hat (Raid, Missionen, PvP).
- Taste **C** im Raid: Menue mit jedem Item (Waffen, Ruestung je Stufe, Verbrauchsgut,
  Rucksaecke, Suche). Klick = in den Rucksack (ueber das Limit), „1"/„2"/„⚡" = sofort
  anlegen. Dazu Heilen und Rucksack leeren. Server: `crOpen`/`crGive`/`crHeal`/`crClear`,
  ohne Creative kommt nur ein Hinweis.
- Was man rausbringt, landet wie normal im Lager – der Modus ist fuers Testen gedacht.

## 🔊 Echte Voicelines und Sound-Effekte (25.09.2026, Max)
- Slots in `public/sfx.json` (Slot -> Datei auf myinstants.com, `max` Sekunden, `cd`
  Mindestabstand, `vol`). Die mp3 liegen **nicht im Repo**, sondern in `DATA_DIR/sfx/`
  (edge: `/srv/snake-data/sfx`, ~6 MB). Holen/erneuern auf edge:
  `/srv/snake/tools/fetch-sfx.sh` (vorhandene bleiben, `FORCE=1` laedt neu). Aus dem
  Claude-Container gehen Soundboards nicht, von edge aus schon (User-Agent noetig).
- Server liefert `/sfx/SLOT.mp3` aus `DATA_DIR/sfx` (nur `[a-z0-9-]`).
- Client `public/voice.js`: `vox(slot)` laedt beim ersten Mal, dekodiert ueber den
  gemeinsamen AudioContext (Lautstaerke/Mute wie alle Sounds), schneidet nach `max` mit
  Ausblenden ab, Stimmen ueberlappen nicht. Fehlt eine Datei, bleibt der Synth-Sound.
- Ausloeser: Schuss mit Unique-Waffe (Slot = Waffen-Basis), Taste R mit Unique-Ruestung,
  Unique-Verbrauchsgut (Q/G), Effekte `zawarudo/shinra/genki/chidori/titan/gomu/void`,
  Spezial-Charaktere: Auftritt (`KIND-spawn`), Tod unter 25 % HP (`KIND-death`),
  gelegentlich `KIND-line`, Rick-Portal (`rick-attack`).
- Neuer Slot: Eintrag in `sfx.json`, dann `fetch-sfx.sh` auf edge.


**Nachtrag (Max, nach dem ersten Live-Abend: „nervt über an"):** Waffen spielen keine Clips
mehr – weder beim Schießen (`shLocalFire`) noch über die Fähigkeiten-Taste (die sucht nur noch
in den Rüstungsslots) noch beim Gomu-Effekt. Die Slots in `sfx.json` und die mp3 auf edge
bleiben liegen, z. B. für einen späteren Goku-Boss (Kamehameha). Rüstungs-Fähigkeiten,
Spezial-Charaktere und Welt-Effekte (Za Warudo, Shinra Tensei, Domain …) klingen weiter. Alle übrigen
Clips sind zugleich leiser geworden (Gesamtfaktor in `voxPlay` 0,9 → 0,55, rund −40 %).
## 👾 Pixel-Look fuer alles (25.09.2026, Max: „ich LIEBE den Pixel-Style … alle Grafiken")
- **Pixel-Pass** (`shFrame`, index.html): die Welt wird in 1/P Aufloesung gezeichnet
  (`SH_PIX` = 4 CSS-px je Welt-Pixel, mal devicePixelRatio) und ohne Glaettung
  hochskaliert – Boden, Waende, Guild House, Deko, Effekte, Schuesse, alles pixelig. Texte
  (Namen, Level, Schilder, Schadenszahlen) werden auf der kleinen Flaeche nur *gemerkt*
  (`fillText`/`strokeText` umgebogen) und danach scharf auf die grosse Flaeche gezeichnet.
  `PIX_WU` = Welt-Einheiten je Pixel, damit Sprites auf dem Raster einrasten.
  Abschalten (Test): `localStorage.setItem('kek-pixel', '0')`.
- **Sprites fuer alle Gegner** (`public/pfx.js`): Menschen und Zombies aus einem Baukasten
  (Kopf cap/helmet/hood/bald/zombie/gasmask/scream, Koerper normal/fat, Waffe
  rifle/longrifle/pistol/shotgun/minigun/launcher/fist/claws, Schild, Palette je Mob);
  eigene Raster fuer Drohne, Hund, Frosch, Geister, Egel, Wolf, Echse, Blob, Spinne und
  die Raid-Bosse (Raccoon King, Iron Golem, Hive Queen, Titan Mk-IV, Reaper). Seitenansicht,
  Blickrichtung, zwei Lauf-Frames, Umriss. Zombie-Bosse bleiben die gezeichneten Figuren aus
  `zfx.js` (durch den Pixel-Pass ebenfalls pixelig).
- **Spieler** als Pixel-Figur in Spielerfarbe (`pxPlayerKind`), Waffe dreht frei zum Ziel,
  Farbe nach Seltenheit, eigener Spieler mit weissem Bodenring.
- Schilder ueber Mobs/Spielern sitzen ueber dem Sprite (`pxTop`).
- Missionen: Banner verraet den Boss nicht mehr, Ausgang heisst „Guild House".

## 📜 Raid-Log: verlorene Items wiederherstellen (25.09.2026, Max)

Max: „logge, was Spieler für Items tatsächlich hatten … dass jemand durch einen Lag
stirbt und ich kann die Items nicht wiederherstellen." Bisher war ein Tod endgültig:
die Items lagen im Beutel, der Beutel lief ab, nirgends stand, was drin war.

**Was geloggt wird** (`raid-log.js`, Datei `DATA_DIR/raid-log.jsonl`, Modus 600):

| Ereignis | Wann | `items` |
|---|---|---|
| `join` | Raid betreten (Extraction, auch Dungeon/Mission) | was das Lager verlassen hat |
| `died` | Tod im Raid | was verloren ging (Ausrüstung, Verbrauchsgut, Rucksack, samt Waffen-XP) |
| `left` | Raid verlassen oder **Verbindung weg** (Lag, Tab zu) | wie `died` |
| `extract` | heil raus; `shutdown: true` beim Server-Neustart | was mit nach Hause kam |
| `restore` | Admin hat zurückgegeben | – (`by` = Admin-Mail, `n` = Anzahl) |

Jede Zeile trägt volle Item-Objekte (uid, Stufe, Effekte, Level), keine Kurzform –
wiederhergestellt wird also genau das Item, nicht ein Nachbau. `rid` verbindet Einstieg
und Ende; Dungeon-Wechsel und Missionen behalten die `rid`, weil der Spieler dabei nur
umgehängt wird (`detach`/`attach`). PvP und Zombies loggen nichts: dort wird die
Ausrüstung nur kopiert, verloren geht nichts. Versicherte Teile einer Mission stehen
unter `saved` und zählen nicht als verloren.

Geschrieben wird **synchron** (`appendFileSync`): die Zeile steht auf der Platte, bevor
der Raid weiterläuft – auch ein Absturz direkt danach verliert sie nicht. Über 20 MB
wird die Datei nach `raid-log.jsonl.1` verschoben (eine Generation, beide werden gelesen).

**Absturz-Fall:** Ein `join` ohne Ende, dessen Raid im laufenden Prozess nicht mehr
existiert, heißt: der Server ist mitten im Raid gestorben. Die Items sind dann weder im
Lager noch in einem Beutel. Das Admin-Panel zeigt so einen Raid als „server crashed
mid-raid" und bietet alles Mitgenommene zum Zurückgeben an.

**Admin-Panel:** Konto → 🔫 Arena → „📜 Raid log" (die letzten 50 Raids). Knopf
„Restore N" gibt die verlorenen Items ins Lager zurück, ist das Lager voll in die
Warteschlange (`overflow`). Pro Raid nur einmal; Items, deren uid schon im Lager liegt
(z. B. weil der Spieler den eigenen Beutel wieder eingesammelt hat), werden übersprungen.
Ein Raid, der gerade läuft, lässt sich nicht zurückgeben. Jede Rückgabe steht zusätzlich
im Admin-Log (`arena-restore`).

API: `GET /api/users/KEY/raids`, `POST /api/users/KEY/raids/RID/restore` (mit `X-Admin: 1`).

**Grenze:** Hat ein Gegner den Beutel eingesammelt und extrahiert, existiert das Item
nach einer Rückgabe zweimal (gleiche uid in zwei Konten). Bei einem Lag-Tod gegen NPCs
ist das egal; bei PvP-Kills vorher schauen, wer der `killer` war.

Test (13/13): Einstieg nimmt Items aus dem Lager, `left` loggt sie voll, Rückgabe über
die Admin-API, zweite Rückgabe abgelehnt, Extraction nicht rückgebbar, laufender Raid
abgelehnt, Absturz nach Neustart erkannt, Dateimodus 600. Dazu Playwright-Screenshot des
Admin-Panels.

## ⚡ Railgun-Nerf und DPS-Test aller Waffen (25.09.2026, Max)

Max: „Railgun ist zu op … game breaking stuff sollte nur bei Ultra oder ggf. Mythic
Waffen sein. Nerf 1: kein Schießen durch Wände."

**Nerf:** Der Railgun-Strahl endet an der ersten Wand (`railBeam` tastet die Linie in
8-px-Schritten ab, `blocked(x, y, 2)`), Gegner dahinter bekommen nichts, und der
Leuchtstrahl im Client endet ebenfalls an der Wand. Durch Wände gehen nur noch Strahlen
mit `thruWalls` am Waffen-Eintrag: **Kamehameha** (ab Mythic) und **Venuzdonoa** (Ultra).
Hollow Purple (Ultra) radiert Wände ohnehin aus, das bleibt. Probe mit Wand zwischen
Schütze und Dummy: Railgun vorher 248 DPS, jetzt 0; Kamehameha 375, Venuzdonoa 1.526
(unverändert).

**DPS-Test** (`node tools/dps.js --md`): echte Simulation in der Engine, keine Formel.
Spieler im Creative Mode auf leerer Fläche, 12 s Dauerfeuer auf einen stehenden
Trainings-Dummy (Brute, 1e9 HP), gezählt von Sekunde 2 bis 12. Abstand 300 px, bei kurzer
Reichweite 60 % davon. Drin: Brennen, Explosionen, Tesla, Combo, Hochdrehen, Awakenings
ab Lv 20, Streuung. Nicht drin: Zielen auf bewegliche Gegner, Effekte (Mods),
Spieler-Skills (`dmgMul` = 1).

- **Basis** = niedrigste Stufe der Basis, Level 1
- **Max** = höchste Stufe (`maxTierOf`), Level 30
- **Max + PaP 5** = dazu Pack-a-Punch 5 (Zombies: ×1,6⁵ ≈ ×10,5 Schaden, ×1,12⁵ ≈ ×1,76 Feuerrate)
- **Papier** = Schaden × Kugeln / Schussabstand, ohne Treffer-Effekte – zeigt, wo die
  Simulation durch Streuung oder Effekte abweicht

| # | Waffe | Stufen | DPS Basis | DPS Max (Lv 30) | DPS Max + PaP 5 | Papier Basis | Papier Max |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | ★ Venuzdonoa | ✦ Ultra rare–✦ Ultra rare | 1.526 | 3.755 | 72.122 | 1.018 | 1.680 |
| 2 | ★ Rasengan | Legendary–✦ Ultra rare | 696 | 1.916 | 34.045 | 207 | 413 |
| 3 | ★ Gate of Babylon | Mythic–✦ Ultra rare | 844 | 1.589 | 28.981 | 866 | 1.599 |
| 4 | ★ Kamehameha | Mythic–✦ Ultra rare | 375 | 1.386 | 13.947 | 341 | 630 |
| 5 | ★ Spirit Gun | Legendary–✦ Ultra rare | 632 | 1.010 | 19.645 | 324 | 647 |
| 6 | ★ Chainsaw | Legendary–✦ Ultra rare | 562 | 976 | 15.249 | 207 | 413 |
| 7 | ★ Mjölnir | Mythic–✦ Ultra rare | 362 | 907 | 15.845 | 181 | 334 |
| 8 | ★ Spear of Longinus | Mythic–✦ Ultra rare | 434 | 852 | 14.626 | 292 | 540 |
| 9 | ★ Dragonslayer | Mythic–✦ Ultra rare | 462 | 817 | 16.352 | 1.387 | 2.562 |
| 10 | ★ Nichirin Blade | Legendary–✦ Ultra rare | 400 | 725 | 13.719 | 218 | 435 |
| 11 | Staff of the Archmage | Mythic–✦ Ultra rare | 402 | 723 | 13.813 | 423 | 782 |
| 12 | Fat Boy | Mythic–✦ Ultra rare | 322 | 646 | 10.834 | 64 | 119 |
| 13 | ★ Hollow Purple | ✦ Ultra rare–✦ Ultra rare | 338 | 646 | 10.157 | 375 | 619 |
| 14 | ★ Portal Gun | ✦ Ultra rare–✦ Ultra rare | 360 | 594 | 10.292 | 375 | 619 |
| 15 | ★ Zangetsu | Legendary–✦ Ultra rare | 210 | 560 | 9.976 | 215 | 429 |
| 16 | Railgun | Legendary–✦ Ultra rare | 248 | 484 | 9.028 | 238 | 476 |
| 17 | ★ Kagune | Mythic–✦ Ultra rare | 271 | 474 | 8.739 | 562 | 1.037 |
| 18 | ★ Revy's Cutlasses | Legendary–✦ Ultra rare | 182 | 393 | 5.471 | 213 | 424 |
| 19 | ★ Gum-Gum Pistol | Legendary–✦ Ultra rare | 140 | 371 | 7.448 | 143 | 286 |
| 20 | Singularity | ✦ Ultra rare–✦ Ultra rare | 230 | 363 | 7.059 | 84 | 139 |
| 21 | Golden Deagle | Rare–✦ Ultra rare | 151 | 331 | 6.207 | 159 | 358 |
| 22 | Minigun | Epic–✦ Ultra rare | 111 | 311 | 3.259 | 147 | 314 |
| 23 | ★ Senbonzakura | ✦ Ultra rare–✦ Ultra rare | 180 | 310 | 5.417 | 92 | 152 |
| 24 | Arcane orb | Legendary–✦ Ultra rare | 134 | 294 | 4.957 | 149 | 297 |
| 25 | Rifle | Common–Epic | 134 | 278 | 3.917 | 147 | 281 |
| 26 | Launcher | Epic–✦ Ultra rare | 104 | 232 | 4.063 | 52 | 111 |
| 27 | ★ Amaterasu | Legendary–✦ Ultra rare | 129 | 223 | 3.714 | 104 | 208 |
| 28 | LMG | Common–Epic | 99 | 221 | 3.449 | 124 | 237 |
| 29 | Crossbow | Rare–✦ Ultra rare | 92 | 211 | 3.950 | 96 | 217 |
| 30 | Revolver | Uncommon–Legendary | 101 | 187 | 3.448 | 105 | 205 |
| 31 | Throwing knives | Common–Epic | 84 | 177 | 2.981 | 93 | 179 |
| 32 | Micro Uzi | Common–Epic | 71 | 176 | 1.857 | 100 | 191 |
| 33 | DMR | Common–Epic | 91 | 176 | 3.184 | 92 | 177 |
| 34 | Flamethrower | Epic–✦ Ultra rare | 100 | 176 | 3.443 | 97 | 206 |
| 35 | SMG | Common–Epic | 101 | 168 | 2.653 | 111 | 213 |
| 36 | Sniper | Common–Epic | 81 | 165 | 2.828 | 82 | 157 |
| 37 | Fire staff | Rare–✦ Ultra rare | 80 | 163 | 2.730 | 68 | 154 |
| 38 | Carbine | Common–Epic | 97 | 161 | 3.383 | 100 | 191 |
| 39 | Storm staff | Epic–✦ Ultra rare | 75 | 161 | 2.916 | 79 | 168 |
| 40 | Pistol | Common–Epic | 76 | 143 | 2.653 | 77 | 147 |
| 41 | Frost staff | Rare–✦ Ultra rare | 63 | 140 | 2.523 | 64 | 143 |
| 42 | Musket | Common–Epic | 74 | 140 | 2.749 | 75 | 144 |
| 43 | Nail gun | Common–Epic | 76 | 127 | 2.653 | 80 | 153 |
| 44 | Slingshot | Common–Epic | 55 | 103 | 1.920 | 58 | 111 |
| 45 | Apprentice wand | Common–Epic | 54 | 102 | 1.885 | 55 | 104 |
| 46 | Double barrel | Common–Epic | 53 | 88 | 1.676 | 126 | 242 |
| 47 | ★ Killer Queen | Mythic–✦ Ultra rare | 47 | 84 | 1.612 | 49 | 91 |
| 48 | Shotgun | Common–Epic | 42 | 79 | 1.466 | 129 | 247 |
| 49 | Flare gun | Common–Epic | 40 | 70 | 1.179 | 34 | 66 |
| 50 | Burst rifle | Common–Epic | 33 | 62 | 1.152 | 105 | 200 |

Was auffällt:

- **Railgun** liegt beim reinen DPS nur auf Platz 16 (248 → 484). Op war sie nicht über
  den Schaden, sondern über Wände + unbegrenzten Durchschlag + 3.000 px sofort. Mit dem
  Nerf bleibt Durchschlag und Reichweite.
- **Rasengan** (ab Legendary) steht auf Platz 2, über allen Mythics, nur Venuzdonoa (Ultra) liegt drüber –
  die Explosion (2,4) trifft den Dummy zusätzlich zum Direkttreffer. Legendary mit
  Mythic-/Ultra-Schaden.
- **Spirit Gun, Chainsaw, Nichirin** (alle ab Legendary) liegen ebenfalls über den
  meisten Mythics.
- **Tick-Grenze:** Ein Tick dauert 33 ms, schneller kann keine Waffe schießen. Minigun
  und Micro Uzi stoßen mit PaP 5 daran (nur ×10 statt ×18,5).
- **Kamehameha-Awakening ignoriert PaP:** der gehaltene Strahl (Lv 20) rechnet mit
  `dmgMul`, nicht mit `pap` – daher nur ×10 mit PaP.
- **Killer Queen** zählt ohne Zünden (Taste R), der echte Wert liegt deutlich höher.
- **Schrotflinten, Burst rifle, Double barrel**: auf 300 px geht der Großteil der Kugeln
  daneben (Papier 129 → Simulation 42). Aus der Nähe viel stärker.

### Zombie-Bosse: HP wachsen je Welle (25.09.2026, Max)

Anlass: Avalon hat Omega (Wave 40) mit einer Railgun (PaP 5) in ~8 s gekillt. Das lag
nicht an der Railgun, sondern daran, dass Pack-a-Punch 5 jede Waffe ~×18,5 macht und die
Boss-HP bis Wave 45 nur von der Boss-Sorte abhingen. Mythic-Uniques schafften Omega in
2–3 s. Max hat sich für Boss-HP je Welle entschieden, nicht für schwächeres PaP.

Neu: `zBossWaveHp(wave) = 1 + 0,1 × (wave − 5)`, zusätzlich zu Runde (`cycle`) und
Schwierigkeit (`zd.hp`). Wave 5 ×1, Wave 20 ×2,5, Wave 40 ×4,5. Solo, Normal, Zeit bis
zum Kill mit den DPS-Werten aus dem Test oben:

| Welle | Boss | HP alt | HP neu | Railgun + PaP 5 | Gate of Babylon + PaP 5 | Rifle + PaP 5 |
|---|---|---:|---:|---:|---:|---:|
| 5 | Abomination | 3.700 | 3.700 | 0,4 s | 0,1 s | 0,9 s |
| 10 | Lord Morvath | 7.200 | 10.800 | 1,2 s | 0,4 s | 2,8 s |
| 20 | Ignis | 16.500 | 41.250 | 5,1 s | 1,6 s | 11,7 s |
| 30 | Judge Bones | 27.000 | 94.500 | 10,5 s | 3,3 s | 24,1 s |
| 40 | Omega | 48.000 | 216.000 | 28,1 s (vorher 6,3) | 8,8 s | 64,9 s |
| 50 | Abomination (Runde 2) | 8.140 | 44.770 | 5,0 s | 1,5 s | 11,4 s |

Ohne Spieler-Skills gerechnet; Boss hunter, Headshots usw. machen es schneller.

## 🎭 Boss-Phasen mit eigener Mechanik (25.09.2026, Max)

Max: „Mach die Bosse mehr phasenbasiert – Phasen, wo sie krasse Animationen machen und
unverwundbar sind, danach ggf. stärker." Erste Fassung galt für alle Bosse gleich – Max:
„Nicht jeder Boss muss das haben und es soll nicht bei jedem gleich sein. Die Bosse, die
das haben, sollen einen Unique-Effekt haben." Ausgewählt hat Max sieben:

| Boss | Schwelle | Phase | Was passiert | Danach dauerhaft |
|---|---|---|---|---|
| 🌌 Omega (W40) | 60 % | Big Crunch | 3,5 s immun, zieht alle Spieler zur Mitte (Kern schadet), dann Implosion (380 px) | Mini-Schwarzloch kreist in 300 px um ihn, zieht an, schadet |
| 🌌 Omega | 25 % | Last Light (Finale) | 3 s immun, drei Kugel-Novas | Arena dunkel, nur ein Lichtkreis um jeden Spieler |
| 👁️ The Kek Eye (W45) | 50 % | The Watchers | Schild hält, bis 3 Wächter-Augen (je 3,5 % Boss-HP, schießen Salven und Ringe) tot sind | alle 7 s Doppel-Laser auf den nächsten Spieler |
| ☀️ Solaris (W35) | 50 % | Eclipse | 6 s immun, fünf Feuerringe ziehen sich zusammen, je eine Lücke | Boden um ihn brennt ständig |
| 🦴 Judge Bones (W30) | 50 % | Judgement | nicht immun, aber 3 s **Karma**: jeder Treffer geht (35 %, gedeckelt) an den Schützen zurück | jedes zweite Muster sind blaue Knochen (stillstehen) |
| 🤖 Titan Mk-IV (Raid) | 50 % | Reactor Overload | Schild hält, bis 4 Reaktoren (je 3 % Boss-HP) zerstört sind; alle 1,5 s Raketensalve | Raketensalve alle 6 s |
| 🕶️ Satoru Gojo (Special) | 40 % | Domain Expansion | 3,5 s immun, Kuppel, alle in 560 px erstarren 2 s, dann Hollow Purple auf den Nächsten | „Six Eyes": Red auf jeder Stufe, Hollow Purple doppelt so oft |
| 🔥 Ignis (W20) | 50 % | Molten Core | 5 s immun, zweimal Lava überall außer auf Inseln nahe den Spielern | breitere, längere Feuerspur |

Alle anderen Bosse haben keine Phasen.

**Gemeinsamer Rahmen** (`shooter.js` `bossPhase` / `phaseTick` / `phasePost`, Daten in
`arena-mobs.js` → `phases: [{ at, key, name, shield, karma, up }]`):

- Der Treffer, der über eine Schwelle ginge, wird auf die Schwelle gekappt – kein
  Überspringen per Burst.
- `shield`: ms immun, oder `'adds'` = bis die Adds tot sind (mindestens 2,5 s, höchstens
  `maxMs`). Immun: Treffer zeigen „IMMUNE", Brennen tickt nicht, der Boss steht.
- `karma`: ms, in denen Treffer zurückgehen (Anzeige „KARMA").
- `up`: Power-up danach (Schaden, Tempo, Abklingzeiten), z. B. Omega im Finale ×1,34 Schaden.
- Adds sind `parent`-Mobs des Bosses (keine Drops, zählen nicht zum Umherlaufen).

**Optik** (`public/zfx.js`): Phasen-Name groß in der Farbe der Phase plus Hinweis, was zu tun
ist („RESIST THE PULL", „KILL THE WATCHERS", „DON'T SHOOT · KARMA" …). Je Mechanik eigene
Animation: Spiralarme nach innen (Crunch), schwarze Sonne mit Korona (Eclipse, Last Light),
Sternenkuppel (Domain), Waage und Zackenkranz (Karma), Glutrisse (Molten), Schildringe
(Reactor, Watchers), Energie-Blitze vom Boss zu seinen Adds. Dazu Schwarzloch-Orb,
Dunkelheit mit Lichtkreisen, Aura in Phasenfarbe, Striche auf der Lebensleiste an den
Schwellen des jeweiligen Bosses (`catalog().phases`).

**Protokoll:** `boss` Index 18 Phase, 19 Schild-ms, 20 Schild-Art (1 immun, 2 Karma),
21/22 Orb x/y, 23 dunkel, 24 Phasen-Key; `mobs` Index 14 Phase, 15 Schild-ms, 16 parent;
`shHit` `immune`/`karma`; `shFx` `bphase` mit `key`, `label`, `rgb`, `ms`.

Test (72/72): alle sieben Phasen-Bosse unter Dauerfeuer (Venuzdonoa Ultra, PaP 5) –
richtige Zahl Phasen, auf jeder Zeit-Schwelle ≥1,5 s gehalten, kein Schaden durch
Schild/Karma, Power-up, 3 Wächter / 4 Reaktoren, Karma-Treffer, Sog bei Omega, Orb aktiv;
acht Bosse ohne Phasen bleiben ohne. Dazu Screenshot der sechs Animationen.

## 🔥 Brennen sichtbar, Fuse mit geschützten Items (25.09.2026, Schmoggi / Max)

**Brennen** (Schmoggi: „Burn-Effekte visuell deutlicher machen"): Bisher schickte der
Server gar nicht mit, ob ein Gegner brennt – man sah es nur am Schaden. Jetzt trägt das
Gegner-Array Index 17 und das Boss-Array Index 25 den Zustand (1 Feuer, 2 Amaterasu).
`zBurnFx` (`public/zfx.js`) zeichnet über der Figur hochzüngelnde Flammen, Glut-Funken und
einen Schein am Boden; Amaterasu in Schwarz mit violettem Rand. Mindestgröße 22 px, damit
es auch an kleinen Gegnern auffällt. Spieler, die brennen, bekommen dieselben Flammen statt
des dünnen orangen Rings.

**Fuse mit geschützten Items** (Schmoggi: „protectede Items erlauben, gefused zu werden,
aber natürlich immer noch nicht salvagebar"; Max: „nur als Fuse-Main-Item"): war schon so
und bleibt so – ein geschütztes Item kann Haupt-Item sein (der 🔥-Fuse-Knopf erscheint
auch bei ⭐), als Opfer wird es abgelehnt („Protected items cannot be fused in"),
Salvage bleibt gesperrt. Geprüft mit einem echten `arFuse`-Aufruf (Main geschützt → klappt,
Opfer geschützt → Fehler). Keine Codeänderung.

## 🧟 Zombies: Welle starten, Autoplay, Radar, Box-Preis je Runde (25.09.2026, Max)

- **▶ Start wave** (Knopf oben in der Leiste, Taste **N**, nur in der Pause): solo startet die
  nächste Welle nach 1,5 s. Zu zweit oder mehr heißt der Knopf „Ready (x/n)" – erst wenn alle
  bereit sind, geht es los. Nach jeder Welle wird „bereit" zurückgesetzt.
- **🔁 Autoplay** (Knopf daneben, pro Spieler an/aus): zählt in jeder Pause automatisch als
  bereit – wer durchspielen will, hat nur noch 1,5 s Pause. Zu mehreren gilt das nur, wenn alle
  bereit oder auf Autoplay sind. Server: `zReady`/`zAuto`, `zReadyCheck` jeden Pausen-Tick.
- **Radar:** Im Zombie-Modus schickt der Server `zmb.radar` = alle Spieler (x, y, ich, tot)
  und alle Zombies (x, y, Boss) – die Minimap zeigt Mitspieler grün (tot grau) und jeden
  Zombie, egal wie weit weg. Die Sicht im Spiel selbst bleibt wie bisher.
- **Mystery-Box:** Der Preis stieg mit jedem Kauf (2000, 2500, 3000 …) und blieb das ganze
  Spiel oben. Jetzt fällt er nach jeder Welle wieder auf 2000. Utility-Kiste und Altar
  unverändert.

Test (11/11): solo Knopf → Welle nach ≤1,5 s, Welle vorbei → Box-Preis zurück, bereit
gelöscht; Autoplay startet die nächste Welle selbst; zu zweit reicht einer nicht, beide
schon; Radar mit beiden Spielern, `readyN`.

## 🛡️ Guild House als echte Safe Zone (25.09.2026, Max: „ich werd komplett vom Boss belagert")

Schaden im Guild House war schon gesperrt, aber ein Boss behielt einen bis zu 9 s als Ziel,
wurde durch Schüsse von drinnen neu provoziert und campte vor dem Tor. Jetzt gilt drinnen
und im Tor (40 px Rand, `GUILD_SAFE`, `safeIn`):

- Gegner sehen niemanden drinnen (`mobSees`), wer reingeht, wird sofort als Ziel fallen
  gelassen, Boss-Provokation gelöscht – der Boss zieht ab.
- Kein Schaden und keine Treffer-Effekte (Brennen, Frost, Festnageln) für Leute drinnen.
- Wer von drinnen schießt, macht keinen Schaden an Gegnern und provoziert niemanden – kein
  Farmen aus der Safe Zone.

Test (5/5, Oberflächen-Karte mit Titan): Ziel verloren nach Betreten, 8 s kein Schaden,
kein Brennen, Schüsse von drinnen ohne Wirkung, Boss nicht provoziert.

## 🔇 Custom-Sounds aus, Tanya bleibt in der Map (25.09.2026, Max)

- **Custom-Sounds komplett aus** (Max nach Tanya: „zu krank laut"): `VOX_ON = false` in
  `public/voice.js` – kein Clip spielt mehr, nichts wird geladen, es bleiben die
  eingebauten Synth-Sounds. Slots und mp3 auf edge bleiben liegen; wieder an mit `VOX_ON = true`.
- **Tanya flog aus der Map:** Sie hatte als einziger Gegner `fly` und lief damit durch
  Wände (nur der Kartenrand zählte) – in Dungeons landete sie im Fels außerhalb der Räume.
  Jetzt blocken Wände auch sie, und sie läuft per Wegfeld (`zNav`) wie die Bosse; `fly` ist
  nur noch Optik. Test: 60 s Jagd auf der Oberfläche und in je drei Bunker- und Labor-Dungeons –
  vorher 215 bis 1.406 Ticks in der Wand, jetzt 0.

### Nachtrag: Niemand bugt mehr in den Fels (Max: „Rick bugged auch raus – check das für alle")

Ursache in allen Dungeons: Wandstücke entstehen nur, wo Fels an Boden grenzt. Das Innere des
Felsens (Kachel `'0'`) war für die Kollision **freier Raum** – wer dort landete, war aus der
Map. Rick springt per Portal an einen „freien" Punkt nahe dem Ziel, Gojo, Meeseeks & Co. genauso,
Tanya flog dazu durch Wände. Fix an der Wurzel (`makeWorld`): in Karten mit Kachelraster zählt
jede Fels-Kachel als blockiert – gilt für Gegner, Teleports, Spieler-Fähigkeiten und Spawns.

Test für **jeden** Nicht-Zombie-Gegner (Specials auf „hard", damit alle Fähigkeiten laufen)
auf der Oberfläche und in je zwei Bunker- und Labor-Dungeons, 50 s Jagd, gezählt: Ticks in
Wand oder Fels, auch für gespawnte Adds. Alter Code: Rick, Gojo, Meeseeks, Queen, Golem u. a.
hunderte Ticks im Fels. Neuer Code: sauber – bis auf den Golem im Labor, der ist mit 52 px
Radius zu breit für einen 80-px-Gang; Raid-Bosse kommen aber nur auf der Oberfläche vor.

## 🔉 Gegner machen Geräusche (25.09.2026, Max: „irgendwie machen die Gegner keinen Sound?")

Normale Gegner waren nie vertont – man hörte nur eigene Schüsse, Treffer und Boss-Effekte.
`shEnemySounds` (`public/index.html`, bei jedem Snapshot) erzeugt jetzt Synth-Sounds wie der
Rest des Spiels (keine Clips):

- **Schuss:** neue Kugel eines Gegners (`owner` beginnt mit `m#`) – kurzer Knall, Bosse tiefer
  und dumpfer. Schrot/Salve zählt je Gegner und Snapshot einmal.
- **Zielen:** Sniper u. a. beginnen zu zielen → heller Piep.
- **Ansturm:** Vorwarnung eines Charge → tiefes Knurren.
- **Tod:** Gegner verschwindet mit < 35 % HP → dumpfer Schlag.
- Lautstärke nach Entfernung (quadratisch, ab 1.100 px still), höchstens 6 Gegner-Sounds je
  250 ms, damit volle Räume nicht zum Lärmteppich werden. Hängt am normalen Sound-Regler/Mute.

Test (7/7, Logik mit nachgebauten Snapshots): Salve einmal, keine Wiederholung derselben
Kugel, weit weg still, Tod, Knurren, Drossel bei 30 gleichzeitigen Schützen, Spielerkugeln
ignoriert.

## 🔥 Roy jagt, Gojo spammt nicht mehr (25.09.2026, Max)

**Roy Mustang stand afk rum.** Zwei Ursachen, die Fernkämpfer allgemein betrafen:
1. Ohne Sichtlinie ließ ein Gegner sein Ziel nach 3,5 s fallen und fand es hinter einer Wand
   nie wieder. **Specials** (Rick, Gojo, Tanya, Roy) jagen jetzt wie Bosse: Wer in ihrer
   Reichweite ist, bleibt Ziel bzw. wird gefunden, auch ohne Sichtlinie (Safe Zone ausgenommen).
2. Fernkämpfer in Reichweite blieben stehen und wichen seitlich aus – auch wenn eine Wand
   dazwischen war. Jetzt laufen **alle** Fernkämpfer ohne Sichtkontakt (> 0,5 s) übers Wegfeld
   ran, bis sie wieder freie Schussbahn haben.

Dazu bekommt Roy mehr zu tun: Feuerbolzen (Dreiersalve, setzt in Brand), Schnipp-Salve mit
drei Einschlägen alle 2,2 s (statt einem alle 3 s), Flammenwand schon ab „normal" (9 s, hard 6 s),
alle 7 s ein Seitensprung mit Feuerspur. Test (Labor-Dungeon, 30 s, Spieler läuft umher):
Schaden an den Spieler normal 236 → 410.

**Gojo auf „hard" spammte alles** – besonders nach der Domain-Phase („Six Eyes"): Hollow Purple
alle ~3 s, Red alle ~6 s, Infinite Void alle ~11 s mit 2,5 s Starre und Einschlägen mitten in
die Starre. Jetzt: mindestens 2,5 s zwischen zwei Fähigkeiten, Void hard 20 s / normal 26 s,
Starre 1,3 s und die Einschläge landen erst danach (ausweichbar), Red 10 s, Six Eyes nur noch
×0,7 statt ×0,5, nach der Domain-Phase 15 s kein normales Void. Test (hard, nach der Phase,
60 s): 18 Purple / 5 Void / 9 Red / 12,5 s eingefroren → 11 / 3 / 6 / 4 s.

## 🔒 Missionen schalten sich nacheinander frei (25.09.2026, Max)

„Erst die einfachen geschafft haben, bevor man die besseren machen kann": Easy ist immer offen,
**Normal** nach einer geschafften Easy-Mission, **Hard** nach einer geschafften Normal-Mission –
egal ob Bunker oder Labor. Gezählt wird über die vorhandene Konto-Statistik `missions_easy/
normal/hard` (steigt, wenn man nach dem Boss-Kill das Guild House erreicht); wer schon eine
höhere Stufe geschafft hat, hat die darunter automatisch offen.

Server (`missionOpen`): Anlegen, Umstellen und Beitreten prüfen die Stufe, beim Start gehen nur
Mitglieder mit, die die Stufe offen haben. Quest Board: gesperrte Karten grau mit 🔒 und
Hinweis, Gruppen mit gesperrter Stufe zeigen „🔒 Locked". Neue Aufträge starten auf Easy.

Test (8/8): frisches Konto nur Easy, Hard/Normal abgelehnt, nach Easy geht Normal aber nicht
Hard, Beitritt in eine Normal-Gruppe ohne Easy abgelehnt, Konto mit Hard-Erfolgen hat alles.

## 🧟 Zombie-Modus im Pixel-Look (25.09.2026, Max, Issue #16)

Die neun Zombie-Bosse, der Watcher (Kek-Eye-Phase) und der Reaktor (Titan-Phase) waren die
letzten Gegner ohne Pixel-Sprite. Jetzt in `public/pfx.js`, 24 Pixel breit wie die Raid-Bosse,
jeder mit eigener Palette und Leucht-Punkt:

| Boss | Figur |
|---|---|
| Abomination | violetter Fleischberg mit Nähten, drei Mäulern und Hakenarm, stapft |
| Lord Morvath | Lich in grüner Kutte mit Knochenstab und Seelenflamme, schwebt |
| Arachna | orange Riesenspinne mit Musterung, Beine laufen |
| Ignis | Lava-Riese mit Flammenkrone und glühenden Rissen, stapft |
| Voltra | Sturmgeist in blauer Robe mit Blitzen, schwebt |
| The Kek Eye | Riesenauge mit Adern und Tentakeln, schwebt |
| Judge Bones | Skelett-Richter in schwarzer Robe mit blauem Auge und Hammer |
| Solaris | Sonnengesicht mit Flügeln und weißer Robe, schwebt |
| Omega | Nachtschwarze Gestalt voller Sterne mit goldener Krone, schwebt |
| Watcher / Reactor | kleines Wächterauge / Stahlbehälter mit glühendem Kern |

Strahl, Wirbel, Wut und Phasen-Optik kommen weiter aus `zfx.js` (`zBossAura`, Phasen), nur die
Figur ist jetzt ein Sprite. Damit hat jeder Gegner im Spiel ein Pixel-Sprite (geprüft über alle
Einträge in `arena-mobs.js`).

## 🛠️ Creative-Menü neu (25.09.2026, Max: „nicht alle Items, muss dringend übersichtlicher, Items Level geben")

Taste **C** im Raid (Creative an). Aufbau:
- **Tabs mit Zählern:** Waffen 50 · Rüstung 52 · Verbrauchsgut 33 · Rucksäcke 6 – immer alles aus
  dem Katalog, „showing X of Y" zeigt, wenn ein Filter etwas ausblendet.
- **Unterfilter:** Waffen Basics / Specials / ✦ Uniques; Rüstung Helm / Weste / Hose / Schuhe / ✦ Uniques;
  Verbrauchsgut Normal / ✦ Uniques. Suche auch nach Set-Namen.
- **Gruppen:** Uniques immer oben; Rüstung nach Set (Scout, Soldier, Medic, … plus Einzelteile),
  innerhalb nach Slot; Verbrauchsgut nach Heilung / Wurf / Buffs & Fähigkeiten.
- **Karten mit Kurzwerten:** Waffen Schaden und Schuss/s, Rüstung Slot und HP, Verbrauchsgut die
  Beschreibung; ab welcher Seltenheit es die Basis normal gibt.
- **Einstellungen:** Seltenheit, **Level 1–30** (Schieberegler; ab 20 „awakened" für Uniques) und bis
  zu **3 Effekte** mit Stufe. Server `crGive` setzt `wxp` passend zum Level.
- Knöpfe je Karte: Klick = in den Rucksack, „1"/„2" = als Primär/Sekundär anlegen, „⚡" = Rüstung anlegen.

## 🎯 Hitboxen passend zu den Pixel-Figuren (25.09.2026, Max: „man kann durch Oberkörper oder Köpfe schießen")

Der Server prüfte Treffer als Kreis (Radius `r`) um den Mittelpunkt – die Pixel-Figuren ragen
aber bis zu ~2–5 r nach oben (Kopf eines Scav bei 2,8 r, Gojo 4,8 r). Kopf und Oberkörper waren
Luft.

`hitbox.js` lädt beim Start `public/bfx.js` + `pfx.js` (dieselben Sprite-Daten wie der Browser)
in eine Sandbox und rechnet für jede Figur aus, wie hoch sie ist (ohne leere Rasterzeilen).
Geprüft wird gegen eine **senkrechte Kapsel** mit Radius r vom Mittelpunkt bis zum Kopf:

- Kugeln gegen Gegner (`mobGap`), Strahlen (Railgun, Kamehameha … – Fuß, Mitte, Kopf), der
  Nahschuss-Sonderfall, Explosionen, Flächen- und Dauerschaden.
- **PvP:** Spieler-Schüsse und -Strahlen auf Spieler ebenso gegen die Spielerfigur.
  Gegner-Kugeln auf Spieler bleiben beim alten Kreis (sonst würde es plötzlich schwerer).
- `mobsNear` sucht um `MOB_REACH` (höchste Figur) weiter, damit hohe Figuren gefunden werden.

Test: waagerechter Schuss auf Kopf-/Brusthöhe – vorher bei Scav (1,5 und 2,3 r), Zombie,
Titan, Gojo und Omega vorbei, jetzt Treffer; 0,5 r über dem Kopf weiterhin vorbei. Nebenwirkung
im DPS-Test: Streuwaffen treffen deutlich öfter (Shotgun 42 → 84 DPS auf 300 px).

## 🧍 Charakter-Skins im Cosmetic Shop (25.09.2026, Max: „jetzt wo man ein Mensch ist")

Neue Shop-Kategorie **Characters** (`shop.js`, `cat: 'char'`): 19 Figuren für die Arena (Raid,
Missionen, PvP, Zombies), rein optisch. Aufgebaut aus dem Pixel-Baukasten (`public/pfx.js`
`human()`), dafür neue Köpfe (Ninja-Maske, Piratentuch mit Augenklappe, Cowboyhut, Ritterhelm
mit Federbusch, Astronautenhelm, Zauberhut mit Bart, Samurai-Helm, Wikingerhelm, Krone,
Kochmütze, lange Haare, Zylinder, Cyborg-Gesicht) und ein Umhang-Oberkörper.

| Seltenheit | Figuren |
|---|---|
| Common | Recruit, Farmer, Hoodie (in Spielerfarbe), Chef |
| Rare | Doctor, Cowboy, Pirate, Gentleman, Ninja (Stirnband in Spielerfarbe), Knight, Astronaut |
| Epic | Viking, Samurai, Wizard, Vampire (leuchtende Augen), Cyborg (leuchtendes Auge) |
| Legendary | Neon Hacker, Shadow Reaper, Golden Emperor (alle mit Leuchten) |

- **Rotation:** täglich eine Figur (ohne Legendary), wöchentlich fest eine Epic/Legendary-Figur
  (sonst kamen die Legendaries in 60 Tagen kaum vor). Test über 120 Tage: alle Figuren tauchen auf.
- **Arena:** Der Server merkt sich beim Betreten die angelegte Figur (`charOf`, `ch` im
  Spieler-Zustand), der Browser baut sie mit `pxCharKind` (Palette mit `self` = Spielerfarbe).
  Umziehen gilt ab dem nächsten Betreten. Hitbox gleich hoch wie die Standardfigur.
- **Shop-Vorschau:** Die Figur läuft auf der Stelle (Pixel, nicht geglättet).

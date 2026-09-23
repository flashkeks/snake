// Kekemon (5.1a): Attacken, die zur Figur passen.
//
// Drei Stufen, die erste passende gewinnt:
//   1. SIG   – eigene Attacken fuer bekannte Figuren (Name exakt, klein)
//   2. FRAN  – Attacken-Pool je Serie/Franchise (Anfang von `from`, klein);
//              Nebenfiguren ziehen daraus deterministisch
//   3. sonst – der Pool des Kartentyps (cards.js, MOVES)
//
// Format (kompakt, damit die Liste pflegbar bleibt):
//   SIG:  'name|kleine Attacke|grosse Attacke|effekt|typ'
//         typ ist optional und ueberschreibt den errechneten Typ
//   FRAN: 'serie|klein1,klein2,…|gross1:effekt,gross2:effekt,…|typ'
//         typ optional (Standardtyp der Serie, wenn die Figur keinen eigenen hat)
// Effekte: none burn stun pierce heal drain boost
// Typen:   fire water electric nature psychic dark light fighting steel

const SIG_LINES = `
satoru gojou|Lapse: Blue|Hollow Purple|pierce|psychic
levi|Blade Spin|Thunder Spear Barrage|pierce|steel
luffy monkey|Gum-Gum Pistol|Gear 5: Bajrang Gun|boost|fighting
killua zoldyck|Thunderbolt|Godspeed: Whirlwind|stun|electric
eren yeager|Titan Punch|The Rumbling|pierce|fighting
zoro roronoa|Oni Giri|King of Hell: Three-Sword Style|pierce|steel
lelouch lamperouge|Geass Command|Checkmate Gambit|stun|psychic
emilia|Ice Shard|Frost Spirit Puck|stun|water
l lawliet|Deduction|Five Percent Certainty|pierce|psychic
ken kaneki|Kagune Strike|Centipede Rampage|drain|dark
mikasa ackerman|Blade Rush|Ackerman Awakening|boost|steel
arataka reigen|Salt Splash|Special Move: Salt Splash Omega|stun|light
guts|Dragonslayer Swing|Berserker Armor Frenzy|drain|dark
frieren|Zoltraak|Judradjim Lightning|pierce|psychic
maomao|Poison Test|Apothecary's Remedy|heal|nature
kurisu makise|Time Leap Theory|Amadeus Protocol|stun|electric
thorfinn karlsefni|Dagger Jab|True Warrior's Resolve|heal|fighting
makima|Chain Pull|Control Devil: Bang|stun|dark
itachi uchiha|Fireball Jutsu|Tsukuyomi|stun|dark
yuuji itadori|Divergent Fist|Black Flash|pierce|fighting
rintarou okabe|Mad Scientist Laugh|Reading Steiner|stun|psychic
mai sakurajima|Bunny Girl Glare|Adolescence Syndrome|stun|light
denji|Chainsaw Rev|Chainsaw Man Rampage|drain|fire
kurapika|Chain Jail|Emperor Time|pierce|psychic
shigeo kageyama|Psychic Push|???% Explosion|boost|psychic
power|Blood Spike|Blood Hammer|drain|dark
kakashi hatake|Chidori|Kamui|pierce|electric
kaguya shinomiya|Cold Stare|Love Is War: Checkmate|stun|dark
violet evergarden|Typewriter Barrage|Letter of Love|heal|light
light yagami|Write a Name|Kira's Judgement|pierce|dark
edward elric|Alchemy Spike|Stone Fist Transmutation|pierce|steel
naruto uzumaki|Shadow Clone|Rasenshuriken|pierce|nature
tanjirou kamado|Water Surface Slash|Hinokami Kagura: Dance|burn|water
sakura matou|Shadow Tendril|Dark Sakura Engulf|drain|dark
megumi fushiguro|Divine Dogs|Chimera Shadow Garden|drain|dark
marin kitagawa|Cosplay Pose|Perfect Cosplay Reveal|boost|light
joseph joestar|Hamon Punch|Your Next Line Is…|stun|light
shouto todoroki|Ice Wall|Flashfreeze Heatwave|burn|water
megumin|Tiny Spark|EXPLOSION!|pierce|fire
askeladd|Dagger Trick|Betrayal Strike|pierce|dark
osamu dazai|Nullify|No Longer Human|stun|psychic
rem|Morning Star|Oni Rage|boost|fighting
katsuki bakugou|AP Shot|Howitzer Impact|burn|fire
chika fujiwara|Love Detective|Chika Dance|stun|light
gintoki sakata|Wooden Sword|Shiroyasha Awakens|boost|fighting
itsuki nakano|Study Session|Quintuplet Resolve|heal|light
kiyotaka ayanokouji|Calculated Move|White Room Mastery|pierce|psychic
ichigo|Franxx Kick|Strelizia Unison|boost|steel
senkuu ishigami|Revival Fluid|Ten Billion Percent Science|heal|electric
subaru natsuki|Return by Death|Invisible Providence|stun|dark
gon freecss|Jajanken: Rock|Adult Gon Transformation|boost|fighting
jin-u seong|Dagger Rush|Arise!|drain|dark
sanji|Diable Jambe Kick|Ifrit Jambe|burn|fire
saitama|Normal Punch|Serious Series: Serious Punch|pierce|fighting
robin nico|Seis Fleur|Mil Fleur: Gigantesco Mano|stun|nature
izumi miyamura|Piercing Glance|Hidden Tattoo Reveal|boost|dark
hitagi senjougahara|Stapler Threat|Crab Oddity Strike|stun|dark
aki hayakawa|Fox Devil: Kon|Future Devil Contract|pierce|dark
zero two|Klaxosaur Horn|Darling Unison|drain|fire
yuu ishigami|Gloomy Aside|Cheer Squad Spirit|heal|dark
asuka langley souryuu|Progressive Knife|Unit-02 Beast Mode|boost|fire
inosuke hashibira|Fang One: Pierce|Beast Breathing: Crazy Cutting|boost|nature
shouyou hinata|Quick Attack|Minus Tempo Spike|pierce|fighting
nezuko kamado|Kick|Exploding Blood|burn|fire
ichigo kurosaki|Getsuga Tenshou|Mugetsu|pierce|dark
roy mustang|Finger Snap|Flame Alchemy Inferno|burn|fire
yor forger|Stiletto Throw|Thorn Princess Assassination|pierce|dark
spike spiegel|Jeet Kune Do|Bang|pierce|steel
joutarou kuujou|ORA Punch|Star Platinum: The World|stun|fighting
hisoka morow|Bungee Gum|Texture Surprise|stun|psychic
armin arlert|Strategy|Colossal Titan Blast|burn|psychic
izuku midoriya|Detroit Smash|One For All: Full Cowl 100%|boost|fighting
shinobu oshino|Vampire Bite|Kokorowatari Slash|drain|dark
hange zoe|Titan Research|Thunder Spear Volley|pierce|electric
rimuru tempest|Predator|Beelzebuth Devour|drain|water
zenitsu agatsuma|Thunderclap|Thunderclap and Flash: Godspeed|stun|electric
kento nanami|Ratio Technique|Collapse|pierce|steel
nobara kugisaki|Hairpin|Resonance|pierce|steel
anya forger|Mind Read|Heh|stun|psychic
maki zenin|Split Soul Katana|Heavenly Restriction|boost|steel
sasuke uchiha|Chidori Stream|Susanoo: Indra's Arrow|pierce|electric
erwin smith|Advance!|Final Charge|boost|light
yato|Rend|Sekki Exorcism|pierce|dark
rin toosaka|Gandr Shot|Jewel Magecraft Barrage|burn|fire
hachiman hikigaya|Cynical Remark|Loner's Sacrifice|heal|dark
koyomi araragi|Vampire Regeneration|Kiss-Shot Bond|heal|dark
tobio kageyama|Precision Toss|King of the Court|pierce|fighting
giyuu tomioka|Water Wheel|Eleventh Form: Dead Calm|stun|water
hitori gotou|Guitar Solo|Guitar Hero Rampage|boost|electric
homura akemi|Time Stop|Soul Gem Rewind|stun|psychic
artoria pendragon|Strike Air|Excalibur|pierce|light
miku nakano|History Trivia|Quintuplet Resolve|heal|light
sukuna|Cleave|Malevolent Shrine|pierce|dark
kyouko hori|Scolding|Big Sister Mode|heal|light
kana arima|Child Star Aura|Spotlight Steal|boost|light
yuuta okkotsu|Rika!|Pure Love Beam|pierce|dark
shouko nishimiya|Notebook Message|A Silent Voice|heal|light
roxy migurdia|Water Ball|Cumulonimbus|stun|water
rei ayanami|AT Field|Unit-00 Sacrifice|heal|psychic
kyoujurou rengoku|Rising Scorching Sun|Ninth Form: Rengoku|burn|fire
shinji ikari|Get in the Robot|Unit-01 Awakening|boost|psychic
johan liebert|Whisper|The Nameless Monster|drain|dark
nino nakano|Sharp Tongue|Quintuplet Resolve|heal|light
misato katsuragi|Pistol Shot|Operation Yashima|pierce|steel
ai hayasaka|Disguise|Perfect Maid Service|heal|light
c.c.|Code Touch|Immortal Witch|heal|psychic
yami sukehiro|Dark Slash|Dimension Slash|pierce|dark
shouya ishida|Apology|Hearing Again|heal|light
sakuta azusagawa|Deadpan Remark|Puberty Syndrome Fix|heal|light
yuu nishinoya|Rolling Thunder|Guardian Deity Receive|heal|fighting
karma akabane|Knife Feint|Koro-sensei Assassination|pierce|dark
kyou souma|Cat Scratch|True Form Unleashed|burn|fire
reze|Bomb Punch|Bomb Devil Blast|burn|fire
law trafalgar|Shambles|Gamma Knife|pierce|psychic
nami|Thunder Bolt Tempo|Zeus Breeze Tempo|stun|electric
manjirou sano|High Kick|Invincible Mikey|boost|fighting
asuna yuuki|Linear|Mother's Rosario|pierce|light
loid forger|Disguise|Operation Strix|stun|steel
gyro zeppeli|Steel Ball Spin|Ball Breaker|pierce|steel
yukino yukinoshita|Cold Logic|Service Club Request|stun|water
toge inumaki|"Stop."|"Blast Away."|stun|psychic
koro-sensei|Mach 20 Dodge|Tentacle Barrage|stun|electric
gokuu son|Kamehameha|Spirit Bomb|pierce|fighting
chrollo lucilfer|Skill Hunter|Double Face|drain|dark
dio brando|MUDA MUDA|ZA WARUDO!|stun|dark
kazuma satou|Steal|Drain Touch|drain|dark
asta|Anti-Magic Slash|Black Divider|pierce|dark
shinobu kochou|Butterfly Sting|Wisteria Poison|burn|nature
meruem|Tail Whip|Rose Poison|drain|dark
kamina|Kamina Punch|Giga Drill Break|pierce|fighting
ace portgas|Fire Fist|Great Flame Commandment: Flame Emperor|burn|fire
tatsumaki|Psychic Toss|Tornado of Terror|stun|psychic
chopper tony tony|Heavy Point|Monster Point|boost|nature
fern|Zoltraak|Rapid Barrage|pierce|psychic
kisuke urahara|Benihime Slash|Kannonbiraki Benihime Aratame|drain|dark
griffith|Sabre Strike|Eclipse|drain|light
touka kirishima|Ukaku Shards|Rabbit Barrage|burn|dark
aqua|Purification|God Blow|heal|water
suguru getou|Cursed Spirit Swarm|Uzumaki|drain|dark
ryuuko matoi|Scissor Blade|Senketsu Kisaragi|boost|fire
revy|Two Hands|Bullet Storm|pierce|steel
simon|Core Drill|Giga Drill Maximum|pierce|steel
kurumi tokisaki|Zafkiel: Aleph|Time Eater City|drain|dark
tengen uzui|Explosive Blades|Sound Breathing: Constant Resounding|burn|fire
gilgamesh|Gate of Babylon|Enuma Elish|pierce|light
reiner braun|Armored Charge|Armored Titan Tackle|boost|steel
ban|Snatch|Hunter Fest|drain|dark
rukia kuchiki|Some no Mai|Hakka no Togame|stun|water
alphonse elric|Armor Punch|Soul Transmutation|heal|steel
vegeta|Galick Gun|Final Flash|pierce|fighting
gaara|Sand Coffin|Sand Waterfall Funeral|stun|nature
aoi toudou|Boogie Woogie|Brotherly Black Flash|pierce|fighting
erza scarlet|Requip|Heaven's Wheel Armor|pierce|steel
ryuk|Apple Snack|Write the Last Name|pierce|dark
sousuke aizen|Kyouka Suigetsu|Kurohitsugi|stun|dark
akame|Murasame Slash|One-Cut Killer|burn|dark
misa amane|Shinigami Eyes|Second Kira|pierce|dark
toshinori yagi|Texas Smash|United States of Smash|pierce|fighting
giorno giovanna|Life Giver|Gold Experience Requiem|heal|light
esdeath|Ice Shards|Mahapadma|stun|water
death the kid|Twin Pistol Shot|Death Cannon|pierce|dark
jiraiya|Toad Oil Bullet|Sage Mode Rasengan|burn|nature
garou|Whirlwind Iron Cutting Fist|Cosmic Fear Mode|boost|dark
genos|Incinerate|Machine Gun Blows|burn|steel
natsu dragneel|Fire Dragon Iron Fist|Fire Dragon's Roar|burn|fire
alucard|Casull Shot|Release Level Zero|drain|dark
kenpachi zaraki|Reckless Swing|Nozarashi Unleashed|boost|fighting
himiko toga|Knife Stab|Transform|drain|dark
yoichi isagi|Direct Shot|Metavision Goal|pierce|fighting
darkness|Clumsy Swing|Crusader Tank|heal|steel
shanks|Sword Slash|Conqueror's Haki|stun|light
mikoto misaka|Electric Jolt|Railgun|pierce|electric
vash the stampede|Revolver|Angel Arm|pierce|light
momonga|Grasp Heart|The Goal of All Life Is Death|drain|dark
tomura shigaraki|Touch|Decay Wave|drain|dark
dabi|Blue Flame|Flashfire Fist: Prominence Burn|burn|fire
sebastian michaelis|Silver Knives|Demon Butler|pierce|dark
madoka kaname|Pink Arrow|Law of Cycles|heal|light
pain|Almighty Push|Planetary Devastation|stun|psychic
rock lee|Leaf Hurricane|Eight Gates: Evening Elephant|boost|fighting
brook|Soul Solid|Soul King's Lullaby|stun|water
mugen|Breakdance Kick|Wild Style|boost|fighting
pochita|Chain Rev|Hero of Hell|drain|fire
minato namikaze|Flying Thunder God|Reaper Death Seal|stun|electric
hinata hyuuga|Gentle Fist|Twin Lion Fists|pierce|light
nanachi|Scaled Hands|Burnt Mud Care|heal|dark
alucard|Casull Shot|Release Level Zero|drain|dark
yui hirasawa|Guitar Riff|Fuwa Fuwa Time|heal|light
albedo|Ginnungagap|Guardian of the Tomb|pierce|dark
kanna kamui|Lightning Tail|Dragon Lightning|stun|electric
tohru|Tail Swipe|Dragon Breath|burn|fire
sung jin-woo|Dagger Rush|Arise!|drain|dark
`;

const SIG_HERO = `
batman|Batarang|The Dark Knight Returns|stun|dark
batman ii|Batarang|Justice Buster Suit|stun|steel
superman|Heat Vision|Solar Flare Punch|pierce|light
wonder woman|Lasso of Truth|Godkiller Strike|stun|light
spider-man|Web Shot|Maximum Spider|stun|nature
iron man|Repulsor Blast|Unibeam|pierce|steel
thor|Mjolnir Throw|God of Thunder|stun|electric
hulk|Smash|Thunderclap|boost|fighting
captain america|Shield Throw|Avengers Assemble|heal|light
black widow|Widow's Bite|Red Room Takedown|stun|fighting
hawkeye|Trick Arrow|Explosive Volley|burn|steel
wolverine|Adamantium Claws|Berserker Rage|drain|steel
deadpool|Katana Slash|Maximum Effort|heal|fighting
evil deadpool|Katana Slash|Minimum Effort|drain|dark
venompool|Tongue Lash|Symbiote Katana|drain|dark
flash|Speed Punch|Infinite Mass Punch|pierce|electric
flash ii|Speed Punch|Speed Force Surge|stun|electric
flash iii|Speed Punch|Speed Force Surge|stun|electric
flash iv|Speed Punch|Speed Force Surge|stun|electric
aquaman|Trident Thrust|Call of the Seven Seas|stun|water
green arrow|Arrow Shot|Boxing Glove Arrow|stun|nature
hal jordan|Ring Construct|In Brightest Day|pierce|nature
guy gardner|Ring Fist|Construct Barrage|boost|nature
kyle rayner|Ring Construct|Ion Burst|pierce|nature
jessica cruz|Ring Shield|Willpower Surge|heal|nature
simon baz|Ring Construct|Emerald Knight|pierce|nature
joker|Joy Buzzer|Killing Joke|stun|dark
harley quinn|Mallet Bonk|Puddin' Chaos|stun|dark
thanos|Power Gem Blast|The Snap|pierce|dark
darth vader|Force Choke|Crimson Lightsaber Onslaught|drain|dark
darth maul|Saberstaff Spin|Duel of the Fates|pierce|dark
yoda|Force Push|Force Mastery|stun|light
luke skywalker|Lightsaber Strike|Jedi Return|heal|light
kylo ren|Force Freeze|Crossguard Fury|burn|dark
rey|Staff Strike|Skywalker Saber|boost|light
han solo|Blaster Shot|Shot First|pierce|steel
boba fett|Wrist Rocket|Jetpack Barrage|burn|steel
stormtrooper|Missed Shot|Blaster Volley|none|steel
jar jar binks|Clumsy Kick|Bombad Chaos|stun|water
greedo|Blaster Shot|Shoots Second|none|steel
doctor strange|Mystic Bolt|Eye of Agamotto|stun|psychic
scarlet witch|Hex Bolt|No More Mutants|pierce|psychic
vision|Mind Stone Beam|Density Phase|pierce|light
black panther|Vibranium Claws|Kinetic Pulse|boost|dark
captain marvel|Photon Blast|Binary Mode|burn|light
ant-man|Shrink Punch|Giant-Man Stomp|stun|nature
wasp|Wasp Sting|Swarm Dive|stun|nature
star-lord|Element Gun|Dance-Off|stun|fire
gamora|Godslayer Slash|Deadliest Woman Alive|pierce|dark
drax the destroyer|Knife Stab|Destroyer Rage|boost|fighting
groot|Branch Whip|I Am Groot|heal|nature
rocket raccoon|Blaster|Big Gun|burn|steel
loki|Illusion Dagger|God of Mischief|stun|dark
hela|Necrosword|Goddess of Death|drain|dark
odin|Gungnir|Odinforce|pierce|light
magneto|Metal Shard|Magnetic Storm|pierce|steel
professor x|Mind Probe|Cerebro Link|stun|psychic
jean grey|Telekinesis|Dark Phoenix|burn|fire
phoenix|Phoenix Flame|Phoenix Force Rebirth|heal|fire
cyclops|Optic Blast|Full Power Visor|pierce|fire
storm|Lightning Strike|Hurricane|stun|electric
rogue|Power Absorb|Kiss of Theft|drain|psychic
gambit|Kinetic Card|Royal Flush|burn|fire
beast|Acrobatic Kick|Genius Brute|boost|fighting
iceman|Ice Slide|Absolute Zero|stun|water
nightcrawler|BAMF|Teleport Barrage|pierce|dark
colossus|Steel Punch|Fastball Special|boost|steel
mystique|Shapeshift|Perfect Impostor|stun|dark
juggernaut|Charge|Unstoppable|pierce|fighting
apocalypse|Molecular Shift|Age of Apocalypse|boost|dark
cable|Plasma Rifle|Time Jump Strike|pierce|steel
x-23|Twin Claws|Berserker Barrage|drain|steel
psylocke|Psychic Knife|Crimson Dawn|pierce|psychic
emma frost|Diamond Form|Telepathic Blast|stun|psychic
silver surfer|Cosmic Blast|Power Cosmic|pierce|light
galactus|Consume|Devourer of Worlds|drain|dark
doctor doom|Mystic Bolt|Doom Is Inevitable|pierce|steel
mister fantastic|Stretch Punch|Genius Plan|stun|psychic
invisible woman|Force Field|Invisible Implosion|stun|psychic
human torch|Fireball|Supernova|burn|fire
thing|Clobberin' Time|Yancy Street Smash|boost|fighting
daredevil|Billy Club|Radar Sense Combo|stun|fighting
punisher|Shotgun Blast|War Journal|pierce|steel
elektra|Sai Strike|Assassin's Kiss|pierce|dark
kingpin|Cane Strike|Crime Lord Crush|stun|fighting
bullseye|Anything Throw|Never Miss|pierce|steel
ghost rider|Hellfire Chain|Penance Stare|burn|fire
blade|Silver Sword|Daywalker Rage|drain|dark
moon knight|Crescent Dart|Khonshu's Fist|pierce|light
luke cage|Unbreakable Punch|Sweet Christmas|boost|fighting
iron fist|Kung Fu Strike|The Iron Fist|boost|fighting
jessica jones|Super Punch|Alias Investigation|stun|fighting
shang-chi|Kung Fu Kick|Ten Rings|pierce|fighting
venom|Tendril Whip|We Are Venom|drain|dark
carnage|Symbiote Blades|Maximum Carnage|drain|dark
green goblin|Pumpkin Bomb|Goblin Glider Strike|burn|dark
doctor octopus|Tentacle Grab|Eight-Arm Crush|stun|steel
mysterio|Illusion Mist|Fish Bowl Mirage|stun|psychic
electro|Shock|Electro Surge|stun|electric
sandman|Sand Punch|Sandstorm|stun|nature
lizard|Tail Whip|Reptile Rage|drain|nature
rhino|Horn Charge|Stampede|boost|fighting
vulture|Wing Slash|Dive Bomb|pierce|steel
ultron|Encephalo-Ray|Age of Ultron|pierce|steel
red skull|Luger Shot|Cosmic Cube|pierce|dark
winter soldier|Metal Arm Punch|Soldier Protocol|pierce|steel
falcon|Wing Slash|Redwing Strike|pierce|steel
war machine|Shoulder Cannon|Full Arsenal|burn|steel
nick fury|Pistol Shot|S.H.I.E.L.D. Protocol|stun|steel
she-hulk|Legal Smash|Jennifer's Justice|boost|fighting
namor|Trident Strike|Imperius Rex|stun|water
black bolt|Whisper|Master Yell|pierce|psychic
nova|Nova Blast|Nova Force|pierce|light
beta ray bill|Stormbreaker|Korbinite Thunder|stun|electric
sentry|Golden Punch|The Void|drain|light
mephisto|Soul Deal|Hellfire Pact|drain|fire
dormammu|Flames of the Faltine|Dark Dimension|burn|fire
the comedian|Shotgun|It's All a Joke|pierce|steel
rorschach|Grappling Hook|Never Compromise|pierce|dark
dr manhattan|Disintegrate|Quantum Reshape|pierce|psychic
ozymandias|Catch the Bullet|Smartest Man Alive|stun|psychic
lex luthor|Kryptonite Shot|Warsuit Beam|pierce|steel
darkseid|Omega Beams|Anti-Life Equation|stun|dark
general zod|Heat Vision|Kneel Before Zod|boost|dark
doomsday|Bone Spike|Death of Superman|boost|dark
brainiac|Probe|Bottle City|stun|electric
bane|Venom Surge|Back Breaker|boost|fighting
two-face|Coin Flip|Double Barrel|pierce|dark
riddler|Riddle Me This|Question Mark Trap|stun|psychic
penguin|Umbrella Gun|Iceberg Lounge Ambush|stun|water
catwoman|Whip Crack|Cat Burglary|drain|dark
poison ivy|Vine Lash|Toxic Kiss|drain|nature
scarecrow|Fear Gas|Nightmare Toxin|stun|dark
mister freeze|Freeze Ray|Cold Heart|stun|water
killer croc|Bite|Sewer Ambush|drain|water
ra's al ghul|Sword Thrust|Lazarus Pit|heal|dark
deathstroke|Sword Slash|Terminator Strike|pierce|steel
robin|Bo Staff|Boy Wonder|stun|fighting
nightwing|Escrima Sticks|Acrobatic Takedown|stun|fighting
batgirl|Batarang|Oracle Assist|stun|fighting
red hood|Dual Pistols|Crowbar Vengeance|pierce|steel
cyborg|Sonic Cannon|Boom Tube|pierce|steel
martian manhunter|Martian Vision|Phase Shift|stun|psychic
green lantern|Ring Construct|In Brightest Day|pierce|nature
black canary|Punch|Canary Cry|stun|fighting
zatanna|!ti llehs|Backwards Spell|stun|psychic
john constantine|Hellblazer Hex|Exorcism|pierce|dark
swamp thing|Vine Grab|Green Avatar|heal|nature
shazam|Punch|Magic Lightning|stun|electric
black adam|Punch|Magic Lightning|stun|electric
lobo|Chain Hook|Main Man Brawl|boost|fighting
starfire|Starbolt|Tamaranean Fury|burn|fire
raven|Soul Self|Azarath Metrion Zinthos|stun|dark
beast boy|Animal Morph|T-Rex Rampage|boost|nature
sinestro|Yellow Construct|Fear Power|stun|dark
hellboy|Right Hand of Doom|Samaritan Shot|pierce|fire
spawn|Chain Whip|Necroplasm Blast|drain|dark
judge dredd|Lawgiver|I Am the Law|pierce|steel
goku|Kamehameha|Spirit Bomb|pierce|fighting
vegeta|Galick Gun|Final Flash|pierce|fighting
naruto uzumaki|Shadow Clone|Rasenshuriken|pierce|nature
one punch man|Normal Punch|Serious Punch|pierce|fighting
harry potter|Expelliarmus|Expecto Patronum|stun|light
james bond|Walther PPK|Q-Branch Gadget|pierce|steel
indiana jones|Whip Crack|Fortune and Glory|stun|nature
ethan hunt|Mask Swap|Mission Impossible|stun|steel
jason bourne|Improvised Weapon|Treadstone Protocol|stun|fighting
rambo|Bow Shot|First Blood|burn|steel
chuck norris|Roundhouse Kick|Chuck Norris Fact|pierce|fighting
godzilla|Tail Swipe|Atomic Breath|burn|fire
king kong|Chest Pound|Skull Island Rage|boost|fighting
predator|Wrist Blades|Plasma Caster|pierce|steel
alien|Tail Stab|Inner Jaw|drain|dark
t-800|Shotgun|I'll Be Back|heal|steel
t-1000|Liquid Blade|Liquid Metal Rebuild|heal|steel
t-850|Shotgun|Judgement Day|heal|steel
t-x|Plasma Cannon|Nanotech Override|stun|steel
master chief|Assault Rifle|Spartan Laser|pierce|steel
spock|Nerve Pinch|Mind Meld|stun|psychic
james t. kirk|Phaser|Kobayashi Maru|stun|light
jean-luc picard|Phaser|Make It So|heal|light
kathryn janeway|Phaser|Coffee and Command|heal|light
data|Positronic Punch|Emotion Chip|stun|steel
q|Snap|Continuum Prank|stun|psychic
katniss everdeen|Arrow|Mockingjay|burn|nature
buffy|Stake|Slayer Strength|pierce|light
ben 10|Omnitrix Slap|Alien Swap|boost|nature
captain planet|Earth Punch|The Power Is Yours|heal|nature
kool-aid man|Wall Smash|OH YEAH!|stun|water
paul blart|Segway Charge|Mall Cop Justice|stun|fighting
mr incredible|Punch|Incredible Strength|boost|fighting
elastigirl|Stretch|Elastic Slingshot|stun|fighting
dash|Speed Run|Super Sprint|stun|electric
violet parr|Force Field|Invisible Push|stun|psychic
jack-jack|Baby Laser|Demon Form|burn|fire
hit-girl|Butterfly Knife|Purple Rain|pierce|fighting
kick-ass|Baton|Real Hero|heal|fighting
sylar|Telekinesis|Hunger|drain|dark
claire bennet|Regenerate|Save the Cheerleader|heal|light
hancock|Punch|Crash Landing|boost|fighting
godzilla|Tail Swipe|Atomic Breath|burn|fire
leonardo|Katana|Cowabunga Formation|pierce|steel
donatello|Bo Staff|Tech Genius|stun|steel
michelangelo|Nunchuck|Pizza Party|heal|fighting
raphael|Sai Stab|Hothead Rampage|boost|fighting
living tribunal|Judgement|Omniversal Verdict|pierce|light
one-above-all|Glance|Creation|heal|light
`;

const SIG_TV = `
walter white|Chemistry Lesson|I Am the One Who Knocks|burn|dark
jesse pinkman|"Yeah, Science!"|Blue Sky Batch|burn|dark
hank schrader|Mineral Collection|DEA Takedown|stun|steel
saul goodman|Legal Loophole|Better Call Saul|stun|psychic
jimmy mcgill|Legal Loophole|Slippin' Jimmy Scam|stun|psychic
gustavo "gus" fring|Box Cutter|Los Pollos Hermanos|pierce|dark
michael "mike" ehrmantraut|Half Measures|No More Half Measures|pierce|steel
kim wexler|Legal Brief|Perfect Scam|stun|water
tyrion lannister|Drink and Know Things|Wildfire|burn|fire
jon snow|Longclaw|You Know Nothing|stun|water
daenerys targaryen|Dracarys|Mother of Dragons|burn|fire
arya stark|Needle|Faceless Assassination|pierce|dark
queen cersei lannister|Wine Glare|Sept Explosion|burn|dark
sansa stark|Stark Resolve|Queen in the North|heal|water
rick sanchez|Portal Gun|Pickle Rick|boost|electric
morty smith|"Aw Jeez"|Evil Morty Gambit|stun|psychic
fry|Nap|Brain Wave Immunity|stun|light
bender|Bite My Shiny|Robo Rampage|boost|steel
leela|Kick|Captain's Order|stun|fighting
professor farnsworth|"Good News Everyone"|Doomsday Device|burn|electric
zoidberg|Claw Snap|Why Not Zoidberg?|drain|water
special agent fox mulder|I Want to Believe|Truth Is Out There|stun|psychic
special agent dana scully|Autopsy|Scientific Proof|heal|water
eleven|Nosebleed|Psychic Slam|stun|psychic
chief jim hopper|Punch|Hopper's Sacrifice|heal|fighting
dustin henderson|Walkie-Talkie|Never Ending Story|heal|electric
dean winchester|Colt Shot|Impala Rampage|pierce|fire
sam winchester|Exorcism|Demon Blood|drain|psychic
castiel|Angel Blade|Smite|pierce|light
crowley|Deal|King of Hell|drain|dark
lucifer|Snap|Morningstar|burn|fire
lucifer morningstar|Desire Reveal|Devil Face|burn|fire
the eleventh doctor|Sonic Screwdriver|Geronimo!|stun|electric
the tenth doctor|Sonic Screwdriver|Allons-y!|stun|electric
the twelfth doctor|Sonic Sunglasses|Timelord Regeneration|heal|electric
eric theodore cartman|Respect My Authoritah|Cthulhu Summon|stun|dark
kenny mckormick|Mumble|Mysterion Rises|heal|dark
butters stotch|Hug|Professor Chaos|stun|psychic
stan marsh|Sarcasm|Guitar Hero|stun|light
kyle broflovski|Speech|"You Know, I Learned Something Today"|heal|light
randy marsh|Tegridy|Lorde Drop|stun|nature
homer simpson|D'oh!|Donut Rampage|boost|light
bart simpson|Slingshot|Eat My Shorts|stun|fire
lisa simpson|Saxophone Solo|Vegetarian Rage|stun|light
marge simpson|Hmmm|Hair Tower|heal|light
charles montgomery burns|Release the Hounds|Excellent|drain|dark
moe szyslak|Prank Call|Flaming Moe|burn|fire
rachel green|Hair Flip|We Were on a Break|stun|light
ross geller|PIVOT!|Unagi|stun|light
chandler bing|Sarcasm|"Could It BE More…"|stun|light
joey tribbiani|"How You Doin'?"|Joey Doesn't Share Food|drain|light
monica geller|Clean Freak|Thanksgiving Dance|heal|light
phoebe buffay|Smelly Cat|Regina Phalange|stun|light
sheldon lee cooper|Bazinga|Knock Knock Penny|stun|psychic
penny|Eye Roll|Cheesecake Factory|heal|light
leonard leakey hofstadter|Laser Pointer|Physics Lecture|stun|psychic
peter griffin|Chicken Fight|Surfin' Bird|boost|fighting
stewie griffin|Laser Gun|Take Over the World|burn|psychic
roger|Disguise|Persona Switch|stun|psychic
tony soprano|Gabagool|Bada Bing|stun|dark
aang|Air Scooter|Avatar State|boost|nature
katara|Water Whip|Bloodbending|stun|water
sokka|Boomerang|Space Sword|pierce|steel
zuko|Fire Punch|Lightning Redirection|burn|fire
appa|Tail Gust|Yip Yip|stun|nature
momo|Lemur Snatch|Moon Peach Heist|drain|nature
dr. gregory house|Sarcasm|It's Never Lupus|pierce|psychic
captain jean-luc picard|Phaser|Make It So|heal|light
lt. commander data|Positronic Punch|Emotion Chip|stun|steel
lieutenant worf|Bat'leth|Klingon Honor|boost|fighting
mr. spock|Nerve Pinch|Mind Meld|stun|psychic
captain james tiberius kirk|Phaser|Kobayashi Maru|stun|light
quark|Profit|Rules of Acquisition|drain|dark
odo|Shapeshift|Changeling Grip|stun|water
captain kathryn janeway|Phaser|Coffee and Command|heal|light
tommy shelby|Razor Cap|By Order of the Peaky Blinders|pierce|dark
arthur shelby|Brawl|Peaky Rage|boost|fighting
buffy summers|Stake|Slayer Strength|pierce|light
spike|Vampire Bite|Chip Disabled|drain|dark
willow rosenberg|Magic Bolt|Dark Willow|pierce|psychic
dwight kurt schrute|Beet Throw|Assistant to the Regional Manager|stun|nature
jim halpert|Prank|Camera Look|stun|light
dexter morgan|Plastic Wrap|Dark Passenger|drain|dark
sherlock holmes|Deduction|Mind Palace|pierce|psychic
dr. john watson|Army Pistol|Loyal Blogger|heal|light
anakin skywalker|Lightsaber Strike|Chosen One|boost|light
obi-wan kenobi|Lightsaber Strike|High Ground|pierce|light
ahsoka tano|Twin Sabers|Fulcrum|pierce|light
yoda|Force Push|Force Mastery|stun|light
count dooku|Force Lightning|Makashi Duel|stun|dark
matt murdock / daredevil|Billy Club|Hallway Fight|stun|fighting
wilson fisk / the kingpin|Car Door|Kingpin Crush|stun|fighting
frank castle / the punisher|Shotgun|One Batch, Two Batch|pierce|steel
jackson 'jax' teller|Pistol|SAMCRO Ride|pierce|steel
daryl dixon|Crossbow|Walker Hunt|pierce|nature
rick grimes|Colt Python|"We Are the Walking Dead"|boost|steel
michonne hawthorne|Katana|Walker Pets|pierce|steel
dr. meredith grey|Scalpel|Code Blue|heal|water
dr. percival "perry" ulysses cox|Rant|Newbie Lecture|stun|water
dr. john "j.d." dorian|Daydream|Eagle!|heal|light
janitor|Mop Swing|Janitor's Revenge|stun|dark
eugene g. roe|Bandage|Medic!|heal|light
richard d. winters|Rifle|Hang Tough|heal|steel
patrick jane|Hypnosis|Red John Trap|stun|psychic
kara "starbuck" thrace|Viper Strike|Starbuck's Gambit|pierce|steel
william adama|Command|So Say We All|heal|steel
amos burton|Punch|"I'm That Guy"|boost|fighting
jeff winger|Speech|Winger Speech|heal|light
abed nadir|Meta Joke|Troy and Abed in the Morning|stun|psychic
dean craig pelton|Costume Change|Dean-a-ling|stun|light
richard hendricks|Middle-Out|Pied Piper Pivot|stun|electric
bertram gilfoyle|Satanic Hack|Server Burn|burn|dark
frank gallagher|Drunk Rant|Gallagher Scheme|drain|dark
lucas hood|Bar Brawl|Sheriff Justice|boost|fighting
nicholas brody|Sleeper Agent|Double Cross|pierce|dark
carrie mathison|Conspiracy Board|Intel Drop|stun|psychic
john reese|Kneecap Shot|The Man in the Suit|pierce|steel
harold finch|The Machine|Admin Access|stun|electric
samantha "root" groves|Hack|Voice of the Machine|stun|electric
lorne malvo|Wolf Stare|Chaos Seed|drain|dark
dr. walter bishop|Experiment|Parallel Universe|stun|psychic
olivia dunham|Cortexiphan|Fringe Event|stun|psychic
hieronymus "harry" bosch|Detective Work|Everybody Counts|pierce|steel
det. rustin cohle|Time Is a Flat Circle|Carcosa|stun|dark
enoch "nucky" thompson|Bootleg|Atlantic City Ruler|drain|dark
elizabeth jennings|Honey Trap|KGB Takedown|pierce|dark
philip jennings|Disguise|Directorate S|stun|dark
teal'c|Staff Weapon|"Indeed."|pierce|steel
jack o'neill|P90|Irish Wit|stun|steel
dr. daniel jackson|Translation|Ascension|heal|light
samantha carter|Naquadah Science|Ship Hack|stun|electric
dr. rodney mckay|Genius Rant|Save the City|stun|electric
ronon dex|Particle Magnum|Runner|pierce|fighting
lt. colonel john sheppard|Puddle Jumper|Drone Swarm|pierce|steel
kiera cameron|Time Suit|Future Cop|stun|electric
alec sadler|Hack|Time Travel Tech|stun|electric
captain olivia benson|Interrogation|Special Victims Justice|heal|water
detective elliot stabler|Tackle|Organized Crime|boost|fighting
special agent leroy jethro gibbs|Head Slap|Rule 9: Always Carry a Knife|pierce|steel
forensics specialist abigail "abby" sciuto|Lab Test|Caf-Pow Rush|boost|electric
det. nick burkhardt|Grimm Sight|Wesen Hunt|pierce|dark
monroe|Wolf Roar|Blutbad Rage|boost|nature
pete lattimer|Vibe|Artifact Snag|stun|psychic
jamie fraser|Claymore|Highland Charge|boost|steel
claire randall|Herbal Remedy|Time Through the Stones|heal|nature
sergeant hank voight|Intimidate|Voight Justice|stun|dark
`;

const FRAN_LINES = `
one piece|Haki Punch,Pirate Kick,Rubber Snap,Cannon Shot|Conqueror's Haki:stun,Devil Fruit Awakening:boost,Gear Second Barrage:pierce,Grand Line Storm:none
naruto|Kunai Throw,Shuriken,Shadow Clone,Substitution|Rasengan:pierce,Summoning Jutsu:boost,Fire Style Jutsu:burn,Sharingan Genjutsu:stun|nature
bleach|Zanpakuto Slash,Kidou Blast,Flash Step,Cero|Bankai:boost,Hollowfication:drain,Getsuga Wave:pierce,Senbonzakura Kageyoshi:pierce|dark
demon slayer|Nichirin Slash,Breath Focus,Total Concentration,Blade Dance|Total Concentration: Constant:boost,Blood Demon Art:drain,Wisteria Poison:burn,Hashira Form:pierce|fire
jujutsu kaisen|Cursed Energy Punch,Cursed Tool,Black Flash Attempt,Barrier|Domain Expansion:stun,Reverse Cursed Technique:heal,Maximum Technique:pierce,Cursed Spirit Swarm:drain|psychic
my hero academia|Quirk Attack,Hero Kick,Plus Ultra Jab,Support Item|Plus Ultra!:boost,Quirk Awakening:pierce,Villain Ambush:drain,Rescue Save:heal|fighting
attack on titan|ODM Slash,Thunder Spear,Blade Swap,Grapple|Titan Shift:boost,Scout Charge:pierce,Wall Defense:heal,Titan Roar:stun|steel
haikyu|Serve,Receive,Block,Quick Set|Spike Kill:pierce,Monster Block:stun,Jump Serve Ace:pierce,Rolling Thunder Dig:heal|fighting
hunter x hunter|Nen Punch,Ten,Gyo,Ren Pulse|Hatsu:pierce,Zetsu Ambush:stun,Emitter Blast:burn,Nen Vow:boost|psychic
chainsaw man|Devil Contract,Chainsaw Swing,Blood Spurt,Gun Shot|Devil Summon:drain,Public Safety Raid:pierce,Hybrid Transform:boost,Devil Hunter Combo:burn|dark
fullmetal alchemist|Transmutation,Clap Alchemy,Automail Punch,Stone Spike|Philosopher's Stone:boost,Truth Gate:drain,Alchemy Barrage:pierce,Flame Alchemy:burn|steel
fate/|Noble Phantasm Jab,Command Seal,Magecraft Bolt,Servant Strike|Noble Phantasm:pierce,Reality Marble:boost,Holy Grail Wish:heal,Command Spell Order:stun|light
bungo stray dogs|Ability Activation,Pistol Shot,Detective Work,Knife|Ability Awakening:boost,Port Mafia Ambush:pierce,Armed Detective Agency:heal,Book Rewrite:stun|psychic
black clover|Grimoire Spell,Magic Bullet,Mana Zone,Wind Slash|Devil Union:boost,Mana Burst:pierce,Wizard King's Magic:stun,Squad Charge:none|dark
fruits basket|Zodiac Transform,Hug,Rice Ball,Curse Glance|Zodiac Curse Break:heal,Sohma Secret:stun,True Form:burn|light
bakemonogatari|Aberration Bite,Oddity Talk,Vampire Speed,Wordplay|Aberration Unleashed:drain,Vampire Heal:heal,Snake Curse:stun|dark
fire force|Pyrokinesis,Fire Kick,Flame Shield,Ember Shot|Adolla Burst:burn,Company 8 Charge:boost,Infernal Rescue:heal|fire
re:zero|Shamak,Morning Star,Spirit Arts,Witch Scent|Return by Death:stun,Spirit Magic:pierce,Oni Rage:boost|psychic
tokyo ghoul|Kagune Lash,Quinque Swing,Ghoul Bite,RC Cells|Kakuja Frenzy:drain,Quinque Barrage:pierce,One-Eyed Rage:boost|dark
kaguya-sama|Love Detective,Council Debate,Cold Stare,Tsundere Jab|Love Is War: Checkmate:stun,Confession Strike:boost,Student Council Power:heal|light
gintama|Wooden Sword,Strawberry Milk,Gag Punch,Umbrella Shot|Shiroyasha:boost,Yorozuya Assault:pierce,Absurd Gag:stun|fighting
one-punch man|Hero Punch,Hero Kick,Monster Swipe,Esper Throw|S-Class Rescue:heal,Monster Rampage:drain,Hero Association:boost|fighting
that time i got reincarnated|Predator,Water Blade,Slime Bounce,Magic Sense|Beelzebuth:drain,Demon Lord Harvest:boost,Storm Dragon Breath:burn|water
tokyo revengers|Punch,High Kick,Gang Charge,Headbutt|Toman Assault:boost,Time Leap:stun,Invincible Kick:pierce|fighting
akame ga kill|Teigu Slash,Assassin Dash,Ice Shard,Gun Shot|Teigu Trump Card:pierce,Night Raid:drain,Empire Crush:stun|dark
death note|Deduction,Write a Name,Shinigami Deal,Potato Chip|Kira's Judgement:pierce,L's Gambit:stun,Death God Eyes:drain|dark
jojo's bizarre adventure|Stand Punch,Hamon Breath,ORA ORA,MUDA MUDA|Stand Rush:pierce,Time Stop:stun,Golden Spin:boost,Requiem:drain|psychic
konosuba|Steal,Drain Touch,Fireball,Clumsy Swing|EXPLOSION!:pierce,Purification:heal,Crusader Tank:boost|light
dr. stone|Chemistry,Science Throw,Petrification Ray,Lab Rig|Ten Billion Percent Science:heal,Petrification Device:stun,Rocket Launch:pierce|electric
oshi no ko|Idol Wink,Acting Talent,Stage Presence,Star Eye|Idol Concert:boost,Revenge Plot:drain,Spotlight:stun|light
the seven deadly sins|Sacred Treasure,Full Counter,Snatch,Sunshine Punch|Deadly Sin Power:boost,Commandment:stun,Assault Mode:pierce|dark
fairy tail|Dragon Slayer Fist,Requip,Celestial Key,Ice Make|Fairy Law:pierce,Dragon Force:boost,Unison Raid:burn|fire
soul eater|Weapon Swing,Soul Wavelength,Soul Resonance,Witch Magic|Soul Resonance:boost,Witch Hunter:pierce,Madness Wave:stun|dark
blue lock|Direct Shot,Dribble,Header,Pass|Metavision Goal:pierce,Flow State:boost,Ego Strike:stun|fighting
ouran high school host club|Charming Smile,Tea Service,Host Pose,Twin Tease|Host Club Charm:stun,Commoner's Instant Coffee:heal,Rich Kid Money:boost|light
code geass|Knightmare Slash,Slash Harken,Pistol,Geass Glance|Geass Absolute Order:stun,Guren Radiant Wave:burn,Zero Requiem:pierce|psychic
frieren|Zoltraak,Mana Suppression,Flower Field Spell,Staff Strike|Judradjim:stun,Goddess Magic:heal,Hero Party Memory:boost|psychic
vinland saga|Axe Swing,Sword Strike,Dagger,Shield Bash|Viking Raid:pierce,True Warrior:heal,Berserk Fury:boost|fighting
rascal does not dream|Deadpan Remark,Bunny Girl Glare,Quantum Theory,Phone Call|Adolescence Syndrome:stun,Time Loop:heal|light
quintessential quintuplets|Quintuplet Swap,Study Session,Hair Ribbon,Headphones|Quintuplet Resolve:heal,Wedding Bell:boost|light
classroom of the elite|Calculated Move,Class Points,Psych-Out,Test Cheat|White Room Mastery:pierce,Special Exam Gambit:stun|psychic
neon genesis evangelion|Progressive Knife,AT Field,Pallet Rifle,Positron Shot|Berserk Mode:boost,Third Impact:drain,Operation Yashima:pierce|psychic
cowboy bebop|Jeet Kune Do,Revolver,Swordfish Shot,Hacking|Bang:pierce,Bounty Hunt:stun,See You Space Cowboy:boost|steel
bocchi the rock|Guitar Riff,Bass Line,Drum Fill,Anxiety Spiral|Kessoku Band Live:boost,Guitar Hero Solo:pierce|electric
puella magi madoka magica|Soul Gem Glow,Magic Arrow,Musket Shot,Spear Thrust|Witch Transformation:drain,Tiro Finale:pierce,Law of Cycles:heal|psychic
mushoku tensei|Water Ball,Stone Cannon,Sword God Style,Healing Magic|Cumulonimbus:stun,Quagmire:stun,North God Style:pierce|water
monster|Whisper,Scalpel,Pistol,Detective Work|The Nameless Monster:drain,Kinderheim 511:stun|dark
dragon ball|Ki Blast,Kamehameha,Afterimage,Flying Kick|Super Saiyan Surge:boost,Spirit Bomb:pierce,Final Flash:pierce,Destructo Disc:pierce|fighting
dan da dan|Psychic Grab,Turbo Granny Dash,Alien Laser,Curse Punch|Okarun Transform:boost,Psychic Power Wave:stun,Yokai Bite:drain|psychic
k-on|Guitar Riff,Bass Line,Drum Fill,Keyboard Chord|Fuwa Fuwa Time:heal,After School Tea Time:heal|light
miss kobayashi's dragon maid|Tail Swipe,Maid Service,Dragon Breath,Lightning Tail|Dragon Form:boost,Omelette of Love:heal|fire
seraph of the end|Cursed Gear,Vampire Bite,Blood Blade,Demon Sword|Demon Possession:drain,Seraph Awakening:pierce|dark
delicious in dungeon|Monster Cooking,Cooking Knife,Spell Scroll,Shield Bash|Hearty Meal:heal,Ancient Magic:pierce,Chimera Form:boost|nature
mob psycho 100|Psychic Push,Salt Splash,Spirit Punch,Barrier|???% Explosion:boost,Special Move:stun|psychic
steins;gate|Time Leap,Microwave Phone,Mad Scientist Laugh,D-Mail|Reading Steiner:stun,Amadeus:heal|electric
spy x family|Disguise,Stiletto Throw,Mind Read,Spy Gadget|Operation Strix:stun,Thorn Princess:pierce|dark
noragami|Regalia Slash,Rend,Divine Borderline,Phantom Bite|Sekki Exorcism:pierce,Blessed Vessel:boost|light
my teen romantic comedy|Cynical Remark,Service Club Request,Cold Logic,Cheerful Wave|Loner Sacrifice:heal,Genuine Thing:heal|light
a silent voice|Notebook Message,Apology,Sign Language,Friendship|Hearing Again:heal|light
assassination classroom|Knife Feint,Anti-Sensei BB,Tentacle Whip,Mach 20|Koro-sensei Assassination:pierce,Graduation:boost|dark
the promised neverland|Plan,Escape Route,Ambush,Farm Map|Great Escape:stun,Demon Deal:drain|dark
rent-a-girlfriend|Date,Rental Smile,Blush,Fake Date|Real Confession:heal,Girlfriend Rating:stun|light
gurren lagann|Core Drill,Giga Drill,Gunmen Punch,Spiral Power|Giga Drill Break:pierce,Tengen Toppa:boost|fighting
kakegurui|Gamble,Bluff,Card Trick,High Stakes|All-In:pierce,Compulsive Gamble:boost|dark
toilet-bound hanako|Kitchen Knife,Haunting,Supernatural Touch,School Mystery|Seventh Mystery:drain,Boundary Seal:stun|dark
toradora|Wooden Sword,Palmtop Tiger Kick,Ramen Throw,Tsundere Jab|Palmtop Tiger:boost,Christmas Confession:heal|fire
date a live|Angel Summon,Spirit Blast,Astral Dress,Time Bullet|Spirit Sealing:heal,Reverse Spirit:drain|psychic
berserk|Dragonslayer,Crossbow,Cannon Arm,Throwing Knife|Berserker Armor:drain,Eclipse:drain|dark
sword art online|Linear,Vorpal Strike,Dual Wield,Sword Skill|Starburst Stream:pierce,Mother's Rosario:pierce|light
darling in the franxx|Franxx Kick,Klaxosaur Horn,Pistil Link,Stamen Drive|Strelizia Unison:boost,Darling Link:heal|steel
solo leveling|Dagger Rush,Shadow Step,Mana Blade,System Quest|Arise!:drain,Monarch's Domain:boost|dark
horimiya|Piercing Glance,Scolding,Hug,Glasses Off|Hidden Side Reveal:boost,Big Sister Mode:heal|light
overlord|Grasp Heart,Fireball,Undead Summon,Guardian Strike|The Goal of All Life Is Death:drain,Super-Tier Magic:pierce|dark
86|Railgun Shot,Juggernaut Charge,Handler Order,Spider Legs|Undertaker:pierce,Eighty-Six Rally:boost|steel
cyberpunk: edgerunners|Monowire,Sandevistan Dash,Gun Shot,Quickhack|Cyberpsychosis:boost,Netrun Breach:stun|electric
trigun|Revolver,Punisher Cross,Donut Break,Knife Shower|Angel Arm:pierce,Love and Peace:heal|light
high school dxd|Power of Destruction,Holy Lightning,Boosted Gear,Demon Wing|Balance Breaker:boost,Queen Promotion:pierce|dark
samurai champloo|Breakdance Kick,Iaido Slash,Sunflower Search,Katana|Wild Style:boost,Last Stand:pierce|fighting
`;

// Fernsehen: Pools je Serie. Sitcoms und Krimis bekommen passende Alltags-Attacken.
const FRAN_TV = `
breaking bad|Chemistry Lesson,Pistol Shot,Ricin,Money Barrel|Blue Sky Batch:burn,Heisenberg Plan:stun,DEA Raid:pierce|dark
better call saul|Legal Brief,Lawyer Talk,Scam,Chicken Delivery|Slippin' Jimmy:stun,Cartel Ambush:pierce,Los Pollos Hermanos:drain|dark
game of thrones|Sword Slash,Wine Glare,Arrow Volley,Dagger|Winter Is Coming:stun,Wildfire:burn,Dracarys:burn,Faceless Man:pierce|dark
person of interest|Relevant Number,Kneecap Shot,Machine Whisper,Surveillance|The Machine:stun,Samaritan:drain|electric
stargate|Staff Weapon,P90 Burst,Zat Gun,Gate Dial|Chevron Seven Locked:stun,Asgard Beam:pierce,Ascension:heal|steel
rick and morty|Portal Gun,Plumbus,"Aw Jeez",Meeseeks|Pickle Rick:boost,Portal Chaos:stun,Get Schwifty:heal|electric
fargo|Hunting Rifle,Minnesota Nice,Blackmail,Snow Shovel|Coin Toss:stun,Butcher's Vengeance:pierce|water
line of duty|Interview Room,AC-12 Badge,Warrant,Evidence|"Mother of God":stun,Bent Copper Exposed:pierce|steel
the x-files|Flashlight,FBI Badge,Autopsy,Conspiracy|The Truth Is Out There:stun,Alien Abduction:drain|psychic
futurama|Laser Gun,Slurm,Nap,Planet Express Delivery|Doomsday Device:burn,Robot Uprising:boost|electric
friends|Coffee Break,Sarcasm,Hug,Couch Flop|We Were on a Break:stun,Thanksgiving Chaos:boost,Central Perk:heal|light
stranger things|Walkie-Talkie,Wrist Rocket,Nail Bat,Waffles|Upside Down Portal:drain,Psychic Blast:stun,Demogorgon Hunt:pierce|psychic
supernatural|Salt Round,Holy Water,Angel Blade,Exorcism|Colt Shot:pierce,Smite:burn,Hellfire:burn|dark
doctor who|Sonic Screwdriver,Psychic Paper,Run!,Jelly Baby|TARDIS Landing:stun,Regeneration:heal,Time Lord Victorious:boost|electric
homeland|Intel,Drone Strike,Interrogation,Sniper Shot|Sleeper Agent:pierce,CIA Black Site:stun|steel
south park|Fart Joke,Snowball,Sarcasm,Cheesy Poof|Respect My Authoritah:stun,Manbearpig:drain,They Killed Kenny:heal|light
the mentalist|Cold Read,Hypnosis,Tea Break,Badge|Red John Trap:stun,Perfect Con:pierce|psychic
dark matter|Blaster,Android Upgrade,Memory Wipe,Ship Hack|Raza Barrage:pierce,Blink Drive:stun|steel
true detective|Interrogation,Beer Can,Revolver,Case File|Time Is a Flat Circle:stun,Carcosa:drain|dark
criminal minds|Profile,Behavioural Analysis,Tackle,Hack|Wheels Up:boost,Unsub Caught:stun|psychic
the simpsons|D'oh!,Slingshot,Donut,Saxophone|Excellent:drain,Duff Rampage:boost,Cowabunga:stun|light
it's always sunny|Scheme,Rum Ham,Kitten Mittens,Rant|The Implication:stun,Nightman Cometh:boost,Wolf Cola:drain|dark
the night manager|Hotel Service,Spy Trick,Arms Deal,Undercover|Worst Man in the World:drain,Operation Limpet:pierce|dark
continuum|Time Suit,Future Tech,Pistol,Hack|Time Travel:stun,Liber8 Strike:burn|electric
chicago p.d.|Interrogation,Tackle,Pistol,Warrant|Intelligence Raid:pierce,Voight Justice:stun|steel
chicago fire|Axe,Fire Hose,Ladder,Jaws of Life|Firehouse 51 Rescue:heal,Backdraft:burn|fire
chicago med|Stethoscope,Scalpel,Defibrillator,Diagnosis|Code Blue:heal,Emergency Surgery:heal|water
the big bang theory|Bazinga,Physics Lecture,Comic Book,Laser Pointer|Knock Knock:stun,Rock Paper Scissors Lizard Spock:pierce,Soft Kitty:heal|psychic
outlander|Claymore,Herbal Remedy,Highland Charge,Dirk|Stones of Craigh na Dun:stun,Jacobite Rising:boost|nature
ncis|Head Slap,Forensic Test,Badge,Sniper Shot|Rule 9:pierce,Caf-Pow Rush:boost|steel
the walking dead|Crossbow,Katana,Colt Python,Walker Swarm|Survivor Instinct:heal,Walker Horde:drain|dark
law & order|Interrogation,Warrant,Evidence,Badge|Special Victims Justice:heal,Case Closed:stun|water
grey's anatomy|Scalpel,Suture,Diagnosis,Defibrillator|Code Blue:heal,Miracle Surgery:heal|water
family guy|Chicken Fight,Laser Gun,Cutaway Gag,Beer|Surfin' Bird:stun,Take Over the World:burn|light
american dad|CIA Gadget,Disguise,Rifle,Alien Snark|Persona Switch:stun,CIA Strike:pierce|light
band of brothers|M1 Garand,Grenade,Medic!,Bayonet|Easy Company Charge:boost,Hang Tough:heal|steel
the wire|Wiretap,Detective Work,Corner Deal,Pistol|Chain of Evidence:stun,The Game:drain|dark
sherlock|Deduction,Violin,Army Pistol,Mind Palace|The Game Is On:pierce,Reichenbach Fall:stun|psychic
the sopranos|Gabagool,Baseball Bat,Pistol,Therapy|Bada Bing:stun,Family Business:drain|dark
avatar: the last airbender|Bending,Boomerang,Fire Punch,Water Whip|Avatar State:boost,Lightning Redirection:stun|nature
house|Diagnosis,Vicodin,Sarcasm,MRI|It's Never Lupus:pierce,Differential Diagnosis:heal|psychic
battlestar galactica|Viper Strike,Cylon Detection,Command,Railgun|So Say We All:heal,FTL Jump:stun|steel
star trek|Phaser,Tricorder,Nerve Pinch,Warp|Photon Torpedo:pierce,Make It So:heal,Beam Me Up:stun|light
the expanse|Railgun,PDC Burst,Protomolecule,Belter Punch|Protomolecule Surge:drain,Rocinante Strike:pierce|steel
fringe|Experiment,Cortexiphan,Pistol,Observer Tech|Parallel Universe:stun,Fringe Event:burn|psychic
banshee|Bar Brawl,Shotgun,Heist,Amish Punch|Sheriff Justice:boost,Heist Getaway:stun|fighting
shameless|Drunk Rant,Scheme,Punch,Beer|Gallagher Scheme:drain,South Side Brawl:boost|dark
the americans|Disguise,Honey Trap,Wig,Pistol|KGB Takedown:pierce,Directorate S:stun|dark
peaky blinders|Razor Cap,Pistol,Brawl,Whiskey|By Order of the Peaky Blinders:pierce,Shelby Company:drain|dark
buffy the vampire slayer|Stake,Crossbow,Magic Spell,Research|Slayer Strength:pierce,Dark Willow:burn|light
the office|Prank,Camera Look,Stapler,Beet|That's What She Said:stun,Dundie Award:heal|light
bosch|Detective Work,Pistol,Case File,Stakeout|Everybody Counts:pierce,Warrant:stun|steel
grimm|Grimm Sight,Crossbow,Wesen Morph,Spellbook|Wesen Hunt:pierce,Hexenbiest Spell:drain|dark
boardwalk empire|Bootleg,Tommy Gun,Bribe,Carnation|Atlantic City Ruler:drain,St. Valentine's Ambush:pierce|dark
silicon valley|Middle-Out,Code Review,Pivot,Server Hack|Pied Piper Launch:boost,Hooli Buyout:drain|electric
dexter|Plastic Wrap,Blood Slide,Knife,Forensics|Dark Passenger:drain,Code of Harry:stun|dark
broadchurch|Interview,Case File,Search,Clifftop Stare|Town Secrets:stun,Justice for Danny:pierce|water
scrubs|Daydream,Stethoscope,Rant,Mop Swing|Eagle!:heal,Guy Love:heal,Janitor's Revenge:stun|light
star wars: the clone wars|Lightsaber Strike,Force Push,Blaster Shot,Clone Volley|Force Lightning:stun,High Ground:pierce,Order 66:drain|light
marvel's daredevil|Billy Club,Punch,Car Door,Shotgun|Hallway Fight:stun,Kingpin Crush:stun|fighting
sons of anarchy|Pistol,Motorcycle Charge,Brawl,Knife|SAMCRO Ride:boost,Mayhem Vote:pierce|steel
elementary|Deduction,Sobriety Coin,Beehive,Case File|Mind Palace:pierce,Watson Assist:heal|psychic
community|Speech,Paintball,Meta Joke,Blanket Fort|Paintball Assassin:pierce,Troy and Abed in the Morning:stun|light
longmire|Rifle,Horse Charge,Tracking,Sheriff Badge|Absaroka Justice:pierce,Cheyenne Wisdom:heal|nature
warehouse 13|Artifact,Tesla Gun,Vibe,Goo Bag|Artifact Surge:stun,Bag and Tag:drain|psychic
strike back|Assault Rifle,Grenade,Knife,Breach|Section 20 Strike:pierce,Extraction:heal|steel
lucifer|Desire Reveal,Snap,Pistol,Piano|Devil Face:stun,Morningstar:burn|fire
the killing|Case File,Interview,Search,Stakeout|Who Killed Rosie Larsen:stun|water
castle|Novelist Hunch,Pistol,Badge,Coffee|Always:heal,Case Closed:stun|light
lost|Rifle,Machete,Hatch Button,Survival|The Numbers:stun,The Island Heals:heal,Smoke Monster:drain|nature
`;

function parseSig(text) {
    const out = {};
    for (const line of text.trim().split('\n')) {
        const [name, basic, big, effect, type] = line.split('|');
        if (!name || !big) continue;
        out[name.trim().toLowerCase()] = { basic: basic.trim(), big: big.trim(), effect: (effect || 'none').trim(), type: type ? type.trim() : null };
    }
    return out;
}

function parseFran(text) {
    const out = [];
    for (const line of text.trim().split('\n')) {
        const [from, basics, bigs, type] = line.split('|');
        if (!from || !bigs) continue;
        out.push({
            from: from.trim().toLowerCase(),
            basic: basics.split(',').map(s => s.trim()).filter(Boolean),
            big: bigs.split(',').map(s => { const i = s.lastIndexOf(':'); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }),
            type: type ? type.trim() : null
        });
    }
    // Laengste Praefixe zuerst ("star trek: deep" vor "star trek")
    return out.sort((a, b) => b.from.length - a.from.length);
}

const SIG = { anime: parseSig(SIG_LINES), hero: parseSig(SIG_HERO), tv: parseSig(SIG_TV) };
const FRAN = { anime: parseFran(FRAN_LINES), tv: parseFran(FRAN_TV) };

// Sonderfall-Namen, die in allen Reihen gelten (z. B. Yoda in Helden und Serie)
function signature(raw) {
    const n = String(raw.name || '').toLowerCase().trim();
    return (SIG[raw.set] && SIG[raw.set][n]) || null;
}

function franchise(raw) {
    const list = FRAN[raw.set];
    if (!list) return null;
    const f = String(raw.from || '').toLowerCase();
    return list.find(x => f.startsWith(x.from) || f.includes(x.from)) || null;
}

module.exports = { signature, franchise, SIG, FRAN };

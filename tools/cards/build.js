// Kekemon-Karten (5.0): Rohdaten aus oeffentlichen Quellen holen.
//
//   node tools/cards/build.js /srv/snake-data/cards-raw.json
//
// Quellen (alle ohne Schluessel):
//   anime  AniList GraphQL, Charaktere nach Favoriten (dieselbe Rangliste
//          wie MyAnimeList; Jikan/MAL war beim Bau nicht erreichbar)
//   hero   Superhero-API (akabab.github.io): Marvel, DC, Star Wars … mit
//          Kampfwerten (powerstats)
//   tv     TVMaze: Charaktere der beliebtesten Serien (Doctor Who, …)
//
// Das Ergebnis sind nur Rohdaten (Name, Bild-URL, Herkunft, Beliebtheit,
// Genres, Werte). Karten-Werte, Typen, Attacken und Seltenheit rechnet
// cards.js beim Serverstart daraus – deterministisch, gleiche Daten = gleiche
// Karten. Die Datei liegt in /srv/snake-data (damit im Backup), nicht im Repo.

const fs = require('fs');

const OUT = process.argv[2] || 'cards-raw.json';
const ANIME = 1000, FILMTV = 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function json(url, opts = {}, tries = 4) {
    for (let i = 0; i < tries; i++) {
        try {
            const r = await fetch(url, opts);
            if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
            if (!r.ok) throw new Error(url + ' -> ' + r.status);
            return await r.json();
        } catch (e) {
            if (i === tries - 1) throw e;
            await sleep(2000 * (i + 1));
        }
    }
}

async function anime() {
    const out = [];
    const q = `query ($page: Int) { Page(page: $page, perPage: 50) { characters(sort: FAVOURITES_DESC) {
        id name { full } image { large } favourites gender
        media(perPage: 1, sort: POPULARITY_DESC) { nodes { title { romaji english } genres type } } } } }`;
    for (let page = 1; out.length < ANIME; page++) {
        const d = await json('https://graphql.anilist.co', {
            method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ query: q, variables: { page } })
        });
        const list = d.data.Page.characters;
        if (!list.length) break;
        for (const c of list) {
            const m = (c.media.nodes || [])[0] || {};
            if (!c.image || !c.image.large || /default\.jpg/.test(c.image.large)) continue;
            out.push({
                id: 'a' + c.id, set: 'anime', name: c.name.full, img: c.image.large,
                from: (m.title && (m.title.english || m.title.romaji)) || '', pop: c.favourites || 0,
                genres: m.genres || [], gender: c.gender || null
            });
        }
        process.stdout.write(`anime ${out.length}\r`);
        await sleep(900);
    }
    return out.slice(0, ANIME);
}

async function heroes() {
    const d = await json('https://akabab.github.io/superhero-api/api/all.json');
    return d.filter(h => h.images && h.images.md).map(h => ({
        id: 'h' + h.id, set: 'hero', name: h.name, img: h.images.md,
        from: (h.biography && h.biography.publisher) || '', pop: Object.values(h.powerstats || {}).reduce((s, n) => s + (Number(n) || 0), 0),
        stats: h.powerstats, align: h.biography && h.biography.alignment, gender: h.appearance && h.appearance.gender
    }));
}

async function tv(want) {
    // Beliebteste Serien: TVMaze-Gewicht (0–100) und Bewertung
    const shows = [];
    for (let page = 0; page < 12; page++) {
        const d = await json(`https://api.tvmaze.com/shows?page=${page}`);
        shows.push(...d.filter(s => s.weight >= 97 && s.rating && s.rating.average >= 7.5 && s.language === 'English'));
        await sleep(400);
    }
    shows.sort((a, b) => b.weight - a.weight || b.rating.average - a.rating.average);
    const out = [];
    for (const s of shows) {
        if (out.length >= want) break;
        const cast = await json(`https://api.tvmaze.com/shows/${s.id}/cast`);
        let n = 0;
        for (const c of cast) {
            if (n >= 6 || out.length >= want) break;
            const img = (c.character.image && c.character.image.medium) || (c.person.image && c.person.image.medium);
            if (!img) continue;
            out.push({
                id: 't' + c.character.id, set: 'tv', name: c.character.name, img,
                from: s.name, pop: Math.round(s.weight * 10 + s.rating.average * 10 - n * 5), genres: s.genres || []
            });
            n++;
        }
        process.stdout.write(`tv ${out.length}\r`);
        await sleep(600);
    }
    return out;
}

(async () => {
    const a = await anime();
    console.log('anime', a.length);
    const h = await heroes();
    console.log('heroes', h.length);
    const t = await tv(Math.max(0, FILMTV - h.length));
    console.log('tv', t.length);
    const all = [...a, ...h, ...t];
    fs.writeFileSync(OUT + '.tmp', JSON.stringify({ built: new Date().toISOString(), sources: ['anilist', 'superhero-api', 'tvmaze'], cards: all }));
    fs.renameSync(OUT + '.tmp', OUT);
    console.log('written', OUT, all.length);
})().catch(e => {
    console.error(e);
    process.exit(1);
});

# viewer/ — SY Alizée, interaktiv 3D-modell

Prosedyrisk 3D-modell av Malö 36 i three.js (r128, vendort i `vendor/`).
Alt bygges i koden fra skrogtabellene i `js/01-skrog.js` — samme mått som
`params/boat.yaml`.

## Filstruktur

- `index.html` — markup (knapper, paneler, dialoger) + lasterekkefølgen
- `css/style.css` — all stil (UI, filmmodus, testpanel)
- `js/00-oppsett.js` — DOM, renderer, scene/kamera, små hjelpere
- `js/01-skrog.js` — skrogtabeller, skrogbygging, livery-shader, kjøl/skjegg/ror, navnet på akterspeilet, teksturer og materialer (`dmat`), geometrihjelpere
- `js/02-dekk.js` — teakdekke, toerail, livliner, pulpit, pushpit + daviter
- `js/03-overbygg.js` — doghouse med vinduer, luker, sprayhood
- `js/04-cockpit.js` — cockpit, pult, ratt, spill
- `js/05-rigg.js` — mast, spreddere, bom, stående rigg, rulleforesystem
- `js/06-seil.js` — seilmaskineriet og værmaskineriet (WX/WXT, `wxDerived`)
- `js/07-miljo.js` — lys, miljøkart, himmel, stjerner, havshader, vannlinje, regn, torden, fartlys, `applyScene`
- `js/08-kamera.js` — orbit/pan/zoom, innflyving
- `js/09-kvalitet.js` — kvalitetsnivåer, FPS-teller, toast, Om båten, seilknapp
- `js/10-film.js` — kinokamera (SHOTS) og etterbehandling (`CINE`)
- `js/11-testpanel.js` — testpanel og værimport fra Open-Meteo
- `js/12-hoved.js` — hovedløkke, `setState`/`setWeather`, `window.alizee`

Modulene deler toppnivå-variabler og lastes i nummerrekkefølge
(`<script>` i rekkefølge, ingen bundler). Vær forsiktig med å endre
rekkefølgen — mange filer bruker det forrige definerte direkte ved last.

## Bygge og kjøre

- **Utvikling:** server repo-roten og åpne `viewer/index.html`
  (`python3 -m http.server 8123` → `http://localhost:8123/viewer/`).
  Endringer i js/css er bare å laste siden på nytt.
- **Én fil til deling:** `python3 viewer/assemble.py` pakker index.html med
  css, js og three.min.js inn i `out/alizee_web.html` (kan åpnes direkte,
  uten server).

## Merk

- `abela.html` (uversjonert referanse i roten) er kvalitetsmålestokken;
  hav/sol/seil-maskineriet er portert derfra og tilpasset Malö 36.
- Ikke bruk `src/build.py`/`src/boat.py` — det er den gamle, feilførende
  pipelinen.

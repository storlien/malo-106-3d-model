'use strict';
/* testpanel — se deloverskriftene i filen. */

/* =====================================================================
   TESTPANEL — prøv vind, sjø og lys, og hent ekte vær for en posisjon.
   ===================================================================== */
function setWeather(o){ Object.keys(o || {}).forEach(k => { if (k in WXT) WXT[k] = o[k]; }); Object.assign(WX, WXT); kick(true); }
function setState(st){
  if (st === 'seiler' || st === 'seil'){ motorOnly = false; setSailing(true); }
  else if (st === 'motor' || st === 'motorer'){ motorOnly = true; setSailing(false); }
  else { motorOnly = false; setSailing(false); }
}
function getState(){ return motorOnly ? 'motorer' : sail.goal > 0 ? 'seiler' : 'stille'; }
(function testPanel(){
  const panel = document.getElementById('test'), btn = document.getElementById('btnTest');
  const open = v => { panel.hidden = !v; btn.setAttribute('aria-expanded', v ? 'true' : 'false'); if (v) sync(); };
  btn.addEventListener('click', e => { e.stopPropagation(); open(panel.hidden); });
  document.getElementById('testClose').addEventListener('click', () => open(false));
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  panel.addEventListener('click', e => e.stopPropagation());
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) open(false); });
  const nf = (v, d) => v.toFixed(d).replace('.', ',');
  const side = r => { r = ((r % 360) + 360) % 360; const sg = r > 180 ? r - 360 : r, a = Math.abs(sg);
    return a < 3 ? 'rett forfra' : a > 177 ? 'rett akterfra' : `${Math.round(a)}° fra ${sg > 0 ? 'styrbord' : 'babord'}`; };
  const ids = { windDir:'tDir', wind:'tSpd', wave:'tWave', hour:'tSol' };
  const outs = { windDir:'oDir', wind:'oSpd', wave:'oWave', hour:'oSol' };
  function fmt(k, v){
    if (k === 'windDir') return side(v);
    if (k === 'wind') return nf(v, 1) + ' m/s';
    if (k === 'wave') return nf(v, 1) + ' m';
    const h = Math.floor(v), m = Math.round((v - h)*60);
    return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  function sync(){
    Object.keys(ids).forEach(k => {
      const v = k === 'hour' ? (WXT.hour ?? 13) : WXT[k];
      document.getElementById(ids[k]).value = v;
      document.getElementById(outs[k]).textContent = fmt(k, v);
    });
    document.querySelectorAll('#wChips button').forEach(b => b.setAttribute('aria-pressed', b.dataset.w === chipOn ? 'true' : 'false'));
  }
  let chipOn = 'sol';
  const CHIP = {
    sol:    { cloud:0.08, rain:0, fog:0, thunder:0 },
    skya:   { cloud:0.85, rain:0, fog:0.05, thunder:0 },
    regn:   { cloud:0.9, rain:0.55, fog:0.15, thunder:0 },
    dis:    { cloud:0.55, rain:0, fog:0.8, thunder:0 },
    torden: { cloud:1, rain:0.8, fog:0.1, thunder:1, wind:14 }
  };
  document.querySelectorAll('#wChips button').forEach(b => b.addEventListener('click', () => {
    chipOn = b.dataset.w;
    const o = Object.assign({}, CHIP[chipOn]);
    if (chipOn === 'torden'){ o.wind = Math.max(WXT.wind, 14); storm.next = 1.2; }
    setWeather(o); sync();
  }));
  // solas høyde og retning for et tidspunkt og en posisjon
  function sunPos(date, lat, lon){
    const rad = Math.PI/180, d = (date.getTime() - Date.UTC(2000, 0, 1, 12))/864e5;
    const g = (357.529 + 0.98560028*d)*rad, q = 280.459 + 0.98564736*d;
    const L2 = (q + 1.915*Math.sin(g) + 0.020*Math.sin(2*g))*rad, e = (23.439 - 0.00000036*d)*rad;
    const ra = Math.atan2(Math.cos(e)*Math.sin(L2), Math.cos(L2)), dec = Math.asin(Math.sin(e)*Math.sin(L2));
    const gmst = ((18.697374558 + 24.06570982441908*d) % 24 + 24) % 24, ha = (gmst*15 + lon)*rad - ra, la = lat*rad;
    const el = Math.asin(Math.sin(la)*Math.sin(dec) + Math.cos(la)*Math.cos(dec)*Math.cos(ha));
    const az = Math.atan2(-Math.sin(ha), Math.tan(dec)*Math.cos(la) - Math.sin(la)*Math.cos(ha));
    return { el:el/rad, az:((az/rad) % 360 + 360) % 360 };
  }
  const num = id => parseFloat(String(document.getElementById(id).value).replace(',', '.'));
  document.getElementById('tSol').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    const lat = isFinite(num('tLat')) ? num('tLat') : 59.9, lon = isFinite(num('tLon')) ? num('tLon') : 10.7;
    const d = new Date(); d.setHours(Math.floor(v) % 24, Math.round((v % 1)*60), 0, 0);
    const sp = sunPos(d, lat, lon);
    setWeather({ hour:v, sunEl:Math.max(-15, Math.min(60, sp.el)), sunAz:sp.az });
    sync();
  });
  ['windDir', 'wind', 'wave'].forEach(k => document.getElementById(ids[k]).addEventListener('input', e => {
    setWeather({ [k]:parseFloat(e.target.value) });
    document.getElementById(outs[k]).textContent = fmt(k, parseFloat(e.target.value));
  }));
  const out = document.getElementById('tOut'), go = document.getElementById('tFetch');
  go.addEventListener('click', async () => {
    const lat = num('tLat'), lon = num('tLon');
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180){ out.textContent = 'Sjekk breddegrad og lengdegrad.'; return; }
    go.disabled = true; out.textContent = 'Henter vær …';
    try {
      const q = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`;
      const wr = await fetch(`https://api.open-meteo.com/v1/forecast?${q}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation,visibility,weather_code&wind_speed_unit=ms`);
      if (!wr.ok) throw new Error('værtjenesten svarte ' + wr.status);
      const w = (await wr.json()).current || {};
      let m = null;
      try { const mr = await fetch(`https://marine-api.open-meteo.com/v1/marine?${q}&current=wave_height,wave_direction,wave_period`); if (mr.ok) m = (await mr.json()).current || null; } catch (e) {}
      const wind = w.wind_speed_10m ?? 0, hasWave = m && m.wave_height != null;
      const wave = hasWave ? m.wave_height : Math.min(3, 0.02*Math.pow(wind, 1.7));
      const vis = w.visibility, sp = sunPos(new Date(), lat, lon);
      const windDir = w.wind_direction_10m ?? 0;
      const o = { wind, windDir, wave, period:(m && m.wave_period) || 4.5, cloud:(w.cloud_cover ?? 20)/100,
        fog:vis != null ? clamp01((4000 - vis)/3500) : 0, sunEl:sp.el, sunAz:sp.az, speed:null,
        hour:new Date().getHours() + new Date().getMinutes()/60, rain:clamp01((w.precipitation || 0)/4), thunder:[95, 96, 99].includes(w.weather_code) ? 1 : 0 };
      const th = Math.abs(windDir > 180 ? windDir - 360 : windDir);
      let st, why;
      if (wind < 2.5){ st = 'motor'; why = 'for lite vind til å seile'; }
      else if (th < 35){ st = 'motor'; why = 'vinden kommer nesten rett forfra'; }
      else { st = 'seiler'; why = 'nok vind, og en vinkel det går an å seile på'; }
      setWeather(o); setState(st); if (o.thunder) storm.next = 1.5;
      sync();
      out.textContent = [
        `Vind ${nf(wind, 1)} m/s${w.wind_gusts_10m != null ? ` (kast ${nf(w.wind_gusts_10m, 1)})` : ''}, fra ${Math.round(windDir)}°, altså ${side(windDir)}`,
        hasWave ? `Bølger ${nf(wave, 1)} m, periode ${nf(o.period, 1)} s` : `Ingen bølgedata her, anslått ${nf(wave, 1)} m ut fra vinden`,
        `Skydekke ${Math.round(o.cloud*100)} %${vis != null ? `, sikt ${nf(vis/1000, 1)} km` : ''}${o.rain ? `, nedbør ${nf(w.precipitation, 1)} mm` : ''}${o.thunder ? ', tordenvær' : ''}`,
        `Sola står ${Math.abs(Math.round(sp.el))}° ${sp.el < 0 ? 'under' : 'over'} horisonten`,
        `Båten ${st === 'seiler' ? 'seiler' : 'går for motor'}, fordi ${why}.`,
      ].join('\n');
    } catch (e) {
      out.textContent = `Fikk ikke hentet været (${e.message || e}). Det kan skyldes at siden vises i en forhåndsvisning som stenger nettforespørsler. Åpne filen direkte i nettleseren.`;
    } finally { go.disabled = false; }
  });
  sync();
})();


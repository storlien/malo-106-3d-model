'use strict';
/* oppsett — DOM-knytting, three.js-renderer og grunnleggende hjelpere.
   Filene i js/ lastes i nummerrekkefølge og deler toppnivå-variabler
   (samme virkemåte som når alt var ett skript). */
const root = document.getElementById('root');
const canvas = document.getElementById('c');
const errBox = document.getElementById('err');
function fail(msg){ errBox.textContent = msg; errBox.hidden = false; }
const T = THREE, V3 = T.Vector3, V2 = T.Vector2;
const C = hex => new T.Color(hex).convertSRGBToLinear();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer = null;
try { renderer = new T.WebGLRenderer({ canvas, antialias:true, alpha:true }); }
catch (e){ fail('Nettleseren din kan ikke vise 3D-modellen (WebGL mangler).'); }
if (!renderer) throw new Error('WebGL mangler');   // stopper oppsettet her
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.localClippingEnabled = true;

const scene = new T.Scene();
const cam = new T.PerspectiveCamera(38, 1, 0.1, 3000);
const clip = new T.Plane(new V3(0,-1,0), 50);   // klipper alt under konstanten (til planvisning senere)

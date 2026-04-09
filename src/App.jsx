import { useState, useEffect } from "react";

// ─── Instrumentation ──────────────────────────────────────────────────────────
// All events are stored in persistent shared storage so they accumulate across
// all sessions. Each event is: { event, payload, ts }
// The admin panel is accessible by appending ?admin to the URL.
const IS_ADMIN = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("admin");

async function track(event, payload = {}) {
  try {
    const ts = Date.now();
    const key = `evt:${ts}:${Math.random().toString(36).slice(2,7)}`;
    await window.storage.set(key, JSON.stringify({ event, payload, ts }), true);
  } catch {}
}

const T = {
  bg: "#f5f4f2", surface: "#ffffff", ink: "#141412", inkMid: "#48463f",
  inkFaint: "#9b9891", rule: "#e2e0db", accent: "#b85c6e",
  accentFaint: "#f9f0f2", accentRule: "#e8c2ca",
};

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500&display=swap";

// ─── URL state encoding (shareable result URLs) ─────────────────────────────
async function encodeState(answers, result) {
  const json = JSON.stringify({ a: answers, r: result });
  const blob = new Blob([json]);
  const cs = new CompressionStream('deflate');
  const compressed = blob.stream().pipeThrough(cs);
  const buf = await new Response(compressed).arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decodeState(hash) {
  const b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice(0, (4 - b64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const text = await new Response(ds.readable).text();
  return JSON.parse(text);
}

// ─── Config — paste your deployed Google Apps Script URL here ─────────────────
const APPS_SCRIPT_URL = "/api/send-email";

// ─── Email HTML builder ───────────────────────────────────────────────────────
function buildEmailHTML(result, answers) {
  const LEVEL_LABELS = {beginner:"Learning",intermediate:"Building Confidence",advanced:"Aggressive & Technical"};
  const PRIORITY_LABELS = {easy_turning:"Control & Flow",speed_carving:"Speed & Precision",all_mountain:"All-Mountain",park_freestyle:"Park & Freestyle"};
  const h = answers.height||68;
  const heightFt = `${Math.floor(h/12)}′ ${h%12<10?"0"+(h%12):h%12}″`;
  const shops = (result.ski.shops||[]).map(s=>`<a href="${s.url}" style="display:inline-block;margin:0 6px 6px 0;padding:8px 16px;border:1px solid #e2e0db;border-radius:2px;font-family:Arial,sans-serif;font-size:12px;color:#48463f;text-decoration:none;letter-spacing:0.06em">${s.name.toUpperCase()} →</a>`).join("");
  const sources = (result.ski.researchSources||[]).map(s=>`<span style="display:inline-block;margin:0 5px 5px 0;padding:4px 10px;border:1px solid #e8c2ca;background:#f9f0f2;border-radius:2px;font-family:Arial,sans-serif;font-size:11px;color:#b85c6e">${s}</span>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f4f2;font-family:Arial,sans-serif"><div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e2e0db"><div style="padding:24px 40px;border-bottom:1px solid #e2e0db"><p style="margin:0;font-size:11px;letter-spacing:0.14em;color:#b85c6e;font-weight:600">FINDMYSKI · 2025/2026 SEASON</p></div><div style="padding:36px 40px 28px;border-bottom:1px solid #e2e0db"><p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;color:#9b9891">${result.ski.brand.toUpperCase()}</p><h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:36px;font-weight:400;color:#141412;line-height:1;letter-spacing:-0.02em">${result.ski.model}</h1><p style="margin:0 0 24px;font-family:Georgia,serif;font-size:16px;color:#48463f;font-style:italic">${result.skiStyle.headline}</p><table cellpadding="0" cellspacing="0"><tr>${[["LENGTH",result.ski.length],["WAIST",result.ski.waistWidth],["FLEX",result.ski.flex]].map(([l,v])=>`<td style="padding-right:28px"><p style="margin:0 0 2px;font-size:10px;letter-spacing:0.1em;color:#9b9891">${l}</p><p style="margin:0;font-size:15px;font-weight:700;color:#141412">${v}</p></td>`).join("")}</tr></table></div><div style="padding:28px 40px;border-bottom:1px solid #e2e0db"><p style="margin:0 0 10px;font-size:10px;letter-spacing:0.14em;color:#9b9891;font-weight:600">WHY THIS SKI</p><p style="margin:0;font-size:14px;color:#48463f;line-height:1.75">${result.ski.whyPerfect}</p></div><div style="padding:28px 40px;border-bottom:1px solid #e2e0db;background:#faf9f7"><p style="margin:0 0 10px;font-size:10px;letter-spacing:0.14em;color:#9b9891;font-weight:600">EXPERT VERDICT</p><p style="margin:0 0 14px;font-size:14px;color:#48463f;line-height:1.75">${result.ski.awardsOrReviews}</p>${sources?`<div>${sources}</div>`:""}</div><div style="padding:28px 40px;border-bottom:1px solid #e2e0db"><p style="margin:0 0 14px;font-size:10px;letter-spacing:0.14em;color:#9b9891;font-weight:600">YOUR PROFILE</p><table cellpadding="0" cellspacing="0" style="width:100%">${[["Height",heightFt],["Weight",`${answers.weight||""} lbs`],["Boot (Mondo)",String(answers.bootMondo||"")],["Level",LEVEL_LABELS[answers.level]||""],["Priority",PRIORITY_LABELS[answers.priority]||""]].map(([l,v])=>`<tr><td style="padding:7px 0;font-size:12px;color:#9b9891;border-bottom:1px solid #e2e0db;width:50%">${l}</td><td style="padding:7px 0;font-size:13px;color:#141412;font-weight:600;border-bottom:1px solid #e2e0db;text-align:right">${v}</td></tr>`).join("")}</table></div><div style="padding:28px 40px;border-bottom:1px solid #e2e0db"><p style="margin:0 0 12px;font-size:10px;letter-spacing:0.14em;color:#9b9891;font-weight:600">SKI CONSTRUCTION</p><table cellpadding="0" cellspacing="0" style="width:100%"><tr><td style="vertical-align:top;width:50%;padding-right:20px"><p style="margin:0 0 4px;font-size:10px;letter-spacing:0.08em;color:#9b9891">ROCKER PROFILE</p><p style="margin:0;font-size:13px;color:#48463f;line-height:1.6">${result.ski.rockerProfile}</p></td><td style="vertical-align:top;width:50%"><p style="margin:0 0 4px;font-size:10px;letter-spacing:0.08em;color:#9b9891">CONSTRUCTION</p><p style="margin:0;font-size:13px;color:#48463f;line-height:1.6">${result.ski.construction}</p></td></tr></table></div><div style="padding:28px 40px;border-bottom:1px solid #e2e0db"><p style="margin:0 0 8px;font-size:10px;letter-spacing:0.14em;color:#9b9891;font-weight:600">WHERE TO BUY</p><p style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px;color:#141412">${result.ski.priceRange}</p><div style="background:#f9f0f2;border:1px solid #e8c2ca;border-radius:2px;padding:10px 14px;margin-bottom:14px"><p style="margin:0;font-size:12px;color:#b85c6e;line-height:1.6">${result.ski.saleTip}</p></div><div>${shops}</div></div><div style="padding:20px 40px;text-align:center"><p style="margin:0;font-size:11px;color:#9b9891;line-height:1.6">FindMySki · Recommendations based on 2025/2026 expert reviews from OutdoorGearLab, SKI Magazine, Switchback, GearJunkie, Blister &amp; more.</p></div></div></body></html>`;
}

const SYSTEM_PROMPT = `You are an expert ski advisor with deep knowledge of 2025/2026 ski models, drawing from OutdoorGearLab, SKI Magazine, Outside, Switchback Travel, Blister Review, Powder Magazine, Treeline Review, and Backcountry Magazine.

2025/2026 EXPERT-TESTED MODELS:

BEGINNER (flex 55-70, waist 88-100mm, heavy tip rocker, chin-height):
- Men: Rossignol Experience 80 CA ($449), K2 Mindbender 89 ($499), Atomic Maverick 84 ($449), Head Kore 93 ($549), Season Primer ($449, Switchback best beginner pick)
- Women: Rossignol Arcade W 80 ($429), Atomic Maven 86 C ($419), Salomon QST Access 80 W ($399), Blizzard Black Pearl 88 ($649)

INTERMEDIATE ALL-MOUNTAIN (flex 72-85, waist 88-96mm, Rocker-Camber-Rocker):
- Men: Atomic Bent 90 ($649, Switchback top pick — "light, quick, and fun all over the hill"), Head Kore 94 Ti ($749, OutdoorGearLab Best Buy 2026 — "highest score for lowest price, best for frontside carvers venturing off-piste"), Salomon QST 94 ($699), Armada Declivity 92 Ti ($825, SKI Mag — "nimble in small-radius turns, exceptional in soft variable snow"), Rossignol Arcade 94 ($619)
- Women: Elan Ripstick 94 W ($749, OGL Best Buy women's 2026), Nordica Santa Ana 97 ($799, OGL Editors Choice — "new benchmark for women's all-mountain, better than ever"), Head Kore 99 Ti W ($799, Outside/SKI Most Versatile), Blizzard Black Pearl 94 ($699)

ADVANCED ALL-MOUNTAIN (flex 88-95, waist 88-100mm):
- Men: Volkl M7 Mantra ($929, OGL #1 men's 2026, perfect 10 Stability — "predictable on groomers, powerful in any condition, 4D Radius Drive"; Blister — "nothing out there that feels like a Mantra"), Blizzard Rustler 9 ($699, OGL #2 — "freeride design turns the mountain into a playground, Freeblend woodcore for snappy rebound"), Nordica Enforcer 94 ($799, Switchback Best Overall — "about as well-rounded as it gets"), Head Kore 100 Ti ($799), Stockli Stormrider 95 ($1489, SKI Mag Editors Choice — "sports car on snow")
- Women: Nordica Santa Ana 97 ($799, OGL Editors Choice — "confidence at speed, quick turns, precise control in bumps"), Atomic Maven 103 CTI ($799), Elan Ripstick 94 W ($749)

ADVANCED POWDER/FREERIDE (flex 80-90, waist 96-115mm, directional rocker):
- Men: K2 Mindbender 99Ti ($799), Nordica Unleashed 108 ($899, Outside — "floats in powder, pops and slashes with energy"), Armada ARV 106 Ti ($849, Powder Mag — "titanal-infused, hard-charging"), Dynastar M-Free 100 ($799, SKI Mag tester top pick — "playful shape, powerful forebody"), Atomic Bent 100 ($649), Blizzard Rustler 9 ($699)
- Women: Nordica Santa Ana 97 ($799), Atomic Maven 103 CTI ($799), Rossignol Rallybird Soul 102 ($849, SKI Mag women's wide all-mountain top pick)

SIZING: Base=height in cm. Beginner: -15 to -20cm. Intermediate: -5 to -10cm. Advanced: 0 to -5cm (+3 for powder). Add 2cm per 25lbs over 160lbs (men) or 130lbs (women).
WAIST: <82mm=carving · 82-96mm=all-mountain · 96-115mm=powder

PAST EXPERIENCE LOGIC:
- Liked a ski + matches profile → consider recommending it; acknowledge in pastExperience
- Disliked a ski → do NOT recommend it; note what they didn't like, explain how your pick differs
- Rental/demo experience → note what it reveals about preferences

BOOT SIZING Men US→Mondo: 7=24.5,7.5=25,8=25.5,8.5=26,9=26.5,9.5=27,10=27.5,10.5=28,11=28.5,11.5=29,12=29.5,13=30.5
BOOT SIZING Women US→Mondo: 5=21.5,5.5=22,6=22.5,6.5=23,7=23.5,7.5=24,8=24.5,8.5=25,9=25.5,9.5=26,10=26.5

Return ONLY raw valid JSON, no markdown:
{
  "skiStyle": {
    "headline": "e.g. Confident All-Mountain Carver",
    "summary": "2-3 sentences.",
    "lengthRange": "e.g. 170-178cm",
    "waistRange": "e.g. 85-95mm",
    "profileType": "e.g. Rocker-Camber-Rocker",
    "profileExplain": "One plain sentence.",
    "flexNote": "One sentence on flex."
  },
  "ski": {
    "brand": "e.g. Volkl",
    "model": "e.g. M7 Mantra",
    "year": "2025/2026",
    "length": "e.g. 177cm",
    "waistWidth": "e.g. 96mm",
    "flex": "e.g. 90 - Stiff",
    "rockerProfile": "Plain English description.",
    "construction": "Core + reinforcements in plain English.",
    "whyPerfect": "2-3 sentences specific to their profile.",
    "awardsOrReviews": "One sentence on awards with specific tester quote if available.",
    "priceRange": "e.g. $700-$850 ski only · $950-$1,100 with bindings",
    "saleTip": "End-of-season (March-April) sales at REI and Sports Basement often reach 20-40% off. Evo and Backcountry also run mid-season deals.",
    "evoSlug": "url-friendly slug for evo.com product page, e.g. volkl-m7-mantra or nordica-santa-ana-97",
    "shops": [
      {"name": "REI", "url": "https://www.rei.com/search#q=MODELNAME"},
      {"name": "Evo", "url": "https://www.evo.com/skis/EVOSLUG"},
      {"name": "Backcountry", "url": "https://www.backcountry.com/search?q=MODELNAME"},
      {"name": "Sports Basement", "url": "https://www.sportsbasement.com/search?q=MODELNAME"}
    ]
  },
  "pastExperience": {
    "hasNote": true or false,
    "note": "1-2 sentences acknowledging their past ski experience and how it connects to this recommendation. Only include if hasNote is true."
  },
  "sources": [
    {"outlet": "OutdoorGearLab", "note": "Specific finding about this ski from OGL testing."},
    {"outlet": "SKI Magazine", "note": "Specific finding from SKI Mag testing."},
    {"outlet": "Switchback Travel", "note": "Specific finding from Switchback."}
  ],
  "alternatives": [
    {
      "brand": "e.g. Blizzard",
      "model": "e.g. Rustler 9",
      "pitch": "If you want a more playful, freeride-oriented ride",
      "oneLiner": "One sentence on what makes this ski different and why it could suit the user.",
      "length": "e.g. 180cm",
      "waistWidth": "e.g. 96mm",
      "flex": "e.g. 85 - Medium-Stiff",
      "priceRange": "e.g. $650-$750"
    }
  ]
}

Include 2-3 alternatives. Each must be a DIFFERENT ski (different brand or model) from the primary. Each pitch should highlight a distinct trade-off relevant to the user's profile: e.g. "If you want something easier to turn", "If you want a faster ski for carving", "If you want more float in powder", "If you want a more balanced ride for stability". Make pitches conversational and specific.`;

const STEPS = [
  { id:"priority", question:"What matters most on the mountain?", sub:"This shapes everything about your ski.", label:"PRIORITY", type:"cards", options:[
    {value:"easy_turning",   label:"Control & Flow",          desc:"Smooth turns, feel in control at all times"},
    {value:"speed_carving",  label:"Speed & Precision",       desc:"Hard carves, high speed, maximum edge grip"},
    {value:"all_mountain",   label:"All-Mountain Versatility",desc:"Groomers, trees, powder. You want it all."},
    {value:"park_freestyle", label:"Park & Freestyle",        desc:"Jumps, rails, butters, creative skiing"},
  ]},
  { id:"level", question:"How would you describe your skiing?", sub:"Be honest. This determines flex, shape, and length.", label:"SKILL LEVEL", type:"cards", options:[
    {value:"beginner",     label:"Learning",               desc:"Green runs, building confidence. Still using a wedge or pizza to slow down."},
    {value:"intermediate", label:"Building Confidence",    desc:"Blues feel natural, venturing onto blacks. Parallel turns, controlled speed."},
    {value:"advanced",     label:"Aggressive & Technical", desc:"Black diamonds, moguls, variable terrain. Charging hard at high speed."},
  ]},
  { id:"height", question:"Your height?", sub:"Ski length is anchored to your height.", label:"HEIGHT", type:"slider", min:58, max:78, default:68,
    format: v => { const ft=Math.floor(v/12),inc=v%12; return `${ft}′ ${inc===0?"00":inc<10?"0"+inc:inc}″`; }},
  { id:"weight", question:"Your weight?", sub:"Heavier skiers need more length and stiffness for stability at speed.", label:"WEIGHT", type:"slider", min:90, max:260, default:155,
    format: v => `${v} lbs`},
  { id:"gender", question:"Shopping for?", sub:"Women's skis use different flex curves and stance geometry.", label:"SKI TYPE", type:"cards", options:[
    {value:"male",   label:"Men's Skis",     desc:""},
    {value:"female", label:"Women's Skis",   desc:""},
    {value:"unisex", label:"Either / Unisex",desc:""},
  ]},
  { id:"bootSize",   question:"Your boot size?",    sub:"Ski boots use Mondopoint sizing (foot length in cm). Enter yours directly, or expand below if you only know your shoe size.", label:"BOOT SIZE",   type:"boot"},
  { id:"experience", question:"Skis you've tried?", sub:"Rentals, demos, anything. Tell us what felt right and what didn't. Completely optional.", label:"EXPERIENCE", type:"freetext"},
];

const SIZES_M=[6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13];
const SIZES_W=[5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11];
const MONDO_SIZES=[21.5,22,22.5,23,23.5,24,24.5,25,25.5,26,26.5,27,27.5,28,28.5,29,29.5,30,30.5,31];
const MONDO_M={6:23.5,6.5:24,7:24.5,7.5:25,8:25.5,8.5:26,9:26.5,9.5:27,10:27.5,10.5:28,11:28.5,11.5:29,12:29.5,12.5:30,13:30.5};
const MONDO_W={5:21.5,5.5:22,6:22.5,6.5:23,7:23.5,7.5:24,8:24.5,8.5:25,9:25.5,9.5:26,10:26.5,10.5:27,11:27.5};
function getMondo(sz,g){return (g==="female"?MONDO_W:MONDO_M)[sz]??null;}

const LEVEL_LABELS={beginner:"Learning",intermediate:"Building Confidence",advanced:"Aggressive & Technical"};
const PRIORITY_LABELS={easy_turning:"Control & Flow",speed_carving:"Speed & Precision",all_mountain:"All-Mountain",park_freestyle:"Park & Freestyle"};

const SOURCES_META={
  "OutdoorGearLab":   {url:"https://www.outdoorgearlab.com/topics/snow-sports/best-all-mountain-skis"},
  "SKI Magazine":     {url:"https://www.skimag.com/gear/ski-reviews/"},
  "Outside":          {url:"https://www.outsideonline.com/outdoor-gear/snow-sports-gear/best-all-mountain-skis-tested/"},
  "Switchback Travel":{url:"https://www.switchbacktravel.com/best-all-mountain-skis"},
  "Blister Review":   {url:"https://blisterreview.com/"},
  "Powder Magazine":  {url:"https://www.powder.com/gear/best-all-mountain-skis"},
  "Treeline Review":  {url:"https://www.treelinereview.com/gearreviews/best-beginner-skis"},
  "Backcountry Mag":  {url:"https://backcountrymagazine.com/gear/2026-editors-choice-ski-reviews/"},
};

export default function App() {
  return IS_ADMIN ? <AdminDashboard /> : <FindMySki />;
}

function FindMySki() {
  const [step,setStep]=useState(-1);
  const [answers,setAnswers]=useState({});
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [sliderVal,setSliderVal]=useState(null);
  const [animKey,setAnimKey]=useState(0);
  const [bootMode,setBootMode]=useState("mondo");
  const [shoeExpanded,setShoeExpanded]=useState(false);
  const [selectedMondo,setSelectedMondo]=useState(null);
  const [selectedShoe,setSelectedShoe]=useState(null);
  const [experienceText,setExperienceText]=useState("");
  const [email,setEmail]=useState("");
  const [emailSent,setEmailSent]=useState(false);
  const [emailLoading,setEmailLoading]=useState(false);
  const [emailError,setEmailError]=useState("");
  const [skiImage,setSkiImage]=useState(null);
  const [imgLoading,setImgLoading]=useState(false);

  const isIntro=step===-1, isResult=step===STEPS.length;
  const current=(!isIntro&&!isResult)?STEPS[step]:null;
  const gender=answers.gender;

  useEffect(()=>{if(current?.type==="slider")setSliderVal(answers[current.id]??current.default);},[step]);
  useEffect(()=>{setAnimKey(k=>k+1);},[step]);

  // Hydrate from URL hash on mount + handle back/forward
  useEffect(()=>{
    const loadFromHash=()=>{
      const hash=window.location.hash.slice(1);
      if(hash.startsWith('r/')){
        decodeState(hash.slice(2)).then(({a,r})=>{
          setAnswers(a);setResult(r);setStep(STEPS.length);
          setEmail("");setEmailSent(false);setEmailError("");
          if(r?.ski) fetchSkiImage(r.ski.brand, r.ski.model);
        }).catch(()=>{});
      }
    };
    loadFromHash();
    window.addEventListener('hashchange',loadFromHash);
    return()=>window.removeEventListener('hashchange',loadFromHash);
  },[]);

  const advance=(next)=>{
    if(step<STEPS.length-1)setStep(s=>s+1);
    else fetchResult(next);
  };
  const pick=(value)=>{
    const next={...answers,[current.id]:value};
    setAnswers(next);
    track("step_answer", { step: current.id, value });
    setTimeout(()=>advance(next),110);
  };
  const confirmSlider=()=>{
    const next={...answers,[current.id]:sliderVal};
    track("step_answer", { step: current.id, value: sliderVal });
    setAnswers(next);advance(next);
  };
  const confirmBoot=()=>{
    const mondoVal=bootMode==="mondo"?selectedMondo:(selectedShoe?getMondo(selectedShoe,gender||"male"):null);
    if(!mondoVal)return;
    const next={...answers,bootMondo:mondoVal,shoeSize:bootMode==="shoe"?selectedShoe:null};
    track("step_answer", { step: "bootSize", mondoVal, bootMode, shoeSize: next.shoeSize ?? null });
    setAnswers(next);advance(next);
  };
  const confirmExperience=()=>{
    const next={...answers,experience:experienceText.trim()};
    track("step_answer", { step: "experience", skipped: !experienceText.trim(), charCount: experienceText.trim().length });
    setAnswers(next);advance(next);
  };

  const fetchResult=async(ans)=>{
    setStep(STEPS.length);setLoading(true);
    track("wizard_completed", {
      priority: ans.priority, level: ans.level,
      gender: ans.gender, experienceSkipped: !ans.experience,
    });
    const hCm=Math.round((ans.height??68)*2.54);
    const g=ans.gender||"male";
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:2500,system:SYSTEM_PROMPT,
          messages:[{role:"user",content:`Profile:\n- Priority: ${ans.priority}\n- Level: ${ans.level}\n- Height: ${STEPS[2].format(ans.height??68)} (${hCm}cm)\n- Weight: ${ans.weight??155} lbs\n- Gender: ${g}\n- Boot (Mondo): ${ans.bootMondo}\n${ans.experience?`- Past ski experience: ${ans.experience}`:""}\n\nRecommend the best 2025/2026 ski, plus 2-3 alternatives.`}],
        }),
      });
      const data=await res.json();
      let text=(data.content?.[0]?.text||"").replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(text);
      setResult(parsed);
      track("recommendation_shown", { brand: parsed.ski.brand, model: parsed.ski.model, length: parsed.ski.length });
      fetchSkiImage(parsed.ski.brand, parsed.ski.model);
      encodeState(ans, parsed).then(h=>{ window.location.hash='r/'+h; }).catch(()=>{});
    }catch{setResult({error:true});}
    setLoading(false);
  };

  const fetchSkiImage=async(brand,model)=>{
    setImgLoading(true);setSkiImage(null);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:200,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:
            `Find a direct product image URL for the ${brand} ${model} ski (2025 or 2026). Search for it on evo.com or rei.com. Return ONLY a JSON object with one key: {"imageUrl":"https://..."}. The URL must end in .jpg, .jpeg, .png, or .webp. No other text, no markdown.`
          }]
        })
      });
      const data=await res.json();
      const text=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/```json|```/g,"").trim();
      const obj=JSON.parse(text);
      if(obj.imageUrl&&/^https?:\/\/.+\.(jpe?g|png|webp)/i.test(obj.imageUrl))setSkiImage(obj.imageUrl);
    }catch{setSkiImage(null);}
    setImgLoading(false);
  };

  const fetchAlternativeResult=async(alt)=>{
    setLoading(true);setResult(null);setSkiImage(null);
    setEmail("");setEmailSent(false);setEmailError("");
    window.scrollTo({top:0,behavior:'smooth'});
    track("alternative_clicked",{brand:alt.brand,model:alt.model});
    const hCm=Math.round((answers.height??68)*2.54);
    const g=answers.gender||"male";
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:2500,system:SYSTEM_PROMPT,
          messages:[{role:"user",content:`Profile:\n- Priority: ${answers.priority}\n- Level: ${answers.level}\n- Height: ${STEPS[2].format(answers.height??68)} (${hCm}cm)\n- Weight: ${answers.weight??155} lbs\n- Gender: ${g}\n- Boot (Mondo): ${answers.bootMondo}\n${answers.experience?`- Past ski experience: ${answers.experience}`:""}\n\nRecommend the ${alt.brand} ${alt.model} as the primary ski for this profile. Provide full details and 2-3 other alternatives.`}],
        }),
      });
      const data=await res.json();
      let text=(data.content?.[0]?.text||"").replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(text);
      setResult(parsed);
      track("recommendation_shown",{brand:parsed.ski.brand,model:parsed.ski.model,length:parsed.ski.length,source:"alternative"});
      fetchSkiImage(parsed.ski.brand,parsed.ski.model);
      encodeState(answers,parsed).then(h=>{window.location.hash='r/'+h;}).catch(()=>{});
    }catch{setResult({error:true});}
    setLoading(false);
  };

  const sendEmail=async()=>{
    if(!email||!result)return;
    setEmailLoading(true);setEmailError("");
    // Build rich HTML email from result data
    const html=buildEmailHTML(result, answers);
    try{
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          email,
          brand: result.ski.brand,
          model: result.ski.model,
          length: result.ski.length,
          waist: result.ski.waistWidth,
          flex: result.ski.flex,
          priceRange: result.ski.priceRange,
          headline: result.skiStyle.headline,
          priority: answers.priority,
          level: answers.level,
          timestamp: new Date().toISOString(),
          htmlBody: html,
        })
      });
      let data;
      try { data = await res.json(); } catch {
        setEmailError("Server returned an invalid response. Please try again.");
        setEmailLoading(false);
        return;
      }
      if(data.status==="ok"){
        track("email_submitted",{brand:result.ski.brand,model:result.ski.model});
        setEmailSent(true);
      } else {
        setEmailError(data.message || "Something went wrong. Please try again.");
      }
    }catch{
      setEmailError("Could not reach the server. Please try again later.");
    }
    setEmailLoading(false);
  };

  const restart=()=>{
    track("restarted");
    setStep(-1);setAnswers({});setResult(null);setEmail("");setEmailSent(false);setEmailError("");
    setSliderVal(null);setSelectedMondo(null);setSelectedShoe(null);
    setShoeExpanded(false);setBootMode("mondo");setExperienceText("");
    setSkiImage(null);setImgLoading(false);
    history.replaceState(null,'',window.location.pathname+window.location.search);
  };

  return(
    <>
      <link rel="stylesheet" href={FONT_LINK}/>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; }
        @media (max-width: 600px) {
          .fms-main { padding: 0 1rem 5rem !important; }
          .fms-header-inner { padding: 0 1rem !important; }
        }
      `}</style>
      <div style={{background:T.bg,minHeight:"100vh",fontFamily:"'DM Sans', sans-serif"}}>

        {/* HEADER */}
        <header style={{position:"sticky",top:0,zIndex:30,background:"rgba(245,244,242,0.92)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",borderBottom:`1px solid ${T.rule}`}}>
          <div className="fms-header-inner" style={{maxWidth:640,margin:"0 auto",padding:"0 1.5rem",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <button onClick={restart} style={{background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",alignItems:"baseline",gap:"0.45rem"}}>
              <span style={{fontFamily:"'Cormorant Garamond', serif",fontWeight:500,fontSize:"1.2rem",color:T.ink,letterSpacing:"0.04em"}}>FINDMYSKI</span>
              <span style={{width:4,height:4,borderRadius:"50%",background:T.accent,display:"inline-block",marginBottom:1}}/>
            </button>
            <div style={{display:"flex",alignItems:"center",gap:"1.25rem"}}>
              {!isIntro&&!isResult&&(
                <>
                  <span style={{fontSize:"0.7rem",color:T.inkFaint,letterSpacing:"0.06em"}}>{step+1} / {STEPS.length}</span>
                  <div style={{width:60,height:1.5,background:T.rule,borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",background:T.accent,width:`${((step+1)/STEPS.length)*100}%`,transition:"width 0.45s cubic-bezier(0.4,0,0.2,1)"}}/>
                  </div>
                </>
              )}
              {isResult&&<button onClick={restart} style={{background:"none",border:"none",fontSize:"0.72rem",color:T.inkFaint,cursor:"pointer",letterSpacing:"0.05em",fontFamily:"'DM Sans', sans-serif",padding:0}}>START OVER</button>}
            </div>
          </div>
        </header>

        <main className="fms-main" style={{maxWidth:640,margin:"0 auto",padding:"0 1.5rem 6rem"}}>

          {/* INTRO */}
          {isIntro&&(
            <div key="intro" style={{animation:"rise 0.5s cubic-bezier(0.4,0,0.2,1)"}}>
              <div style={{paddingTop:"5rem",paddingBottom:"3rem",borderBottom:`1px solid ${T.rule}`}}>
                <p style={{fontSize:"0.68rem",letterSpacing:"0.18em",color:T.accent,margin:"0 0 1.5rem",fontWeight:500}}>2025 / 2026 SEASON</p>
                <h1 style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"clamp(2.8rem,7vw,4.2rem)",fontWeight:500,color:T.ink,margin:"0 0 1.25rem",lineHeight:1.05,letterSpacing:"-0.025em"}}>
                  Find the ski<br/><em style={{fontStyle:"italic",color:T.inkMid}}>built for you.</em>
                </h1>
                <p style={{fontSize:"1rem",color:T.inkMid,margin:"0 0 2.5rem",lineHeight:1.7,fontWeight:300,maxWidth:480}}>
                  Seven questions. One precise recommendation: exact model, length, width, and where to buy it. Built on real tester data from eight expert sources.
                </p>
                <GhostBtn onClick={()=>{ track("begin_clicked"); setStep(0); }} filled>Begin →</GhostBtn>
              </div>

              <div style={{paddingTop:"2.5rem",paddingBottom:"2.5rem",borderBottom:`1px solid ${T.rule}`}}>
                <p style={{fontSize:"0.62rem",letterSpacing:"0.14em",color:T.inkFaint,margin:"0 0 1.5rem",fontWeight:500}}>HOW IT WORKS</p>
                <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
                  {[
                    ["01","Tell us what you care about","Your priorities shape everything: speed, control, versatility, or freestyle."],
                    ["02","Share a few measurements","Height, weight, and boot size define your ideal ski length and width."],
                    ["03","Share what you've tried","Rentals, demos, borrowed pairs. Your past experience helps us rule out what didn't work."],
                    ["04","Get a precise, research-backed match","We cross-reference your profile against expert-tested 2025/2026 models from 8 leading publications."],
                    ["05","Take it with you","Email your recommendation to yourself. Model, specs, price, and trusted retailers, ready for the shop."],
                  ].map(([num,title,b])=>(
                    <div key={num} style={{display:"flex",gap:"1.25rem",alignItems:"flex-start"}}>
                      <span style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"1.1rem",color:T.accent,fontWeight:500,flexShrink:0,minWidth:24}}>{num}</span>
                      <div>
                        <p style={{fontSize:"0.86rem",fontWeight:500,color:T.ink,margin:"0 0 0.2rem"}}>{title}</p>
                        <p style={{fontSize:"0.78rem",color:T.inkFaint,margin:0,lineHeight:1.65,fontWeight:300}}>{b}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{paddingTop:"2rem"}}>
                <p style={{fontSize:"0.62rem",letterSpacing:"0.14em",color:T.inkFaint,margin:"0 0 1rem",fontWeight:500}}>SOURCED FROM</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem"}}>
                  {Object.entries(SOURCES_META).map(([name,{url}])=>(
                    <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:"0.72rem",color:T.inkMid,border:`1px solid ${T.rule}`,borderRadius:2,padding:"0.3rem 0.65rem",fontWeight:300,textDecoration:"none",letterSpacing:"0.02em",transition:"all 0.15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=T.ink;e.currentTarget.style.color=T.ink;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.rule;e.currentTarget.style.color=T.inkMid;}}>
                      {name}
                    </a>
                  ))}
                </div>
                <p style={{fontSize:"0.72rem",color:T.inkFaint,margin:"1.25rem 0 0",lineHeight:1.7,fontWeight:300}}>
                  Powered by AI, informed by tester feedback from 175+ models tested in the 2025/2026 season. Always confirm sizing in person before purchase.
                </p>
              </div>

              {/* FAQ */}
              <div style={{paddingTop:"2.5rem",paddingBottom:"2.5rem",borderTop:`1px solid ${T.rule}`}}>
                <p style={{fontSize:"0.62rem",letterSpacing:"0.14em",color:T.inkFaint,margin:"0 0 1.5rem",fontWeight:500}}>FREQUENTLY ASKED QUESTIONS</p>
                {[
                  ["How does FindMySki choose a ski for me?", "FindMySki uses AI to cross-reference your ability level, body measurements, skiing priorities, and past experience against expert-tested 2025/2026 ski models. Our recommendations draw on independent testing data from eight leading ski publications — including OutdoorGearLab, SKI Magazine, Blister Review, Switchback Travel, Outside, Powder Magazine, Treeline Review, and Backcountry Magazine — who collectively evaluated over 175 models during the 2025 SKI Test in Big Sky, Montana, and through year-long field reviews."],
                  ["Is FindMySki free?", "Yes, completely free. No account needed. Answer seven questions and get your recommendation in about 60 seconds."],
                  ["What sources does FindMySki use?", "We aggregate testing data and editorial reviews from eight expert publications: OutdoorGearLab (in-depth scoring and lab testing), SKI Magazine (annual SKI Test with 50+ testers), Outside (field-tested gear guides), Switchback Travel (detailed comparison reviews), Blister Review (deep-dive performance analysis), Powder Magazine (backcountry and freeride expertise), Treeline Review (beginner and intermediate focused), and Backcountry Magazine (Editors' Choice awards). Each source brings a different testing methodology and perspective, giving our AI a well-rounded view of every ski's strengths and trade-offs."],
                  ["How accurate are the ski length and width recommendations?", "Our sizing algorithm follows industry-standard formulas based on your height, weight, boot size, and ability level. Beginners typically ski 15–20 cm shorter than their height, intermediates 5–10 cm shorter, and advanced skiers within 0–5 cm. We also factor in weight adjustments and skiing style. That said, we always recommend confirming sizing with a bootfitter or ski shop before purchasing."],
                  ["Can I share my recommendation?", "Yes. After receiving your match, you can text the full recommendation to yourself — including model, specs, price range, and links to trusted retailers like REI, Evo, Backcountry, and Sports Basement."],
                  ["What ski categories do you cover?", "FindMySki covers all-mountain, beginner, intermediate, advanced, powder/freeride, and park/freestyle categories for both men's and women's skis. Our database includes skis from major brands like Volkl, Nordica, Blizzard, Atomic, Head, K2, Salomon, Rossignol, Elan, Armada, Dynastar, and Stockli."],
                  ["How often is the ski data updated?", "Our ski database is updated each season. The current recommendations reflect the 2025/2026 model year, incorporating the latest expert reviews and test results published between fall 2024 and spring 2026."],
                ].map(([q,a])=>(
                  <details key={q} style={{borderBottom:`1px solid ${T.rule}`,padding:"0"}}>
                    <summary style={{cursor:"pointer",padding:"1rem 0",fontSize:"0.86rem",fontWeight:500,color:T.ink,listStyle:"none",WebkitListStyle:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>{q}</span>
                      <span style={{fontSize:"0.7rem",color:T.inkFaint,flexShrink:0,marginLeft:"1rem",transition:"transform 0.2s"}}>▼</span>
                    </summary>
                    <div style={{paddingBottom:"1.25rem"}}>
                      <p style={{fontSize:"0.82rem",color:T.inkMid,margin:0,lineHeight:1.75,fontWeight:300}}>{a}</p>
                    </div>
                  </details>
                ))}
              </div>

              {/* Detailed Sources */}
              <div style={{paddingTop:"2rem",paddingBottom:"2.5rem",borderTop:`1px solid ${T.rule}`}}>
                <p style={{fontSize:"0.62rem",letterSpacing:"0.14em",color:T.inkFaint,margin:"0 0 0.5rem",fontWeight:500}}>OUR EXPERT SOURCES</p>
                <p style={{fontSize:"0.82rem",color:T.inkMid,margin:"0 0 1.5rem",lineHeight:1.75,fontWeight:300}}>
                  Every FindMySki recommendation is informed by independent testing from eight leading ski publications. These outlets employ professional testers, certified instructors, and former racers who spend hundreds of days on snow each season evaluating equipment. Here's who powers our analysis:
                </p>
                {[
                  ["OutdoorGearLab", "https://www.outdoorgearlab.com/topics/snow-sports/best-all-mountain-skis", "Rigorous side-by-side testing with numerical scoring across stability, edge grip, playfulness, and value. Their methodology includes multi-day testing sessions at multiple resorts with standardized evaluation criteria."],
                  ["SKI Magazine", "https://www.skimag.com/gear/ski-reviews/", "Home of the annual SKI Test — the largest independent ski test in North America, held each spring in Big Sky, Montana. Over 50 expert testers evaluate 175+ models across groomed, bumps, steeps, and powder conditions."],
                  ["Blister Review", "https://blisterreview.com/", "Known for deep-dive, multi-day performance reviews that go beyond first impressions. Their testers log extensive time on each ski across varied conditions before publishing detailed analysis."],
                  ["Switchback Travel", "https://www.switchbacktravel.com/best-all-mountain-skis", "Comprehensive comparison guides with detailed specs, pros/cons analysis, and real-world performance notes. Particularly strong coverage of beginner and intermediate categories."],
                  ["Outside", "https://www.outsideonline.com/outdoor-gear/snow-sports-gear/best-all-mountain-skis-tested/", "Field-tested gear guides from the editorial team at Outside (formerly Outside Online). Known for testing gear in real backcountry and resort conditions across the West."],
                  ["Powder Magazine", "https://www.powder.com/gear/best-all-mountain-skis", "The authority on freeride and backcountry skiing. Their testing emphasizes off-piste performance, powder handling, and big-mountain capability."],
                  ["Treeline Review", "https://www.treelinereview.com/gearreviews/best-beginner-skis", "Focused reviews for beginner and progressing skiers. Their testing methodology specifically evaluates ease of turn initiation, forgiveness, and confidence-building characteristics."],
                  ["Backcountry Magazine", "https://backcountrymagazine.com/gear/2026-editors-choice-ski-reviews/", "Annual Editors' Choice awards recognizing standout gear across backcountry, resort, and touring categories. Testing is conducted by experienced backcountry skiers and guides."],
                ].map(([name,url,desc])=>(
                  <div key={name} style={{padding:"1rem 0",borderTop:`1px solid ${T.rule}`}}>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:"0.82rem",color:T.ink,textDecoration:"none",fontWeight:500,transition:"color 0.15s"}}
                      onMouseEnter={e=>e.currentTarget.style.color=T.accent}
                      onMouseLeave={e=>e.currentTarget.style.color=T.ink}>
                      {name} →
                    </a>
                    <p style={{fontSize:"0.78rem",color:T.inkFaint,margin:"0.35rem 0 0",lineHeight:1.7,fontWeight:300}}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WIZARD */}
          {!isIntro&&!isResult&&(
            <div key={animKey} style={{animation:"rise 0.32s cubic-bezier(0.4,0,0.2,1)"}}>
              <div style={{paddingTop:"3.5rem",paddingBottom:"2.25rem",borderBottom:`1px solid ${T.rule}`,marginBottom:"2rem"}}>
                <p style={{fontSize:"0.67rem",letterSpacing:"0.15em",color:T.accent,margin:"0 0 0.85rem",fontWeight:500}}>
                  {String(step+1).padStart(2,"0")} · {current.label}
                </p>
                <h2 style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"2.4rem",fontWeight:500,color:T.ink,margin:"0 0 0.5rem",lineHeight:1.15,letterSpacing:"-0.01em"}}>{current.question}</h2>
                <p style={{fontSize:"0.81rem",color:T.inkMid,margin:0,fontWeight:300,lineHeight:1.65}}>{current.sub}</p>
              </div>

              {current.type==="cards"&&(
                <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
                  {current.options.map((o,i)=><OptionRow key={o.value} opt={o} selected={answers[current.id]===o.value} onSelect={()=>pick(o.value)} index={i}/>)}
                </div>
              )}

              {current.type==="slider"&&sliderVal!==null&&(
                <div>
                  <div style={{marginBottom:"2.25rem"}}>
                    <span style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"4.5rem",fontWeight:400,color:T.ink,lineHeight:1,letterSpacing:"-0.025em"}}>{current.format(sliderVal)}</span>
                  </div>
                  <input type="range" min={current.min} max={current.max} value={sliderVal} onChange={e=>setSliderVal(Number(e.target.value))} style={{width:"100%",cursor:"pointer"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.69rem",color:T.inkFaint,marginTop:"0.5rem",marginBottom:"2.5rem"}}>
                    <span>{current.format(current.min)}</span><span>{current.format(current.max)}</span>
                  </div>
                  <GhostBtn onClick={confirmSlider}>Continue</GhostBtn>
                </div>
              )}

              {current.type==="boot"&&(
                <BootStep gender={gender} selectedMondo={selectedMondo} setSelectedMondo={setSelectedMondo}
                  selectedShoe={selectedShoe} setSelectedShoe={setSelectedShoe}
                  shoeExpanded={shoeExpanded} setShoeExpanded={setShoeExpanded}
                  bootMode={bootMode} setBootMode={setBootMode} onConfirm={confirmBoot}/>
              )}

              {current.type==="freetext"&&(
                <div>
                  <textarea value={experienceText} onChange={e=>setExperienceText(e.target.value)}
                    placeholder={"e.g. Tried Rossignol Experience 76 rentals at Tahoe. Felt stable but slow to turn. Also demoed Head Kore 93 and loved how responsive it was."}
                    rows={4}
                    style={{width:"100%",fontFamily:"'DM Sans', sans-serif",background:T.surface,border:`1px solid ${T.rule}`,borderRadius:2,padding:"0.85rem 1rem",fontSize:"0.83rem",color:T.ink,lineHeight:1.7,fontWeight:300,outline:"none",resize:"vertical",transition:"border-color 0.15s"}}
                    onFocus={e=>e.target.style.borderColor=T.accent}
                    onBlur={e=>e.target.style.borderColor=T.rule}
                  />
                  <div style={{marginTop:"1.1rem",marginBottom:"1.75rem"}}>
                    <p style={{fontSize:"0.62rem",letterSpacing:"0.1em",color:T.inkFaint,margin:"0 0 0.6rem",fontWeight:500}}>EXAMPLES · TAP TO USE</p>
                    <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                      {[
                        "Rented shop skis at the resort. No idea what brand. Felt okay on green runs.",
                        "Tried Atomic Bent 90s on a demo day. Loved how playful they felt in trees.",
                        "Rented Rossignol Experience 76s last season. Felt stable but hard to turn quickly.",
                        "Demoed Head Kore 93s. Really liked the response but felt a bit stiff by end of day.",
                        "Skied on K2 Mindbenders twice. Felt great on groomers, overwhelming in powder.",
                      ].map((ex,i)=>(
                        <button key={i} onClick={()=>setExperienceText(ex)}
                          style={{background:"none",border:`1px solid ${T.rule}`,borderRadius:2,padding:"0.55rem 0.85rem",textAlign:"left",cursor:"pointer",fontFamily:"'DM Sans', sans-serif",fontSize:"0.76rem",color:T.inkFaint,fontWeight:300,lineHeight:1.5,transition:"all 0.13s",width:"100%"}}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.inkFaint;e.currentTarget.style.color=T.inkMid;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.rule;e.currentTarget.style.color=T.inkFaint;}}>
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                  <GhostBtn onClick={confirmExperience}>{experienceText.trim()?"Continue":"Skip"}</GhostBtn>
                </div>
              )}

              {step>0&&(
                <button onClick={()=>setStep(s=>s-1)}
                  style={{background:"none",border:"none",fontSize:"0.71rem",color:T.inkFaint,cursor:"pointer",marginTop:"2rem",letterSpacing:"0.06em",fontFamily:"'DM Sans', sans-serif",padding:0}}>
                  ← BACK
                </button>
              )}
            </div>
          )}

          {/* LOADING */}
          {isResult&&loading&&(
            <div style={{paddingTop:"5rem",textAlign:"center",animation:"rise 0.3s ease"}}>
              <div style={{display:"flex",gap:"6px",justifyContent:"center",marginBottom:"2rem"}}>
                {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:T.accent,animation:`pulse 1.4s ${i*0.2}s infinite ease-in-out`}}/>)}
              </div>
              <p style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"1.5rem",color:T.inkMid,fontWeight:400,fontStyle:"italic",margin:0}}>Finding your perfect match…</p>
              <p style={{fontSize:"0.74rem",color:T.inkFaint,marginTop:"0.5rem",letterSpacing:"0.05em"}}>Cross-referencing 2025/2026 expert reviews</p>
            </div>
          )}

          {isResult&&!loading&&result?.error&&(
            <div style={{paddingTop:"5rem",textAlign:"center"}}>
              <p style={{color:T.inkMid,marginBottom:"1.5rem",fontSize:"0.85rem"}}>Something went wrong. Please try again.</p>
              <GhostBtn onClick={()=>fetchResult(answers)}>Try Again</GhostBtn>
            </div>
          )}

          {/* RESULTS */}
          {isResult&&!loading&&result&&!result.error&&(
            <div style={{animation:"rise 0.4s ease"}}>

              {/* Hero — Tier 1 */}
              <div style={{paddingTop:"4.5rem",paddingBottom:"2.5rem",borderBottom:`1px solid ${T.rule}`}}>
                <p style={{fontSize:"0.67rem",letterSpacing:"0.15em",color:T.accent,margin:"0 0 1rem",fontWeight:500}}>YOUR MATCH · {result.ski.year}</p>
                <p style={{fontSize:"0.71rem",color:T.inkFaint,letterSpacing:"0.09em",margin:"0 0 0.25rem",fontWeight:400}}>{result.ski.brand.toUpperCase()}</p>
                <h2 style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"clamp(2.4rem,7vw,3.6rem)",fontWeight:500,color:T.ink,margin:0,lineHeight:1,letterSpacing:"-0.02em"}}>{result.ski.model}</h2>
                <p style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"1.1rem",color:T.inkMid,margin:"0.5rem 0 0",fontStyle:"italic"}}>{result.skiStyle.headline}</p>
                {skiImage&&(
                  <div style={{margin:"1.5rem 0 0.5rem",maxHeight:180,overflow:"hidden"}}>
                    <img src={skiImage} alt={`${result.ski.brand} ${result.ski.model}`} style={{width:"100%",maxHeight:180,objectFit:"contain"}}/>
                  </div>
                )}
                <div style={{display:"flex",gap:"1.75rem",marginTop:"1.25rem",flexWrap:"wrap"}}>
                  {[["Length",result.ski.length],["Waist",result.ski.waistWidth],["Flex",result.ski.flex]].map(([l,v])=>(
                    <div key={l}>
                      <p style={{fontSize:"0.61rem",letterSpacing:"0.1em",color:T.inkFaint,margin:"0 0 0.2rem"}}>{l}</p>
                      <p style={{fontSize:"1.05rem",color:T.ink,margin:0,fontWeight:500}}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Past experience callout */}
              {result.pastExperience?.hasNote&&result.pastExperience?.note&&(
                <div style={{padding:"1.25rem",background:T.accentFaint,borderBottom:`1px solid ${T.accentRule}`}}>
                  <p style={{fontSize:"0.67rem",letterSpacing:"0.12em",color:T.accent,margin:"0 0 0.4rem",fontWeight:500}}>BASED ON YOUR EXPERIENCE</p>
                  <p style={{fontSize:"0.82rem",color:T.inkMid,margin:0,lineHeight:1.7,fontWeight:300}}>{result.pastExperience.note}</p>
                </div>
              )}

              {/* Why this ski — Tier 1 */}
              <div style={{padding:"2.5rem 0",borderBottom:`1px solid ${T.rule}`}}>
                <SectionLabel>WHY THIS SKI</SectionLabel>
                <p style={{fontSize:"0.9rem",color:T.inkMid,lineHeight:1.75,fontWeight:300}}>{result.ski.whyPerfect}</p>
                {result.ski.awardsOrReviews&&(
                  <p style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"1.1rem",color:T.accent,margin:"1.25rem 0 0",fontStyle:"italic",lineHeight:1.6}}>{result.ski.awardsOrReviews}</p>
                )}
              </div>

              {/* Style + Profile */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",borderBottom:`1px solid ${T.rule}`}}>
                <div style={{padding:"2rem 1.5rem 2rem 0",borderRight:`1px solid ${T.rule}`}}>
                  <SectionLabel>YOUR SKI STYLE</SectionLabel>
                  <p style={body}>{result.skiStyle.summary}</p>
                  <div style={{marginTop:"1.25rem",display:"flex",flexDirection:"column",gap:"0.7rem"}}>
                    <Stat label="Ideal length" value={result.skiStyle.lengthRange}/>
                    <Stat label="Ideal width"  value={result.skiStyle.waistRange}/>
                    <Stat label="Profile"      value={result.skiStyle.profileType}/>
                  </div>
                  <p style={note}>{result.skiStyle.profileExplain}</p>
                  {result.skiStyle.flexNote&&<p style={note}>{result.skiStyle.flexNote}</p>}
                </div>
                <div style={{padding:"2rem 0 2rem 1.5rem"}}>
                  <SectionLabel>YOUR PROFILE</SectionLabel>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.7rem",marginTop:"1rem"}}>
                    <Stat label="Height"       value={STEPS[2].format(answers.height??68)}/>
                    <Stat label="Weight"       value={`${answers.weight??155} lbs`}/>
                    <Stat label="Boot (Mondo)" value={answers.bootMondo?String(answers.bootMondo):"—"}/>
                    {answers.shoeSize&&<Stat label="Shoe size" value={`US ${answers.shoeSize}`}/>}
                    <Stat label="Level"    value={LEVEL_LABELS[answers.level]||answers.level}/>
                    <Stat label="Priority" value={PRIORITY_LABELS[answers.priority]||answers.priority}/>
                  </div>
                </div>
              </div>

              {/* Construction — Tier 3 (de-emphasized) */}
              <div style={{padding:"1.5rem 0",borderBottom:`1px solid ${T.rule}`}}>
                <SectionLabel>SKI CONSTRUCTION</SectionLabel>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1.5rem",marginTop:"0.75rem"}}>
                  <div>
                    <p style={{fontSize:"0.58rem",letterSpacing:"0.1em",color:T.inkFaint,margin:"0 0 0.3rem"}}>ROCKER PROFILE</p>
                    <p style={{fontSize:"0.72rem",color:T.inkFaint,marginTop:"0.5rem",lineHeight:1.65,fontWeight:300}}>{result.ski.rockerProfile}</p>
                  </div>
                  <div>
                    <p style={{fontSize:"0.58rem",letterSpacing:"0.1em",color:T.inkFaint,margin:"0 0 0.3rem"}}>CONSTRUCTION</p>
                    <p style={{fontSize:"0.72rem",color:T.inkFaint,marginTop:"0.5rem",lineHeight:1.65,fontWeight:300}}>{result.ski.construction}</p>
                  </div>
                </div>
              </div>

              {/* Research section — Tier 3 (collapsible) */}
              {result.sources?.length>0&&(
                <details style={{padding:"1.5rem 0",borderBottom:`1px solid ${T.rule}`}}>
                  <summary style={{cursor:"pointer",fontSize:"0.61rem",letterSpacing:"0.14em",color:T.inkFaint,fontWeight:500,listStyle:"none",WebkitListStyle:"none",display:"flex",alignItems:"center",gap:"0.5rem"}}>
                    <span>RESEARCH BEHIND THIS RECOMMENDATION</span>
                    <span style={{fontSize:"0.5rem",transition:"transform 0.2s"}}>▼</span>
                  </summary>
                  <div style={{animation:"expand 0.25s ease",marginTop:"1rem"}}>
                    <p style={{fontSize:"0.75rem",color:T.inkFaint,margin:"0 0 1.25rem",lineHeight:1.65,fontWeight:300}}>
                      This recommendation draws on independent testing from multiple expert sources who collectively evaluated 175+ models at the 2025 SKI Test in Big Sky, Montana, and in year-long field reviews.
                    </p>
                    <div style={{display:"flex",flexDirection:"column"}}>
                      {result.sources.map((s,i)=>{
                        const meta=SOURCES_META[s.outlet]||{};
                        return(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"1rem",padding:"0.85rem 0",borderTop:`1px solid ${T.rule}`}}>
                            <a href={meta.url||"#"} target="_blank" rel="noopener noreferrer"
                              style={{fontSize:"0.69rem",color:T.inkMid,textDecoration:"none",border:`1px solid ${T.rule}`,borderRadius:2,padding:"0.25rem 0.6rem",fontWeight:400,letterSpacing:"0.04em",flexShrink:0,whiteSpace:"nowrap",transition:"all 0.13s"}}
                              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.ink;e.currentTarget.style.color=T.ink;}}
                              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.rule;e.currentTarget.style.color=T.inkMid;}}>
                              {s.outlet}
                            </a>
                            <p style={{fontSize:"0.78rem",color:T.inkMid,margin:0,lineHeight:1.6,fontWeight:300}}>{s.note}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:`1px solid ${T.rule}`}}>
                      <p style={{fontSize:"0.62rem",color:T.inkFaint,margin:"0 0 0.6rem",letterSpacing:"0.08em",fontWeight:500}}>ALL EXPERT SOURCES</p>
                      <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem"}}>
                        {Object.entries(SOURCES_META).map(([name,{url}])=>(
                          <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                            style={{fontSize:"0.67rem",color:T.inkFaint,border:`1px solid ${T.rule}`,borderRadius:2,padding:"0.2rem 0.55rem",textDecoration:"none",fontWeight:300,letterSpacing:"0.02em",transition:"all 0.13s"}}
                            onMouseEnter={e=>{e.currentTarget.style.color=T.inkMid;e.currentTarget.style.borderColor=T.inkFaint;}}
                            onMouseLeave={e=>{e.currentTarget.style.color=T.inkFaint;e.currentTarget.style.borderColor=T.rule;}}>
                            {name}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              )}

              {/* Where to buy — Tier 2 (elevated) */}
              <div style={{padding:"2rem",margin:"0 -1.5rem",background:T.accentFaint,borderBottom:`1px solid ${T.accentRule}`,borderTop:`1px solid ${T.accentRule}`}}>
                <SectionLabel>WHERE TO BUY</SectionLabel>
                <p style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"1.6rem",color:T.ink,fontWeight:500,margin:"0.75rem 0 0.75rem"}}>{result.ski.priceRange}</p>
                <div style={{background:T.accentFaint,border:`1px solid ${T.accentRule}`,borderRadius:2,padding:"0.7rem 1rem",marginBottom:"1.25rem"}}>
                  <p style={{fontSize:"0.76rem",color:T.accent,margin:0,lineHeight:1.6}}>{result.ski.saleTip}</p>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem"}}>
                  {result.ski.shops.map(s=>(
                    <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                      onClick={()=>track("retailer_clicked", { retailer: s.name, brand: result.ski.brand, model: result.ski.model })}
                      style={{fontSize:"0.71rem",letterSpacing:"0.07em",color:T.inkMid,textDecoration:"none",padding:"0.5rem 1rem",border:`1px solid ${T.rule}`,borderRadius:2,transition:"all 0.15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=T.ink;e.currentTarget.style.color=T.ink;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.rule;e.currentTarget.style.color=T.inkMid;}}>
                      {s.name.toUpperCase()} →
                    </a>
                  ))}
                </div>
                <p style={{fontSize:"0.67rem",color:T.inkFaint,marginTop:"0.85rem",lineHeight:1.6}}>Purchase only from trusted retailers listed above.</p>
              </div>

              {/* Alternatives */}
              {result.alternatives?.length>0&&(
                <div style={{padding:"2.5rem 0",borderBottom:`1px solid ${T.rule}`}}>
                  <SectionLabel>ALSO CONSIDER</SectionLabel>
                  <p style={{...body,margin:"0.5rem 0 1.5rem"}}>These alternatives match your profile but offer different trade-offs.</p>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.65rem"}}>
                    {result.alternatives.map((alt,i)=>(
                      <AlternativeCard key={i} alt={alt} onSelect={()=>fetchAlternativeResult(alt)}/>
                    ))}
                  </div>
                </div>
              )}

              {/* Email capture */}
              <div style={{padding:"2.5rem 0"}}>
                {emailSent?(
                  <div style={{animation:"rise 0.3s ease"}}>
                    <p style={{fontSize:"0.67rem",letterSpacing:"0.15em",color:T.accent,margin:"0 0 0.75rem",fontWeight:500}}>EMAIL SENT</p>
                    <p style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"1.4rem",color:T.inkMid,margin:"0 0 0.35rem",fontWeight:400,fontStyle:"italic"}}>Check your inbox.</p>
                    <p style={note}>Your full recommendation, specs, and retailer links are on their way.</p>
                  </div>
                ):(
                  <>
                    <SectionLabel>GET THIS IN YOUR INBOX</SectionLabel>
                    <p style={{...body,margin:"0.5rem 0 1.5rem"}}>Enter your email and we'll send your full recommendation — model, specs, price range, and where to buy.</p>
                    <div style={{display:"flex",gap:"0.6rem",flexWrap:"wrap"}}>
                      <input type="email" placeholder="your@email.com" value={email}
                        onChange={e=>{setEmail(e.target.value);setEmailError("");}}
                        onKeyDown={e=>{if(e.key==="Enter"&&email)sendEmail();}}
                        style={{flex:1,minWidth:200,fontFamily:"'DM Sans', sans-serif",background:T.surface,border:`1px solid ${emailError?T.accent:T.rule}`,borderRadius:2,padding:"0.7rem 0.9rem",fontSize:"0.83rem",color:T.ink,outline:"none",fontWeight:300,transition:"border-color 0.15s"}}
                        onFocus={e=>e.target.style.borderColor=T.accent}
                        onBlur={e=>e.target.style.borderColor=emailError?T.accent:T.rule}
                      />
                      <button onClick={sendEmail} disabled={!email||emailLoading}
                        style={{fontFamily:"'DM Sans', sans-serif",background:email&&!emailLoading?T.accent:T.rule,border:"none",borderRadius:2,padding:"0.7rem 1.5rem",color:email&&!emailLoading?"#fff":T.inkFaint,fontSize:"0.74rem",fontWeight:500,cursor:email&&!emailLoading?"pointer":"default",letterSpacing:"0.07em",whiteSpace:"nowrap",transition:"background 0.15s"}}>
                        {emailLoading?"…":"SEND TO ME"}
                      </button>
                    </div>
                    {emailError&&<p style={{fontSize:"0.73rem",color:T.accent,marginTop:"0.6rem",fontWeight:300}}>{emailError}</p>}
                    {APPS_SCRIPT_URL==="YOUR_APPS_SCRIPT_URL_HERE"&&(
                      <p style={{fontSize:"0.71rem",color:T.inkFaint,marginTop:"0.75rem",lineHeight:1.65,fontWeight:300,background:T.accentFaint,border:`1px solid ${T.accentRule}`,borderRadius:2,padding:"0.65rem 0.9rem"}}>
                        Setup required: replace <code style={{fontSize:"0.69rem",fontFamily:"monospace"}}>APPS_SCRIPT_URL</code> at the top of this file with your deployed Google Apps Script URL. See the setup guide below.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </main>

        <style>{`
          @keyframes rise  {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
          @keyframes pulse {0%,80%,100%{transform:scale(0.5);opacity:0.4}40%{transform:scale(1);opacity:1}}
          @keyframes expand{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
          *{box-sizing:border-box;margin:0;padding:0}
          input[type=range]{-webkit-appearance:none;appearance:none;height:1.5px;background:${T.rule};outline:none;display:block}
          input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:${T.accent};cursor:pointer;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.15)}
          input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:${T.accent};cursor:pointer;border:2px solid white}
          ::selection{background:${T.accentFaint}}
          ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${T.rule}}
          textarea{box-sizing:border-box}
          details summary::-webkit-details-marker{display:none}
          details summary::marker{display:none}
          details[open] summary span:last-child{transform:rotate(180deg)}
        `}</style>
      </div>
    </>
  );
}

function BootStep({gender,selectedMondo,setSelectedMondo,selectedShoe,setSelectedShoe,shoeExpanded,setShoeExpanded,bootMode,setBootMode,onConfirm}){
  const shoeSizes=gender==="female"?SIZES_W:SIZES_M;
  const derivedMondo=bootMode==="shoe"&&selectedShoe?getMondo(selectedShoe,gender||"male"):null;
  const activeMondo=bootMode==="mondo"?selectedMondo:derivedMondo;
  return(
    <div>
      <div style={{marginBottom:"1.75rem"}}>
        <p style={{fontSize:"0.67rem",letterSpacing:"0.12em",color:T.inkFaint,margin:"0 0 0.85rem",fontWeight:500}}>MONDOPOINT SIZE</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"0.4rem"}}>
          {MONDO_SIZES.map(sz=>{const sel=bootMode==="mondo"&&selectedMondo===sz;return(
            <button key={sz} onClick={()=>{setBootMode("mondo");setSelectedMondo(sz);setSelectedShoe(null);}}
              style={{padding:"0.7rem 0.15rem",border:`1px solid ${sel?T.accent:T.rule}`,background:sel?T.accent:T.surface,color:sel?"#fff":T.inkMid,fontSize:"0.8rem",fontWeight:sel?500:300,borderRadius:2,cursor:"pointer",fontFamily:"'DM Sans', sans-serif",transition:"all 0.13s"}}>
              {sz}
            </button>
          );})}
        </div>
        <p style={{fontSize:"0.7rem",color:T.inkFaint,marginTop:"0.6rem",lineHeight:1.6,fontWeight:300}}>Your Mondopoint size is printed inside the boot liner or on the shell.</p>
      </div>
      <div style={{borderTop:`1px solid ${T.rule}`,paddingTop:"1.25rem",marginBottom:shoeExpanded?"1rem":0}}>
        <button onClick={()=>{setShoeExpanded(v=>!v);if(!shoeExpanded)setBootMode("shoe");}}
          style={{background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",width:"100%"}}>
          <span style={{fontSize:"0.75rem",color:T.inkMid,fontFamily:"'DM Sans', sans-serif",fontWeight:400,letterSpacing:"0.04em"}}>I don't know my boot size. Use my shoe size instead.</span>
          <span style={{fontSize:"0.7rem",color:T.inkFaint,marginLeft:"auto",transition:"transform 0.2s",display:"inline-block",transform:shoeExpanded?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
        </button>
        {shoeExpanded&&(
          <div style={{marginTop:"1.25rem",animation:"expand 0.22s ease"}}>
            <p style={{fontSize:"0.67rem",letterSpacing:"0.12em",color:T.inkFaint,margin:"0 0 0.85rem",fontWeight:500}}>US SHOE SIZE {gender==="female"?"(WOMEN'S)":"(MEN'S)"}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"0.4rem"}}>
              {shoeSizes.map(sz=>{const sel=bootMode==="shoe"&&selectedShoe===sz;const mondo=getMondo(sz,gender||"male");return(
                <button key={sz} onClick={()=>{setBootMode("shoe");setSelectedShoe(sz);setSelectedMondo(null);}}
                  style={{padding:"0.65rem 0.15rem",border:`1px solid ${sel?T.accent:T.rule}`,background:sel?T.accent:T.surface,borderRadius:2,cursor:"pointer",fontFamily:"'DM Sans', sans-serif",transition:"all 0.13s",textAlign:"center"}}>
                  <div style={{fontSize:"0.8rem",fontWeight:sel?500:300,color:sel?"#fff":T.inkMid}}>{sz}</div>
                  {sel&&<div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.75)",marginTop:1}}>→ {mondo}</div>}
                </button>
              );})}
            </div>
            <p style={{fontSize:"0.7rem",color:T.inkFaint,marginTop:"0.6rem",lineHeight:1.6,fontWeight:300}}>We convert this to Mondopoint automatically. Confirm in-store for best fit.</p>
          </div>
        )}
      </div>
      {activeMondo&&(
        <div style={{marginTop:"2rem",animation:"rise 0.2s ease"}}>
          {bootMode==="shoe"&&derivedMondo&&<p style={{fontSize:"0.75rem",color:T.inkMid,margin:"0 0 1rem",fontWeight:300,fontStyle:"italic"}}>Shoe size US {selectedShoe} → approx. Mondo {derivedMondo}</p>}
          <GhostBtn onClick={onConfirm}>Continue</GhostBtn>
        </div>
      )}
    </div>
  );
}

function OptionRow({opt,selected,onSelect,index}){
  const [hov,setHov]=useState(false);
  return(
    <button onClick={onSelect} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:selected?T.accent:T.surface,border:`1px solid ${selected?T.accent:hov?T.inkFaint:T.rule}`,borderRadius:2,padding:"1.05rem 1.25rem",cursor:"pointer",textAlign:"left",transition:"all 0.15s",width:"100%",animation:`rise 0.3s ${index*0.045}s both`}}>
      <div>
        <div style={{fontSize:"0.88rem",fontWeight:500,color:selected?"#fff":T.ink,letterSpacing:"0.01em",marginBottom:opt.desc?"0.15rem":0}}>{opt.label}</div>
        {opt.desc&&<div style={{fontSize:"0.74rem",color:selected?"rgba(255,255,255,0.72)":T.inkFaint,fontWeight:300,lineHeight:1.5}}>{opt.desc}</div>}
      </div>
      <div style={{width:17,height:17,borderRadius:"50%",border:`1.5px solid ${selected?"rgba(255,255,255,0.5)":T.rule}`,background:selected?"rgba(255,255,255,0.2)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
        {selected&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}
      </div>
    </button>
  );
}

function GhostBtn({onClick,children,filled}){
  const [hov,setHov]=useState(false);
  const active=filled||hov;
  return(
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{fontFamily:"'DM Sans', sans-serif",background:active?T.ink:"transparent",border:`1px solid ${T.ink}`,borderRadius:2,padding:"0.8rem 2.25rem",color:active?"#fff":T.ink,fontSize:"0.78rem",fontWeight:500,letterSpacing:"0.08em",cursor:"pointer",transition:"all 0.2s",display:"inline-block"}}>
      {children}
    </button>
  );
}

function SectionLabel({children}){
  return <p style={{fontSize:"0.61rem",letterSpacing:"0.14em",color:T.inkFaint,margin:"0 0 0.75rem",fontWeight:500}}>{children}</p>;
}

function Stat({label,value}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"0.5rem",borderBottom:`1px solid ${T.rule}`,paddingBottom:"0.45rem"}}>
      <span style={{fontSize:"0.69rem",color:T.inkFaint,letterSpacing:"0.05em",flexShrink:0,fontWeight:300}}>{label}</span>
      <span style={{fontSize:"0.82rem",color:T.ink,fontWeight:400,textAlign:"right"}}>{value}</span>
    </div>
  );
}

function AlternativeCard({alt,onSelect}){
  const [hov,setHov]=useState(false);
  return(
    <button onClick={onSelect} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.surface,border:`1px solid ${hov?T.inkFaint:T.rule}`,borderRadius:2,padding:"1.1rem 1.25rem",cursor:"pointer",textAlign:"left",transition:"all 0.15s",width:"100%",fontFamily:"'DM Sans', sans-serif"}}>
      <div style={{flex:1}}>
        <p style={{fontSize:"0.72rem",color:T.accent,margin:"0 0 0.25rem",fontWeight:500,fontStyle:"italic"}}>{alt.pitch}</p>
        <p style={{fontSize:"0.92rem",fontWeight:500,color:T.ink,margin:"0 0 0.2rem"}}>{alt.brand} {alt.model}</p>
        <p style={{fontSize:"0.76rem",color:T.inkFaint,margin:0,fontWeight:300,lineHeight:1.6}}>{alt.oneLiner}</p>
        <div style={{display:"flex",gap:"1.25rem",marginTop:"0.6rem",flexWrap:"wrap"}}>
          {[["Length",alt.length],["Waist",alt.waistWidth],["Flex",alt.flex]].map(([l,v])=>(
            <div key={l}>
              <p style={{fontSize:"0.55rem",letterSpacing:"0.08em",color:T.inkFaint,margin:0}}>{l}</p>
              <p style={{fontSize:"0.78rem",color:T.ink,margin:0,fontWeight:400}}>{v}</p>
            </div>
          ))}
        </div>
      </div>
      <span style={{fontSize:"0.8rem",color:hov?T.ink:T.inkFaint,flexShrink:0,marginLeft:"1rem",transition:"color 0.15s"}}>VIEW →</span>
    </button>
  );
}

const body={fontSize:"0.84rem",color:T.inkMid,lineHeight:1.75,fontWeight:300};
const note={fontSize:"0.75rem",color:T.inkFaint,marginTop:"0.75rem",lineHeight:1.65,fontWeight:300};

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cleared, setCleared] = useState(false);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const list = await window.storage.list("evt:", true);
      const keys = list?.keys || [];
      const items = await Promise.all(
        keys.map(async k => {
          try { const r = await window.storage.get(k, true); return r ? JSON.parse(r.value) : null; }
          catch { return null; }
        })
      );
      setEvents(items.filter(Boolean).sort((a,b) => b.ts - a.ts));
    } catch { setEvents([]); }
    setLoading(false);
  };

  const clearAll = async () => {
    try {
      const list = await window.storage.list("evt:", true);
      await Promise.all((list?.keys||[]).map(k => window.storage.delete(k, true)));
      setEvents([]); setCleared(true);
    } catch {}
  };

  // Derived stats
  const count = (evt) => events.filter(e => e.event === evt).length;
  const begins = count("begin_clicked");
  const completions = count("wizard_completed");
  const recommendations = count("recommendation_shown");
  const emailSubmits = count("email_submitted");
  const restarts = count("restarted");
  const convRate = begins > 0 ? Math.round((completions/begins)*100) : 0;
  const emailRate  = recommendations > 0 ? Math.round((emailSubmits/recommendations)*100) : 0;

  // Funnel by step answers
  const stepAnswers = events.filter(e => e.event === "step_answer");
  const byStep = {};
  stepAnswers.forEach(e => {
    const s = e.payload?.step;
    if (!s) return;
    if (!byStep[s]) byStep[s] = {};
    const v = String(e.payload?.value ?? e.payload?.mondoVal ?? "—");
    byStep[s][v] = (byStep[s][v] || 0) + 1;
  });

  // Experience skip rate
  const expEvents = stepAnswers.filter(e => e.payload?.step === "experience");
  const expSkipped = expEvents.filter(e => e.payload?.skipped).length;
  const expFilled  = expEvents.filter(e => !e.payload?.skipped).length;

  // Top recommended skis
  const recCounts = {};
  events.filter(e => e.event === "recommendation_shown").forEach(e => {
    const key = `${e.payload?.brand} ${e.payload?.model}`;
    recCounts[key] = (recCounts[key] || 0) + 1;
  });
  const topSkis = Object.entries(recCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Retailer clicks
  const retailerCounts = {};
  events.filter(e => e.event === "retailer_clicked").forEach(e => {
    const r = e.payload?.retailer || "unknown";
    retailerCounts[r] = (retailerCounts[r] || 0) + 1;
  });
  const topRetailers = Object.entries(retailerCounts).sort((a,b)=>b[1]-a[1]);

  const fmtTime = ts => new Date(ts).toLocaleString();

  const card = (label, value, sub) => (
    <div style={{background:"#fff",border:`1px solid ${T.rule}`,borderRadius:3,padding:"1.25rem 1.5rem",flex:1,minWidth:140}}>
      <p style={{fontSize:"0.62rem",letterSpacing:"0.12em",color:T.inkFaint,margin:"0 0 0.4rem",fontWeight:500}}>{label}</p>
      <p style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"2.2rem",color:T.ink,margin:0,fontWeight:500,lineHeight:1}}>{value}</p>
      {sub&&<p style={{fontSize:"0.68rem",color:T.inkFaint,margin:"0.3rem 0 0",fontWeight:300}}>{sub}</p>}
    </div>
  );

  return (
    <>
      <link rel="stylesheet" href={FONT_LINK}/>
      <div style={{background:T.bg,minHeight:"100vh",fontFamily:"'DM Sans', sans-serif",padding:"2.5rem 1.5rem 5rem"}}>
        <div style={{maxWidth:860,margin:"0 auto"}}>

          <div style={{marginBottom:"2.5rem",borderBottom:`1px solid ${T.rule}`,paddingBottom:"1.5rem",display:"flex",alignItems:"baseline",justifyContent:"space-between",flexWrap:"wrap",gap:"1rem"}}>
            <div>
              <p style={{fontSize:"0.65rem",letterSpacing:"0.15em",color:T.accent,margin:"0 0 0.4rem",fontWeight:500}}>FINDMYSKI</p>
              <h2 style={{fontFamily:"'Cormorant Garamond', serif",fontSize:"2.2rem",fontWeight:500,color:T.ink,margin:0,letterSpacing:"-0.01em"}}>Analytics Dashboard</h2>
              <p style={{fontSize:"0.75rem",color:T.inkFaint,margin:"0.3rem 0 0",fontWeight:300}}>{events.length} events total · last updated {new Date().toLocaleTimeString()}</p>
            </div>
            <div style={{display:"flex",gap:"0.6rem"}}>
              <button onClick={loadEvents} style={{fontFamily:"'DM Sans', sans-serif",background:"transparent",border:`1px solid ${T.rule}`,borderRadius:2,padding:"0.55rem 1.1rem",fontSize:"0.72rem",letterSpacing:"0.06em",cursor:"pointer",color:T.inkMid}}>REFRESH</button>
              <button onClick={clearAll} style={{fontFamily:"'DM Sans', sans-serif",background:"transparent",border:`1px solid ${T.rule}`,borderRadius:2,padding:"0.55rem 1.1rem",fontSize:"0.72rem",letterSpacing:"0.06em",cursor:"pointer",color:T.inkFaint}}>CLEAR ALL</button>
            </div>
          </div>

          {loading ? (
            <p style={{color:T.inkFaint,fontSize:"0.85rem"}}>Loading…</p>
          ) : (
            <>
              {/* Funnel KPIs */}
              <p style={{fontSize:"0.62rem",letterSpacing:"0.12em",color:T.inkFaint,margin:"0 0 0.85rem",fontWeight:500}}>FUNNEL</p>
              <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap",marginBottom:"2.5rem"}}>
                {card("BEGINS", begins)}
                {card("COMPLETIONS", completions, `${convRate}% of begins`)}
                {card("RECOMMENDATIONS", recommendations)}
                {card("SMS SENT", smsSends, `${emailRate}% of results`)}
                {card("RESTARTS", restarts)}
              </div>

              {/* Top recommended skis */}
              <div style={{marginBottom:"2.5rem"}}>
                <p style={{fontSize:"0.62rem",letterSpacing:"0.12em",color:T.inkFaint,margin:"0 0 0.85rem",fontWeight:500}}>TOP RECOMMENDED SKIS</p>
                <div style={{background:"#fff",border:`1px solid ${T.rule}`,borderRadius:3,overflow:"hidden"}}>
                  {topSkis.length === 0 ? (
                    <p style={{padding:"1.5rem",color:T.inkFaint,fontSize:"0.8rem",fontWeight:300}}>No data yet.</p>
                  ) : topSkis.map(([ski, n], i) => (
                    <div key={ski} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.8rem 1.25rem",borderBottom:i<topSkis.length-1?`1px solid ${T.rule}`:"none"}}>
                      <span style={{fontSize:"0.84rem",color:T.ink,fontWeight:400}}>{ski}</span>
                      <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
                        <div style={{width:80,height:4,background:T.rule,borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:"100%",background:T.accent,width:`${Math.round((n/recommendations)*100)}%`}}/>
                        </div>
                        <span style={{fontSize:"0.78rem",color:T.inkMid,minWidth:20,textAlign:"right"}}>{n}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step answer distributions */}
              <div style={{marginBottom:"2.5rem"}}>
                <p style={{fontSize:"0.62rem",letterSpacing:"0.12em",color:T.inkFaint,margin:"0 0 0.85rem",fontWeight:500}}>STEP ANSWER BREAKDOWN</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"0.75rem"}}>
                  {Object.entries(byStep).map(([step, vals]) => {
                    const total = Object.values(vals).reduce((a,b)=>a+b,0);
                    const sorted = Object.entries(vals).sort((a,b)=>b[1]-a[1]);
                    return (
                      <div key={step} style={{background:"#fff",border:`1px solid ${T.rule}`,borderRadius:3,padding:"1rem 1.25rem"}}>
                        <p style={{fontSize:"0.62rem",letterSpacing:"0.1em",color:T.accent,margin:"0 0 0.75rem",fontWeight:500}}>{step.toUpperCase()}</p>
                        {sorted.map(([val, n]) => (
                          <div key={val} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.4rem"}}>
                            <span style={{fontSize:"0.75rem",color:T.inkMid,fontWeight:300,maxWidth:"65%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</span>
                            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                              <div style={{width:50,height:3,background:T.rule,borderRadius:99,overflow:"hidden"}}>
                                <div style={{height:"100%",background:T.accent,opacity:0.7,width:`${Math.round((n/total)*100)}%`}}/>
                              </div>
                              <span style={{fontSize:"0.72rem",color:T.inkFaint,minWidth:16,textAlign:"right"}}>{Math.round((n/total)*100)}%</span>
                            </div>
                          </div>
                        ))}
                        <p style={{fontSize:"0.65rem",color:T.inkFaint,margin:"0.5rem 0 0",fontWeight:300}}>{total} responses</p>
                      </div>
                    );
                  })}

                  {/* Experience step detail */}
                  {(expFilled+expSkipped > 0) && (
                    <div style={{background:"#fff",border:`1px solid ${T.rule}`,borderRadius:3,padding:"1rem 1.25rem"}}>
                      <p style={{fontSize:"0.62rem",letterSpacing:"0.1em",color:T.accent,margin:"0 0 0.75rem",fontWeight:500}}>EXPERIENCE (DETAIL)</p>
                      {[["Filled in", expFilled],["Skipped", expSkipped]].map(([l,n])=>(
                        <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.4rem"}}>
                          <span style={{fontSize:"0.75rem",color:T.inkMid,fontWeight:300}}>{l}</span>
                          <span style={{fontSize:"0.78rem",color:T.ink,fontWeight:400}}>{n} ({Math.round((n/(expFilled+expSkipped))*100)}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Retailer clicks */}
              {topRetailers.length > 0 && (
                <div style={{marginBottom:"2.5rem"}}>
                  <p style={{fontSize:"0.62rem",letterSpacing:"0.12em",color:T.inkFaint,margin:"0 0 0.85rem",fontWeight:500}}>RETAILER CLICKS</p>
                  <div style={{background:"#fff",border:`1px solid ${T.rule}`,borderRadius:3,overflow:"hidden"}}>
                    {topRetailers.map(([r,n],i)=>(
                      <div key={r} style={{display:"flex",justifyContent:"space-between",padding:"0.75rem 1.25rem",borderBottom:i<topRetailers.length-1?`1px solid ${T.rule}`:"none"}}>
                        <span style={{fontSize:"0.82rem",color:T.ink}}>{r}</span>
                        <span style={{fontSize:"0.82rem",color:T.inkMid,fontWeight:300}}>{n} clicks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent event log */}
              <div>
                <p style={{fontSize:"0.62rem",letterSpacing:"0.12em",color:T.inkFaint,margin:"0 0 0.85rem",fontWeight:500}}>RECENT EVENTS</p>
                <div style={{background:"#fff",border:`1px solid ${T.rule}`,borderRadius:3,overflow:"hidden"}}>
                  {events.length === 0 ? (
                    <p style={{padding:"1.5rem",color:T.inkFaint,fontSize:"0.8rem",fontWeight:300}}>No events yet. Use the app first.</p>
                  ) : events.slice(0,40).map((e,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"0.65rem 1.25rem",borderBottom:i<Math.min(39,events.length-1)?`1px solid ${T.rule}`:"none",gap:"1rem"}}>
                      <div>
                        <span style={{fontSize:"0.75rem",color:T.ink,fontWeight:400}}>{e.event}</span>
                        <span style={{fontSize:"0.7rem",color:T.inkFaint,marginLeft:"0.6rem",fontWeight:300}}>
                          {Object.entries(e.payload||{}).slice(0,3).map(([k,v])=>`${k}: ${v}`).join(" · ")}
                        </span>
                      </div>
                      <span style={{fontSize:"0.65rem",color:T.inkFaint,flexShrink:0,fontWeight:300}}>{fmtTime(e.ts)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

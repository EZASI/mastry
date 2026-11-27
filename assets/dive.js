/* MASTRY — The Dive (v3)
   One split-level shot. The bottle stays in frame from the first screen to the last; scrolling raises the sea over it,
   follows it down to the still water where the resin tear meets the spring, and lifts it back into the light.
   One fragment shader draws the sea, the sky and the water; the bottle is the brand's own render, cut out and
   re-lit so the glass lets whatever is behind it through. Its condensation is drawn here too. No libraries. */
(function(){
'use strict';
var doc=document, root=doc.documentElement, win=window;
var reduce=win.matchMedia('(prefers-reduced-motion: reduce)').matches;
var coarse=win.matchMedia('(pointer: coarse)').matches;
function $(id){return doc.getElementById(id);}
function cl(x){return x<0?0:(x>1?1:x);}
function seg(p,a,b){return cl((p-a)/(b-a));}
function ss(x){return x*x*(3-2*x);}
function lerp(a,b,t){return a+(b-a)*t;}
function bell(x){return Math.sin(Math.PI*cl(x));}

/* ---------- language: same rule and storage key as the main site ---------- */
var lang=null;
var qs=/[?&]lang=(en|jp|ja)\b/.exec(location.search);
if(qs){lang=qs[1]==='en'?'en':'jp';}
if(!lang){try{var sv=localStorage.getItem('mastry-lang-v2');if(sv==='en'||sv==='jp')lang=sv;}catch(e){}}
if(!lang){
  var tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){}
  var nv=(navigator.language||'').toLowerCase();
  lang=(tz==='Asia/Tokyo'||nv.slice(0,2)==='ja'||/bot|crawl|spider|slurp|lighthouse|preview/i.test(navigator.userAgent))?'jp':'en';
}
var EN=lang==='en';
if(EN){
  root.lang='en';
  var tr=doc.querySelectorAll('[data-en]');
  for(var ti=0;ti<tr.length;ti++){tr[ti].innerHTML=tr[ti].getAttribute('data-en');}
  var al=doc.querySelectorAll('[data-en-label]');
  for(var ai=0;ai<al.length;ai++){al[ai].setAttribute('aria-label',al[ai].getAttribute('data-en-label'));}
}
var STATIONS=EN
  ?['Surface','Descent','Chios, 38.25°N','Spring water of Japan','Stillness','Ascent']
  :['水面','潜降','ヒオス島 北緯38.25°','日本の湧水','静けさ','浮上'];
var TEMP_LABEL=EN?['Water','Serve at']:['水温','飲みごろ'];

/* ---------- elements ---------- */
var canvas=$('gl');
var elBar=$('bar'), elBrand=$('brand'), elGauge=$('gauge'), elNum=$('depthNum'), elSt=$('station'), elTemp=$('tempNum'), elCue=$('cue'), elProg=$('prog');
var elTempLabel=elTemp&&elTemp.parentNode?elTemp.parentNode.firstElementChild:null;
var elEdgeT=$('edgeT'), elEdgeB=$('edgeB');
var elTop=doc.querySelector('.hero .top'), elEndIn=doc.querySelector('.end .in');
var metaTheme=doc.querySelector('meta[name="theme-color"]');
var beats=[
  {el:$('bHero'),a:-1,   b:0.060,f:0.030},
  {el:$('b1'),   a:0.150,b:0.270,f:0.030},
  {el:$('b2'),   a:0.325,b:0.470,f:0.030},
  {el:$('b3'),   a:0.520,b:0.640,f:0.030},
  {el:$('b4'),   a:0.695,b:0.840,f:0.030},
  {el:$('bEnd'), a:0.953,b:2,    f:0.032}
];

/* ---------- the bottle texture (see ~/mastry-site-review/dive-v3/build/make_bottle.py) ---------- */
var B_ASP=0.2878;                 /* bottle width / height */
var WATER_AT=0.165;               /* at the surface the sea stands this far up the bottle */

/* ---------- layout-dependent numbers (screen units: height = 1, centre = 0, y up) ---------- */
var L={};
function layout(){
  var w=canvas.clientWidth||win.innerWidth, h=canvas.clientHeight||win.innerHeight;
  var asp=w/Math.max(h,1), portrait=asp<0.85;
  L.w=w;L.h=h;L.asp=asp;L.portrait=portrait;
  L.band=0.045;
  /* at the surface, first screen */
  L.lineHero=portrait?-0.195:-0.235;
  L.heroH=portrait?Math.min(0.54,1.72*asp):0.76;
  /* on phones the copy sits above the bottle: however tall it runs, the cap stays clear of it */
  if(portrait&&elTop&&elTop.offsetHeight){
    var tb=(elTop.offsetTop+elTop.offsetHeight)/h;
    L.heroH=Math.max(0.30,Math.min(L.heroH,(0.5-L.lineHero-tb-0.024)/(1-WATER_AT)));
  }
  L.heroX=0;
  L.heroBase=L.lineHero-WATER_AT*L.heroH;
  /* under water */
  L.chH=portrait?Math.min(0.50,1.6*asp):0.66;
  L.chX=portrait?-0.072*Math.min(1,asp/0.46):(asp<1.25?-0.12:-0.16);
  L.chBase=portrait?(EN?-0.13:-0.27):-0.36;
  /* back at the surface, last screen */
  L.lineEnd=portrait?-0.30:-0.25;
  L.endH=portrait?Math.min(0.46,1.5*asp):0.70;
  if(portrait&&elEndIn&&elEndIn.offsetHeight){
    var eb=(elEndIn.offsetTop+elEndIn.offsetHeight)/h;
    L.endH=Math.max(0.28,Math.min(L.endH,(0.5-L.lineEnd-eb-0.024)/(1-WATER_AT)));
  }
  L.endX=0;
  L.endBase=L.lineEnd-WATER_AT*L.endH;
  L.span=Math.min(0.87*asp,1.30);
  L.wmAt=0.795;
  /* the two origins seen in the water, and the tear that leaves the first of them */
  L.visH=portrait?0.37:0.43;
  L.visX=portrait?0.092:L.chX+0.20;
  L.visY=portrait?-0.075:0.01;
  L.inX=L.chX+0.012;
  L.inY=L.chBase+0.305*L.chH;
  L.glyS=portrait?Math.min(0.46,0.97*asp):0.74;
  L.glyX=portrait?0.012:L.chX-0.215;
  L.glyY=portrait?0.0:-0.01;
  /* where the bottle stands under water, for the figures set beside it */
  var st=root.style;
  st.setProperty('--bx',(w/2+L.chX*h).toFixed(1)+'px');
  st.setProperty('--bw',(L.chH*B_ASP*1.075*h).toFixed(1)+'px');
  st.setProperty('--bh',(L.chH*h).toFixed(1)+'px');
  st.setProperty('--by',((0.5-(L.chBase+L.chH))*h).toFixed(1)+'px');
  st.setProperty('--wl',((0.5-L.lineHero)*h).toFixed(1)+'px');
}

/* ---------- the timeline: everything on screen is a function of scroll progress P ---------- */
var K_METERS=[[0,0],[0.07,0],[0.20,60],[0.33,700],[0.45,1200],[0.56,1900],[0.70,2600],[0.78,3000],[0.845,3000],[0.91,0],[1,0]];
var K_DEPTH =[[0,0],[0.07,0],[0.20,0.20],[0.36,0.46],[0.52,0.68],[0.68,0.92],[0.76,1],[0.845,1],[0.875,0.30],[0.895,0.06],[0.91,0],[1,0]];
var K_CEIL  =[[0,0.2],[0.085,0.2],[0.165,0.9],[0.25,4.5],[0.33,30],[0.845,30],[0.875,6],[0.895,1.2],[0.92,0.3],[1,0.3]];
function key(K,p){
  for(var i=1;i<K.length;i++){
    if(p<=K[i][0]){var a=K[i-1],b=K[i];return a[1]+(b[1]-a[1])*((p-a[0])/Math.max(b[0]-a[0],1e-5));}
  }
  return K[K.length-1][1];
}
function compute(P){
  var S={P:P};
  var plunge=ss(seg(P,0.06,0.185)), rise=ss(seg(P,0.89,0.955));
  S.line=P<0.5?lerp(L.lineHero,0.80,plunge):lerp(0.80,L.lineEnd,rise);
  S.hor=S.line+L.band;
  S.day=seg(P,0.5,0.88);
  S.depth=key(K_DEPTH,P);
  S.meters=key(K_METERS,P);
  S.ceil=key(K_CEIL,P);
  S.temp=24-17*ss(seg(P,0.08,0.70))+17*ss(seg(P,0.85,0.91));
  S.travel=S.depth*7.5;
  S.bub=ss(seg(P,0.07,0.12))*(1-seg(P,0.20,0.31));
  S.rush=ss(seg(P,0.845,0.87))*(1-seg(P,0.90,0.93));
  S.spring=ss(seg(P,0.50,0.585))*(1-seg(P,0.845,0.875));
  S.surf=P<0.5?1-ss(seg(P,0.06,0.16)):ss(seg(P,0.90,0.955));
  S.still=ss(seg(P,0.64,0.70))*(1-ss(seg(P,0.845,0.87)));
  /* the bottle: at the surface → hanging in the water → at the surface again */
  var toCh=ss(seg(P,0.085,0.215)), toEnd=ss(seg(P,0.875,0.955));
  var bx=lerp(lerp(L.heroX,L.chX,toCh),L.endX,toEnd);
  var bh=lerp(lerp(L.heroH,L.chH,toCh),L.endH,toEnd);
  var by=lerp(lerp(L.heroBase,L.chBase,toCh),L.endBase,toEnd);
  var tilt=-0.085*bell(seg(P,0.07,0.21))+0.05*bell(seg(P,0.85,0.93));
  S.bot=[bx,by,bh,tilt];
  S.glow=ss(seg(P,0.548,0.64))*(1-ss(seg(P,0.86,0.90)));
  var fz=lerp(0.55,0.12,ss(seg(P,0.07,0.20)));
  fz=lerp(fz,1,ss(seg(P,0.56,0.66)));
  S.fizz=lerp(fz,0.7,ss(seg(P,0.90,0.95)));
  S.dew=P<0.5?1:ss(seg(P,0.93,0.99));
  /* the wordmark stands in the air behind the bottle's shoulder, first screen and last */
  S.wm=P<0.5
    ?[0,L.heroBase+L.wmAt*L.heroH,L.span,1-ss(seg(P,0.105,0.20))]
    :[0,L.endBase+L.wmAt*L.endH,L.span*(L.portrait?1:0.92),ss(seg(P,0.895,0.95))];
  /* what the water remembers: the bark on Chios, then the stream in Japan */
  var va=ss(seg(P,0.295,0.345))*(1-ss(seg(P,0.435,0.50)));
  var vb=ss(seg(P,0.505,0.56))*(1-ss(seg(P,0.625,0.68)));
  S.visA=[L.visX-0.012*seg(P,0.29,0.50),L.visY+0.03*seg(P,0.29,0.50),L.visH*(1+0.05*seg(P,0.29,0.50)),va];
  S.visB=[L.visX+0.012*seg(P,0.50,0.68),L.visY+0.02*seg(P,0.50,0.68),L.visH*(1+0.05*seg(P,0.50,0.68)),vb*0.85];
  /* the tear: leaves the bark, falls beside the bottle, and goes in through the glass */
  var fall=ss(seg(P,0.43,0.545)), inn=seg(P,0.545,0.578);
  var tx=lerp(S.visA[0]-0.14*S.visA[2]*0.75,L.inX,fall*fall);
  var ty=lerp(S.visA[1]-0.005*S.visA[2],L.inY,fall);
  var trad=lerp(lerp(0.175*S.visA[2],0.030,ss(seg(P,0.43,0.52))),0.011,inn);
  S.tear=[tx,ty,trad,ss(seg(P,0.385,0.415))*(1-ss(inn))];
  S.ring=[L.inX,L.inY,seg(P,0.545,0.665)*1.15,ss(seg(P,0.545,0.556))*(1-ss(seg(P,0.60,0.665)))];
  /* 静, very large and very faint, behind the bottle */
  S.gly=[L.glyX,L.glyY,L.glyS,ss(seg(P,0.672,0.725))*(1-ss(seg(P,0.83,0.862)))*0.092];
  return S;
}

/* ---------- page furniture driven by the same timeline ---------- */
var lastTone='', lastSt='', lastNum=-1, lastTemp='', lastTL=-1, lastTop='', lastBot='', lastBg='', lastProg='', lastMeta='', lastMetaT=0, sent={};
function mix3(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function rgb(c){return 'rgb('+Math.round(cl(c[0])*255)+','+Math.round(cl(c[1])*255)+','+Math.round(cl(c[2])*255)+')';}
/* The colour of the scene at its top and bottom edge (same maths as the shader, at one point each).
   Mobile browsers tint their own bars from these, so the phone's chrome sinks and surfaces with the page. */
function waterEdge(S,top){
  var a=ss(seg(S.depth,0,0.45)),b=ss(seg(S.depth,0.38,1));
  var c=top?mix3(mix3([0.165,0.490,0.900],[0.030,0.160,0.430],a),[0.006,0.022,0.066],b)
           :mix3(mix3([0.022,0.170,0.470],[0.008,0.046,0.165],a),[0.002,0.006,0.022],b);
  if(S.spring>0)c=mix3(c,[c[0]*0.55,c[1]*1.35+0.010,c[2]*1.25+0.014],S.spring);
  return c;
}
function edgeColours(S){
  var top,bot;
  if(S.line<0.5){
    var k=1-Math.exp(-(0.5-S.hor)*2.6);
    top=mix3(mix3([0.940,0.958,0.985],[0.972,0.974,0.972],S.day),mix3([0.585,0.745,0.945],[0.655,0.800,0.965],S.day),k);
  }else{
    var lt=Math.exp(-S.depth*4.6)*0.49;
    top=waterEdge(S,true);
    top=[(top[0]*0.965+0.30*lt)*0.86,(top[1]*0.965+0.55*lt)*0.86,(top[2]*0.965+0.90*lt)*0.86];
  }
  bot=waterEdge(S,false);bot=[bot[0]*0.83,bot[1]*0.83,bot[2]*0.83];
  return [top,bot];
}
function track(name,params){try{if(typeof win.gtag==='function')win.gtag('event',name,params);}catch(e){}}
function dom(S){
  var P=S.P,i;
  for(i=0;i<beats.length;i++){
    var bt=beats[i]; if(!bt.el)continue;
    var o=cl(Math.min(P-bt.a,bt.b-P)/bt.f);
    if(bt.o===undefined||Math.abs(o-bt.o)>0.003||(o===0&&bt.o!==0)||(o===1&&bt.o!==1)){
      bt.o=o;
      bt.el.style.opacity=o;
      var dir=(P-bt.a)<(bt.b-P)?1:-1;
      bt.el.style.transform=o<1?'translate3d(0,'+((1-o)*16*dir).toFixed(2)+'px,0)':'none';
      bt.el.classList.toggle('on',o>0.01);
    }
  }
  var tone=S.line>0.42?'dark':'light';
  if(tone!==lastTone){lastTone=tone;root.setAttribute('data-tone',tone);}
  var mid=P>0.125&&P<0.925;
  if(elBrand)elBrand.classList.toggle('on',mid);
  if(elBar){elBar.classList.toggle('mid',mid);elBar.classList.toggle('end',P>0.945);}
  if(elCue)elCue.classList.toggle('on',P<0.028);
  var pr=P.toFixed(4);
  if(pr!==lastProg){lastProg=pr;if(elProg)elProg.style.transform='scaleY('+pr+')';
    if(!gl||lost){
      /* without the drawn scene, a plain cut-out of the bottle takes the same path */
      var rs=root.style;rs.setProperty('--p',pr);
      rs.setProperty('--fx',(L.w/2+S.bot[0]*L.h).toFixed(1)+'px');
      rs.setProperty('--fy',((0.5-(S.bot[1]+S.bot[2]))*L.h).toFixed(1)+'px');
      rs.setProperty('--fh',(S.bot[2]*L.h).toFixed(1)+'px');
    }
  }
  var gOn=P>0.085&&P<0.945;
  if(elGauge){
    elGauge.classList.toggle('on',gOn);
    if(gOn){
      var m=Math.round(S.meters/10)*10;
      if(m!==lastNum){lastNum=m;elNum.textContent=m>=1000?String(m).replace(/(\d)(\d{3})$/,'$1,$2'):String(m);}
      var st=P<0.10?0:(P<0.31?1:(P<0.50?2:(P<0.665?3:(P<0.845?4:5))));
      if(STATIONS[st]!==lastSt){lastSt=STATIONS[st];elSt.textContent=lastSt;}
      var tv=S.temp.toFixed(1);
      if(tv!==lastTemp){lastTemp=tv;if(elTemp)elTemp.textContent=tv;}
      var tl=(S.temp<=8.05&&st===4)?1:0;
      if(tl!==lastTL){lastTL=tl;if(elTempLabel)elTempLabel.textContent=TEMP_LABEL[tl];}
    }
  }
  var ec=edgeColours(S),ct=rgb(ec[0]),cb=rgb(ec[1]);
  if(ct!==lastTop){lastTop=ct;if(elEdgeT)elEdgeT.style.backgroundColor=ct;}
  if(cb!==lastBot){lastBot=cb;if(elEdgeB)elEdgeB.style.backgroundColor=cb;}
  var bg=P<0.5?ct:cb;
  if(bg!==lastBg){lastBg=bg;root.style.backgroundColor=bg;}
  /* older Safari and Android Chrome read theme-color instead; a few updates a second is plenty */
  var nowT=Date.now();
  if(metaTheme&&ct!==lastMeta&&nowT-lastMetaT>150){lastMeta=ct;lastMetaT=nowT;metaTheme.setAttribute('content',ct);}
  /* how far people dive (no personal data) */
  var q=P>=0.985?100:(P>=0.75?75:(P>=0.5?50:(P>=0.25?25:0)));
  if(q&&!sent[q]){sent[q]=1;track('dive_depth',{percent:q});}
}
(function clicks(){
  var j=$('join'),e=$('endBtn');
  if(j)j.addEventListener('click',function(){track('dive_cta',{place:'bar'});});
  if(e)e.addEventListener('click',function(){track('dive_cta',{place:'end'});});
})();

/* ---------- shaders ---------- */
var VS_BG='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
var FS_BG=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime,uLine,uBand,uCamH,uDay,uDepth,uCeil,uTravel,uSlosh,uBub,uRush,uSpring,uQ,uHorU;
uniform vec4 uBot,uBotF,uWm,uWmUV,uGly,uVA,uVB,uTear,uRing;
uniform vec3 uMouse;
uniform sampler2D uTN,uTM,uTT,uTA,uTB;
const vec3 WARM=vec3(1.,.90,.72);
const vec3 INK=vec3(.043,.180,.640);
const float B_ASP=.2878;
const vec4 B_UV=vec4(.498047,.104004,.792969,3.175781);

float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1.,0.)),f.x),mix(hash12(i+vec2(0.,1.)),hash12(i+vec2(1.,1.)),f.x),f.y);}
float wave(float x,float t,float amp){
  return uLine+(sin(x*5.3+t*1.15)*.005+sin(x*11.7-t*1.9)*.0025+(noise(vec2(x*2.6+t*.3,t*.55))-.5)*.016)*amp;
}

/* ---- type: the wordmark and one character, kept in a single texture ---- */
float wmAt(vec2 q){
  float wa=(uWmUV.w-uWmUV.y)/max(uWmUV.z-uWmUV.x,.001)*.5;
  vec2 uv=(q-uWm.xy)/vec2(uWm.z,uWm.z*wa)+.5;
  vec2 in2=step(vec2(0.),uv)*step(uv,vec2(1.));
  return texture2D(uTT,mix(uWmUV.xy,uWmUV.zw,clamp(uv,0.,1.))).r*in2.x*in2.y;
}
float glyAt(vec2 q){
  vec2 uv=(q-uGly.xy)/uGly.z+.5;
  vec2 in2=step(vec2(0.),uv)*step(uv,vec2(1.));
  uv=clamp(uv,0.,1.);
  return texture2D(uTT,vec2(uv.x*.25,uv.y*.5)).r*in2.x*in2.y;
}

/* ---- above the water ---- */
vec3 skyAt(float h){
  h=max(h,0.);
  vec3 hor=mix(vec3(.940,.958,.985),vec3(.972,.974,.972),uDay);
  vec3 zen=mix(vec3(.585,.745,.945),vec3(.655,.800,.965),uDay);
  return mix(hor,zen,1.-exp(-h*2.6));
}
vec3 sunGlow(vec2 d){return vec3(1.,.965,.90)*exp(-dot(d,d)*4.2);}
float seaH(vec2 w,float t){
  float h=noise(w*.85+vec2(t*.22,t*.34))*.62;
  h+=noise(w*2.1+vec2(-t*.30,t*.52))*.27;
  if(uQ>.5)h+=noise(w*4.9+vec2(t*.42,-t*.18))*.11;
  return h;
}
vec3 aboveView(vec2 p,float asp,float t){
  float hor=uLine+uBand;
  float h=p.y-hor;
  vec2 sunC=vec2(.10*asp,hor+.43);
  vec3 c;
  if(h>=0.){
    c=skyAt(h)+sunGlow((p-sunC)*vec2(.75,1.))*.20;
    /* Chios, far off in the haze */
    float xn=p.x/asp;
    float a1=smoothstep(-.58,-.30,xn)*smoothstep(.06,-.14,xn);
    float rdg=(.50+.80*noise(vec2(xn*7.+2.,1.7))+.22*noise(vec2(xn*29.,4.2)))*.030*a1;
    float a2=smoothstep(-.04,.12,xn)*smoothstep(.40,.20,xn);
    float rd2=(.5+noise(vec2(xn*13.,7.3))+.3*noise(vec2(xn*41.,2.2)))*.011*a2;
    float e=.0016;
    vec3 far2=mix(skyAt(0.),vec3(.60,.71,.88),.34);
    c=mix(c,far2,smoothstep(rd2+e,rd2-e,h)*step(.0005,rd2));
    vec3 land=mix(skyAt(0.),vec3(.50,.63,.83),.40+.30*smoothstep(0.,.03,rdg-h));
    c=mix(c,land,smoothstep(rdg+e,rdg-e,h)*step(.0005,rdg));
  }else{
    float dy=-h;
    float z=uCamH/max(dy,.0012);
    vec2 w=vec2(p.x*z,z);
    float fade=exp(-z*.05);
    float e=.03+z*.014;
    float h0=seaH(w,t),hx=seaH(w+vec2(e,0.),t),hz=seaH(w+vec2(0.,e),t);
    float A=.26*fade+.03;
    vec3 n=normalize(vec3(-(hx-h0)/e*A,1.,-(hz-h0)/e*A));
    vec3 v=normalize(vec3(-w.x,uCamH,-z));
    float F=.02+.98*pow(1.-max(dot(n,v),0.),5.);
    vec3 r=reflect(-v,n);
    float el=max(r.y,0.)/max(length(r.xz),.001);
    vec3 refl=mix(vec3(.76,.87,.985),skyAt(.9),smoothstep(0.,.6,el));
    vec3 deepC=mix(vec3(.018,.150,.440),vec3(.090,.330,.700),smoothstep(0.,.7,1.-fade));
    c=mix(deepC,refl,F*.9);
    vec2 rw=w*15.+vec2(t*1.1,t*.7);
    vec2 rp=vec2(noise(rw)-.5,noise(rw+17.3)-.5);
    vec3 n2=normalize(n+vec3(rp.x,0.,rp.y)*(.9*fade+.08));
    float sd=max(dot(reflect(-v,n2),normalize(vec3(0.,.43,1.))),0.);
    c+=vec3(1.,.97,.90)*(pow(sd,300.)*1.8+pow(sd,30.)*.12);
    vec3 haze=skyAt(0.)+sunGlow(vec2((p.x-sunC.x)*.75,-.43))*.20;
    c=mix(haze,c,exp(-z*.020));
  }
  /* the name, standing in the air behind the bottle */
  if(uWm.w>.001){
    float a=wmAt(p)*uWm.w;
    vec3 ink=mix(INK,INK*1.22+vec3(.015,.045,.10),smoothstep(-.06,.10,p.y-uWm.y));
    c=mix(c,ink,a*.95);
  }
  return c;
}

/* ---- under the water ---- */
vec3 waterCol(float y){
  float v=clamp(y+.5,0.,1.);
  float a=smoothstep(0.,.45,uDepth),b=smoothstep(.38,1.,uDepth);
  vec3 top=mix(mix(vec3(.165,.490,.900),vec3(.030,.160,.430),a),vec3(.006,.022,.066),b);
  vec3 bot=mix(mix(vec3(.022,.170,.470),vec3(.008,.046,.165),a),vec3(.002,.006,.022),b);
  vec3 c=mix(bot,top,pow(v,1.3));
  return mix(c,c*vec3(.55,1.35,1.25)+vec3(0.,.010,.014),uSpring);
}
float web(vec2 x,float t){
  vec2 n=floor(x),f=fract(x);
  float d1=8.,d2=8.;
  for(int j=-1;j<=1;j++){for(int i=-1;i<=1;i++){
    vec2 g=vec2(float(i),float(j));
    vec2 o=.5+.40*sin(t+6.2831*hash22(n+g));
    float d=length(g+o-f);
    if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}
  }}
  return d2-d1;
}
float rays(vec2 p,float t){
  vec2 d=p-vec2(.08,1.35);
  float a=d.x/max(-d.y,.05);
  float r=noise(vec2(a*6.5+t*.045,t*.10))*.62+noise(vec2(a*15.-t*.07,t*.16+3.))*.38;
  return smoothstep(.44,.82,r)*smoothstep(-.6,.5,p.y);
}
float speck(vec2 p,float sc,float par,float size,float seed,float t,float dens){
  vec2 q=vec2(p.x,p.y-uTravel*par)*sc+seed;
  q.x+=sin(q.y*.8+t*.25+seed)*.18;
  q.y+=t*.03*par;
  vec2 id=floor(q),f=fract(q);
  vec2 h=hash22(id+seed);
  float on=step(1.-dens,hash12(id*1.7+seed+2.3));
  float d=length(f-(.22+.56*h));
  float tw=.65+.35*sin(t*(.6+h.x*1.8)+h.y*6.283);
  return on*smoothstep(size,size*.2,d)*tw*(.3+.7*h.y);
}
float fizz(vec2 p,float sc,float speed,float seed,float t,float stretch){
  vec2 q=vec2(p.x*sc+seed,(p.y*sc-t*speed)/stretch);
  q.x+=sin(q.y*1.3+seed)*.20;
  vec2 id=floor(q),f=fract(q);
  vec2 h=hash22(id+seed);
  float on=step(.50,hash12(id+seed*1.3+.7));
  float d=length(f-(.2+.6*h));
  float rr=.035+.11*h.x*h.x;
  float core=smoothstep(rr,rr*.35,d);
  float edge=smoothstep(.022,0.,abs(d-rr*.85))*step(.075,rr)*step(stretch,1.01);
  return on*(core*.55+edge*.5)*(.4+.6*h.y);
}
/* threads of fine bubbles climbing inside the bottle */
float strings(vec2 b,float t){
  float col=floor(b.x*7.+.5);
  float on=step(.36,hash12(vec2(col,3.7)));
  float cx=(col+(hash12(vec2(col,9.1))-.5)*.6)/7.;
  float sp=.55+hash12(vec2(col,5.3))*.9;
  float yy=b.y*3.2-t*sp;
  float h=hash12(vec2(col*7.3,floor(yy)));
  float wob=sin(b.y*5.+t*2.+col)*.012;
  float d=length(vec2((b.x-cx-wob)*3.2,fract(yy)-.5));
  float rr=.05+.07*h;
  return on*step(.22,h)*smoothstep(rr,rr*.3,d);
}
/* one layer of condensation, in bottle units (height = 1):
   x = how much of this pixel is drop, y = -1 at the drop's foot … 1 at its head, z = glint, w = 0 at its centre … 1 at its edge */
vec4 dew(vec2 b,float n,float dens,float seed,float px){
  vec2 g=b*n;
  vec2 id=floor(g),f=fract(g);
  vec2 h=hash22(id+seed);
  float on=step(1.-dens,hash12(id*1.31+seed+.7));
  float r=mix(.14,.36,h.x*h.x);
  float tall=mix(1.,.78,h.y*h.y);
  vec2 rr=vec2(r,r/tall)+.02;
  vec2 c=rr+(1.-2.*rr)*hash22(id+seed+5.1);
  vec2 d=(f-c)/r;
  d.y*=tall;
  float l=length(d)*(1.+.09*sin(atan(d.y,d.x)*3.+h.x*37.)+.05*sin(atan(d.y,d.x)*5.+h.y*23.));
  float aa=clamp(px*n/r,.04,.9);
  float m=on*smoothstep(1.,1.-aa,l);
  float gl=smoothstep(.36,.06,length(d-vec2(-.34,.40)));
  return vec4(m,d.y,gl*m,l);
}
/* a drop is a small lens: dark under its upper edge, light gathered at its foot, one hard point of sun */
vec3 dewOn(vec3 g,vec4 D,float wet){
  float mm=D.x*wet;
  if(mm<.003)return g;
  vec3 body=g*(1.-.22*smoothstep(-.2,1.,D.y))+(g*.10+vec3(.034,.038,.042))*smoothstep(.1,-1.,D.y);
  body*=1.-.30*smoothstep(.62,1.,D.w)*smoothstep(-.25,.9,D.y);
  body+=vec3(.050,.056,.062)*smoothstep(.60,.97,D.w)*smoothstep(-.1,-.95,D.y);
  body+=vec3(1.)*D.z*.78;
  return mix(g,body,mm);
}
/* a photograph held in the water: two tones, soft at the edges, moving with the swell */
vec3 vision(vec2 p,vec3 c,sampler2D tex,vec4 v,float t,float flip){
  if(v.w<=.001)return c;
  vec2 d=(p-v.xy)/vec2(v.z*.75,v.z);
  float m=smoothstep(1.03,.28,length(d*vec2(.92,.88)));
  vec2 uv=clamp(d*vec2(flip,1.)*.5+.5+vec2(sin(p.y*17.+t*.9)*.0022,sin(p.x*13.+t*.7)*.0016),0.,1.);
  vec3 s=texture2D(tex,uv).rgb;
  float l=dot(s,vec3(.30,.55,.15));
  vec3 duo=mix(vec3(.004,.030,.105),vec3(.66,.86,1.),pow(l,1.18));
  duo+=WARM*pow(l,5.)*.10;
  return mix(c,duo,m*v.w*.88);
}
vec3 underBase(vec2 p,float asp,float t,float wl){
  vec3 c=waterCol(p.y);
  float L=exp(-uDepth*4.6);
  c*=.93+.14*noise(p*1.4+vec2(3.1,-uTravel*.22));
  vec2 q=vec2(p.x*.7,p.y-.72);
  c+=vec3(.30,.55,.90)*exp(-dot(q,q)*2.4)*L*.55;
  /* just under its skin the sea is full of light */
  c+=vec3(.16,.40,.62)*exp(-max(wl-p.y,0.)*7.)*L*.60*step(uLine,.74);
  /* the underside of the surface, receding as we sink */
  float hy=p.y-uHorU;
  if(uCeil<28.&&hy>0.){
    float z=uCeil/max(hy,.002);
    vec2 w=vec2(p.x*z,z);
    float fog=exp(-length(w)*.34-uCeil*.07)*smoothstep(0.,.05,hy);
    vec2 wp=vec2(noise(w*1.3+vec2(t*.16,0.))+.5*noise(w*3.1-vec2(0.,t*.21)),noise(w*1.3+vec2(7.3,-t*.14))+.5*noise(w*3.1+vec2(2.9,t*.19)))-.75;
    vec2 cq=w*2.6+wp*1.5;
    float l1=clamp(1.-web(cq,t*.7)*3.0,0.,1.),l2=clamp(1.-web(cq*1.8+3.7,t*.9+2.)*3.4,0.,1.);
    float swell=noise(w*.55+vec2(t*.08,-t*.05));
    float lines=(l1*l1*l1+l2*l2*l2*.55)*(.35+.9*swell);
    vec3 cc=c*1.12+vec3(.03,.09,.16)*swell+vec3(.62,.86,1.)*lines*.80;
    c=mix(c,cc,fog);
  }
  c+=vec3(.22,.46,.82)*rays(p,t)*L*.42*(1.-.7*uSpring);
  /* matter drifting far behind the bottle; it thins out in the spring */
  c+=vec3(.62,.80,1.)*(.12+.88*L)*speck(p,26.,.35,.055,1.3,t,.45)*.55*(1.-.88*uSpring);
  /* light around the bottle once the tear is inside it */
  vec2 hb=(p-vec2(uBot.x,uBot.y+uBot.z*.42))/vec2(uBot.z*.42,uBot.z*.64);
  c+=mix(vec3(.10,.26,.60),WARM*.34,.22)*exp(-dot(hb,hb)*1.3)*(.04+.44*uBotF.y)*uBotF.x;
  /* what the water remembers */
  c=vision(p,c,uTA,uVA,t,-1.);
  c=vision(p,c,uTB,uVB,t,1.);
  if(uGly.w>.001){
    float g=glyAt(p+vec2(sin(p.y*30.+t*.8)*.0014,0.));
    c+=vec3(.46,.66,1.)*g*uGly.w;
  }
  /* the name, once the sea has closed over it */
  if(uWm.w>.001){
    vec2 qw=vec2(uWm.x+(p.x-uWm.x)/1.06+sin(p.y*46.+t*1.7)*.0032*(1.+uSlosh*3.),p.y+.010+sin(p.x*31.+t*1.3)*.0018);
    float a=wmAt(qw)*uWm.w;
    c=mix(c,c*.70+vec3(.42,.66,.98)*.46,a*(.25+.75*L)*.92);
  }
  return c;
}
vec3 underFront(vec2 p,float t,float wl,float L){
  vec3 a=vec3(0.);
  float clear=1.-.88*uSpring;
  vec3 sc=vec3(.62,.80,1.)*(.12+.88*L);
  float s=speck(p,13.,.75,.075,5.1,t,.36)*.50;
  if(uQ>.5){
    vec2 qq=vec2(p.x,p.y-uTravel*1.7)*3.6+9.7;
    vec2 id=floor(qq),f=fract(qq);vec2 hh=hash22(id);
    float d=length(f-(.25+.5*hh));
    float rr=.10+.12*hh.x;
    s+=step(.70,hash12(id+4.4))*smoothstep(rr,rr*.55,d)*.07;
  }
  a+=sc*s*clear;
  if(uBub>.001){
    float nearS=exp(-max(wl-p.y,0.)*2.4);
    float bb=fizz(p,24.,3.2,2.2,t,1.)+fizz(p,12.,2.3,6.6,t,1.)*.7;
    a+=vec3(.82,.94,1.)*bb*uBub*nearS*(.3+.7*L)*.8;
  }
  if(uRush>.001){
    float bb=fizz(vec2(p.x,p.y-uTravel*1.4),19.,-.5,4.4,t,1.+2.6*uRush)+fizz(vec2(p.x,p.y-uTravel*.9),34.,-.3,8.1,t,1.+1.8*uRush)*.8;
    a+=vec3(.80,.93,1.)*bb*uRush*(.30+.70*L)*.85;
  }
  float md=length(p-uMouse.xy);
  a+=vec3(.3,.5,.9)*sin(md*40.-t*3.)*exp(-md*5.)*.06*uMouse.z*(.3+.7*L);
  return a;
}
/* the tear: clear resin, the water showing through it, a warm heart, hard little highlights */
void tear(vec2 p,inout vec3 c,float t,float L){
  float r=uTear.z,vis=uTear.w;
  if(vis<=.001)return;
  vec2 q=(p-uTear.xy)/r;
  float dark=1.-.5*L;
  float dg=length(q*vec2(1.,.82)-vec2(0.,.12));
  c+=mix(vec3(.70,.88,1.),WARM,.5)*(exp(-max(dg-1.,0.)*1.5)*.24+exp(-dg*.32)*.055)*vis*dark;
  if(abs(q.x)>1.08||q.y<-1.08||q.y>1.95)return;
  float ti=sin(t*.8)*.05;float cs=cos(ti),sn=sin(ti);
  q=vec2(q.x*cs-q.y*sn,q.x*sn+q.y*cs);
  const float TL=1.85;
  float R,RdR,sd;
  if(q.y<=0.){
    R=sqrt(max(1.-q.y*q.y,0.));RdR=-q.y;sd=length(q)-1.;
  }else{
    float s=min(q.y/TL,1.);
    float dR=-6.*s*(1.-s)/TL;
    R=(1.-s)*(1.-s)*(1.+2.*s);RdR=R*dR;
    sd=(abs(q.x)-R)/sqrt(1.+dR*dR);
    if(q.y>TL)sd=1.;
  }
  float aa=1.6/(r*uRes.y);
  float m=smoothstep(aa,-aa,sd);
  if(m<=0.)return;
  float z=sqrt(max(R*R-q.x*q.x,0.));
  vec3 n=normalize(vec3(q.x,-RdR,z+.0001));
  float fz=1.-n.z;
  vec3 inner=waterCol(uTear.y-(q.y-.2)*r*1.25)*1.7+vec3(.09,.15,.22);
  inner=mix(inner,WARM*.92,.20+.30*smoothstep(.9,0.,length(q-vec2(0.,-.25))));
  vec3 col=inner*(.55+.45*n.z);
  col+=vec3(.86,.95,1.)*pow(fz,2.2)*.60;
  float s1=smoothstep(.975,.992,dot(n,normalize(vec3(-.40,.56,.72))));
  float s2=smoothstep(.985,.998,dot(n,normalize(vec3(.46,-.40,.79))));
  col+=vec3(1.)*(s1*.95+s2*.40);
  c=mix(c,col,m*vis);
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float asp=uRes.x/uRes.y;
  float t=uTime;
  float aa=1.5/uRes.y;
  float amp=.55+2.4*uSlosh;
  float wlp=wave(p.x,t,amp);
  float undP=smoothstep(wlp+aa,wlp-aa,p.y);
  float L=exp(-uDepth*4.6);

  /* the bottle, in its own frame */
  float H=uBot.z,S=0.,O=0.,Rm=0.;
  vec3 N=vec3(1.);vec2 q=vec2(0.);
  if(uBotF.x>.001){
    vec2 d=p-vec2(uBot.x,uBot.y+H*.42);
    float cs=cos(uBot.w),sn=sin(uBot.w);
    d=vec2(d.x*cs+d.y*sn,-d.x*sn+d.y*cs);
    q=vec2(d.x,d.y+H*.42);
    /* seen through the surface, what is under water sits a little larger and a little off */
    q.x=mix(q.x,q.x/1.075+sin(p.y*58.+t*2.1)*.0010*(.35+.65*L)*(1.+uSlosh*4.),undP);
    q.y+=.0045*undP;
    vec2 uv=vec2(B_UV.x+q.x/H*B_UV.w,B_UV.y+q.y/H*B_UV.z);
    vec2 in2=step(vec2(0.),uv)*step(uv,vec2(1.));
    uv=clamp(uv,0.,1.);
    vec3 m=texture2D(uTM,uv).rgb*in2.x*in2.y;
    S=m.r*uBotF.x;O=m.g;Rm=m.b;
    N=texture2D(uTN,uv).rgb/.75;
  }
  /* behind the glass the liquid is a lens: the world comes through it a little narrower */
  vec2 pe=p;
  if(S>.004){
    float lq=smoothstep(.86,.82,q.y/H);
    float k=mix(.88,.70,lq);
    pe.x=uBot.x+(p.x-uBot.x)*mix(1.,k,min(S*1.3,1.)*(1.-O));
  }
  float wle=wave(pe.x,t,amp);
  float und=smoothstep(wle+aa,wle-aa,pe.y);
  vec3 col=vec3(0.);
  if(und<.999)col=aboveView(pe,asp,t);
  if(und>.001)col=mix(col,underBase(pe,asp,t,wle),und);

  if(S>.004){
    float hw=H*B_ASP*.5;
    vec3 T=pow(clamp(N,0.,1.),vec3(1.15));
    vec3 hi=max(N-1.,0.)*2.2;
    vec3 amb=mix(vec3(1.),mix(vec3(.46,.72,.96),vec3(.17,.31,.62),smoothstep(0.,.8,uDepth))*(.34+.66*L)*(1.+.75*max(uVA.w,uVB.w)),undP);
    float liq=smoothstep(.86,.83,q.y/H)*smoothstep(1.,.78,abs(q.x)/hw);
    /* glass: it lets the world through, darkens at its edges, keeps the studio's small highlights */
    vec3 g=col*mix(vec3(1.),T,mix(1.,.90,undP))+hi*amb;
    float rim=Rm*Rm;
    g+=vec3(.56,.80,1.)*rim*(.04+undP*(.09+.26*L+.10*max(uVA.w,uVB.w))+.22*uBotF.y*undP);
    float core=exp(-pow(q.x/(hw*.72),2.));
    g+=mix(vec3(.70,.90,1.),WARM,.28)*core*liq*uBotF.y*.36;
    if(uBotF.z>.01){
      vec2 b=vec2(q.x/hw,q.y/H*7.);
      float bb=strings(b,t)+strings(b+vec2(.071,1.3),t*1.35)*.75;
      g+=vec3(.90,.96,1.)*bb*liq*uBotF.z*mix(.26,.10+.20*L+.55*uBotF.y,undP);
    }
    float ca=0.;
    if(undP>.5&&uQ>.5&&L>.03){
      ca=clamp(1.-web(vec2(q.x,q.y)/H*vec2(6.5,3.6)+vec2(t*.10,-t*.07),t*.55)*2.6,0.,1.);
      ca=ca*ca*L;
      g+=vec3(.60,.86,1.)*ca*.085;
    }
    /* the glass has a thickness: a thin dark line where it turns away from us */
    g*=1.-.15*Rm*Rm*Rm*Rm*(1.-.5*undP);
    /* condensation, drawn rather than photographed: it stays sharp, takes the colour of whatever is behind the glass,
       and is gone wherever the sea has closed over the bottle */
    float wet=(1.-undP)*uBotF.w*(1.-O);
    if(wet>.01){
      vec2 bq=q/H;
      float px=1./(uRes.y*H);
      float thin=mix(.50,1.,smoothstep(.97,.72,bq.y))*smoothstep(.0,.05,bq.y);
      g=dewOn(g,dew(bq,36.,.40*thin,3.1,px),wet);
      g=dewOn(g,dew(bq+vec2(.013,.007),80.,.50*thin,7.7,px),wet);
      if(uQ>.5)g=dewOn(g,dew(bq+vec2(.004,.019),168.,.44*thin,12.9,px),wet*.8);
    }
    /* paper and metal, under whatever light there is */
    vec3 o=min(N,vec3(1.25))*amb;
    o+=N*vec3(.90,.96,1.)*uBotF.y*.36*undP+N*vec3(.60,.86,1.)*ca*.13;
    vec3 b3=mix(g,o,O);
    /* a little water between us and the bottle */
    b3=mix(b3,waterCol(p.y)*1.25,undP*(.13+.10*uDepth*(1.-.7*uBotF.y)));
    col=mix(col,b3,S);
  }

  if(undP>.001){
    col+=underFront(p,t,wlp,L)*undP;
    if(uRing.w>.001){
      vec2 e2=vec2(p.x-uRing.x,(p.y-uRing.y)/.34);
      float e=length(e2),front=uRing.z;
      float crest=pow(max(sin((e-front)*30.),0.),14.);
      float ringA=crest*smoothstep(front+.02,front-.34,e)*smoothstep(0.,.05,front)*exp(-e*1.9)*uRing.w;
      col+=mix(WARM,vec3(.72,.92,1.),smoothstep(0.,.35,e))*ringA*.95*undP;
    }
    if(undP>.5)tear(p,col,t,L);
  }
  /* the skin of the sea, in front of everything */
  float show=step(-.62,uLine)*step(uLine,.74);
  float dl=p.y-wlp;
  col+=vec3(.92,.98,1.)*exp(-abs(dl)*240.)*(.55+.40*S)*show;
  col*=1.-.22*smoothstep(.022,0.,-dl)*step(dl,0.)*show;
  vec2 vq=vec2(p.x/asp,p.y);
  col*=1.-dot(vq,vq)*.55*undP;
  col*=1.-.42*smoothstep(.30,.50,p.y)*smoothstep(.36,.52,uLine);
  col+=(hash12(gl_FragCoord.xy+fract(t)*61.)-.5)/255.*1.6;
  gl_FragColor=vec4(col,1.);
}`;

/* ---------- WebGL ---------- */
var gl=null, lost=false, pb=null, quad=null, aniso=null;
var tex={n:null,m:null,t:null,a:null,b:null}, img={n:null,m:null,a:null,b:null}, atlas=null, wmUV=[0,0.5,1,1];
var SCALES=[1.5,1.25,1,0.8,0.65], scaleIdx=0, quality=1, adapt={lock:false,from:-1,base:0,steps:0}, lastS=null;
function compile(type,src){
  var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){var log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(log||'shader');}
  return s;
}
function program(vs,fs,attribs){
  var p=gl.createProgram();
  gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));
  for(var i=0;i<attribs.length;i++)gl.bindAttribLocation(p,i,attribs[i]);
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'link');
  var u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(var k=0;k<n;k++){var info=gl.getActiveUniform(p,k);u[info.name]=gl.getUniformLocation(p,info.name);}
  return {p:p,u:u};
}
function isPot(n){return (n&(n-1))===0;}
function texFrom(src,grey,fmt){
  var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  var mip=false;
  if(src){
    var f=fmt||gl.RGB;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texImage2D(gl.TEXTURE_2D,0,f,f,gl.UNSIGNED_BYTE,src);
    var w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;
    mip=isPot(w)&&isPot(h);
    if(mip){gl.generateMipmap(gl.TEXTURE_2D);if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,4);}
  }else{
    var v=grey||0;
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([v,v,v,255]));
  }
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  return t;
}
function setTex(k,src){
  if(!gl||lost)return;
  if(tex[k])gl.deleteTexture(tex[k]);
  tex[k]=texFrom(src,0,k==='t'?gl.LUMINANCE:gl.RGB);
}
/* the wordmark and 静 in one 2048×1024 sheet: white on black, read from the red channel */
function spaced(x,str,cx,y,font,gap){
  x.font=font;x.textAlign='left';x.textBaseline='alphabetic';
  var w=[],tot=0,i;
  for(i=0;i<str.length;i++){w[i]=x.measureText(str[i]).width;tot+=w[i];}
  tot+=gap*(str.length-1);
  var px=cx-tot/2;
  for(i=0;i<str.length;i++){x.fillText(str[i],px,y);px+=w[i]+gap;}
  return tot;
}
function drawAtlas(){
  var W=2048,H=1024,FS=300;
  var c=doc.createElement('canvas');c.width=W;c.height=H;
  var x=c.getContext('2d');
  x.fillStyle='#000';x.fillRect(0,0,W,H);
  x.fillStyle='#fff';
  spaced(x,'MASTRY',W/2,256+FS*0.33,'600 '+FS+'px "Cormorant Garamond", Georgia, serif',FS*0.075);
  var data=x.getImageData(0,0,W,512).data;
  var x0=W,x1=0,y0=512,y1=0,i,j;
  for(j=0;j<512;j+=2){for(i=0;i<W;i+=2){if(data[(j*W+i)*4]>110){if(i<x0)x0=i;if(i>x1)x1=i;if(j<y0)y0=j;if(j>y1)y1=j;}}}
  if(x1<=x0){x0=0;x1=W;y0=0;y1=512;}
  x0=Math.max(0,x0-3);x1=Math.min(W,x1+3);y0=Math.max(0,y0-3);y1=Math.min(512,y1+3);
  wmUV=[x0/W,1-y1/H,x1/W,1-y0/H];
  x.textAlign='center';x.textBaseline='middle';
  x.font='400 400px "Zen Old Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif';
  x.fillText('静',256,512+262);
  atlas=c;
}
function upload(){
  if(!gl||lost)return;
  if(atlas)setTex('t',atlas);
  if(img.n)setTex('n',img.n);
  if(img.m)setTex('m',img.m);
  if(img.a)setTex('a',img.a);
  if(img.b)setTex('b',img.b);
}
function initGL(){
  var opts={alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'default',preserveDrawingBuffer:false};
  gl=canvas.getContext('webgl',opts)||canvas.getContext('experimental-webgl',opts);
  if(!gl)throw new Error('no webgl');
  pb=program(VS_BG,FS_BG,['a']);
  aniso=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  tex.n=texFrom(null,190);tex.m=texFrom(null,0);tex.t=texFrom(null,0);tex.a=texFrom(null,0);tex.b=texFrom(null,0);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
  upload();
}
function resize(){
  layout();
  if(!gl||lost)return;
  var sc=Math.min(win.devicePixelRatio||1,SCALES[scaleIdx]);
  var bw=Math.max(2,Math.round(L.w*sc)),bh=Math.max(2,Math.round(L.h*sc));
  if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
  gl.viewport(0,0,bw,bh);
}

var mouse={x:0,y:0,tx:0,ty:0,e:0,te:0};
win.addEventListener('pointermove',function(ev){
  mouse.tx=(ev.clientX-L.w/2)/L.h;mouse.ty=(L.h/2-ev.clientY)/L.h;mouse.te=Math.max(mouse.te,1);
},{passive:true});
win.addEventListener('pointerdown',function(){mouse.te=2.4;},{passive:true});

var intro=reduce?1:0, introStart=-1, haveBottle=false, shown=false, ready=false;
function draw(S,t,slosh){
  var u=pb.u,w=canvas.width,h=canvas.height;
  gl.useProgram(pb.p);
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.uniform2f(u.uRes,w,h);
  gl.uniform1f(u.uTime,t);
  gl.uniform1f(u.uLine,S.line);gl.uniform1f(u.uBand,L.band);gl.uniform1f(u.uCamH,0.055);gl.uniform1f(u.uDay,S.day);
  gl.uniform1f(u.uDepth,S.depth);gl.uniform1f(u.uCeil,S.ceil);gl.uniform1f(u.uTravel,S.travel);gl.uniform1f(u.uHorU,-0.08);
  gl.uniform1f(u.uSlosh,slosh);gl.uniform1f(u.uBub,S.bub);gl.uniform1f(u.uRush,S.rush);
  gl.uniform1f(u.uSpring,S.spring);gl.uniform1f(u.uQ,quality);
  /* the bottle rides the swell at the surface, sways a little under it, and is perfectly still at the bottom */
  var e=1-Math.pow(1-intro,3), free=(1-S.surf)*(1-S.still);
  var bob=Math.sin(t*0.9)*0.0034*S.surf+Math.sin(t*0.31+1.3)*0.0045*free;
  var px=coarse?0:Math.max(-0.6,Math.min(0.6,mouse.x)), py=coarse?0:mouse.y;
  var tilt=S.bot[3]+Math.sin(t*0.5)*0.011*S.surf+Math.sin(t*0.27+0.6)*0.020*free-px*0.030*(1-S.still*0.6);
  gl.uniform4f(u.uBot,S.bot[0]+px*0.012,S.bot[1]+bob-0.040*(1-e)+py*0.004,S.bot[2],tilt);
  gl.uniform4f(u.uBotF,haveBottle?e:0,S.glow,S.fizz,S.dew);
  gl.uniform4f(u.uWm,S.wm[0]-px*0.007,S.wm[1]-py*0.003,S.wm[2],S.wm[3]*(atlas?cl(intro*1.6):0));
  gl.uniform4f(u.uWmUV,wmUV[0],wmUV[1],wmUV[2],wmUV[3]);
  gl.uniform4f(u.uGly,S.gly[0]-px*0.010,S.gly[1],S.gly[2],atlas?S.gly[3]:0);
  gl.uniform4f(u.uVA,S.visA[0]-px*0.008,S.visA[1],S.visA[2],img.a?S.visA[3]:0);
  gl.uniform4f(u.uVB,S.visB[0]-px*0.008,S.visB[1],S.visB[2],img.b?S.visB[3]:0);
  /* the tear leaves the photograph and ends in the bottle: it shares the slide of whichever it is nearer to */
  var tf=ss(seg(S.P,0.43,0.545));
  gl.uniform4f(u.uTear,S.tear[0]+lerp(-px*0.008,px*0.012,tf),S.tear[1],S.tear[2],S.tear[3]);
  gl.uniform4f(u.uRing,S.ring[0]+px*0.012,S.ring[1],S.ring[2],S.ring[3]);
  gl.uniform3f(u.uMouse,mouse.x,mouse.y,Math.min(mouse.e,1.4));
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex.n);gl.uniform1i(u.uTN,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tex.m);gl.uniform1i(u.uTM,1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,tex.t);gl.uniform1i(u.uTT,2);
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,tex.a);gl.uniform1i(u.uTA,3);
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,tex.b);gl.uniform1i(u.uTB,4);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

/* ---------- loop ---------- */
var Ps=0, last=0, tAcc=reduce?8:0, vel=0, ftAcc=0, ftN=0, warm=0, t0=0;
function targetP(){
  var max=Math.max(1,root.scrollHeight-win.innerHeight);
  return cl((win.pageYOffset||root.scrollTop||0)/max);
}
function frame(now){
  requestAnimationFrame(frame);
  if(doc.hidden){last=0;return;}
  if(!last)last=now;
  if(!t0)t0=now;
  var dt=Math.min((now-last)/1000,0.1);last=now;
  var Pt=targetP(),prev=Ps;
  if(reduce){Ps=Pt;}else{Ps+=(Pt-Ps)*(1-Math.exp(-dt*(coarse?16:7.5)));if(Math.abs(Pt-Ps)<0.00004)Ps=Pt;}
  var v=dt>0?Math.abs(Ps-prev)/dt:0;
  vel+=(v-vel)*Math.min(1,dt*5);
  if(!reduce)tAcc+=dt;
  mouse.x+=(mouse.tx-mouse.x)*0.08;mouse.y+=(mouse.ty-mouse.y)*0.08;
  mouse.te*=0.985;mouse.e+=(mouse.te-mouse.e)*0.05;
  /* the bottle comes up out of the water once its picture has arrived */
  if(intro<1&&haveBottle){
    if(introStart<0)introStart=now;
    intro=cl((now-introStart-120)/1700);
  }
  if(!ready&&(intro>0.30||now-t0>3200)){ready=true;root.classList.add('ready');}
  var S=compute(Ps);
  lastS=S;
  dom(S);
  if(gl&&!lost){
    /* Hold the frame rate: if frames run long, render at a lower scale. If the step did not help, undo it and stop:
       a 30 fps cap (Low Power Mode, a slow display) is not something a smaller canvas fixes. */
    if(!adapt.lock&&dt>0&&dt<0.1&&doc.hasFocus()){
      if(warm<40){warm++;}
      else{ftAcc+=dt;ftN++;
        if(ftN>=50){
          var avg=ftAcc/ftN;ftAcc=0;ftN=0;warm=0;
          if(adapt.from>=0){
            if(avg>adapt.base*0.85){scaleIdx=adapt.from;adapt.steps--;adapt.lock=true;quality=adapt.steps>=2?0:1;resize();}
            adapt.from=-1;
          }else if(avg>0.0245&&scaleIdx<SCALES.length-1){
            adapt.base=avg;adapt.from=scaleIdx;scaleIdx++;adapt.steps++;quality=adapt.steps>=2?0:1;resize();
          }
        }
      }
    }
    draw(S,tAcc,cl(vel*9));
    if(!shown){shown=true;canvas.classList.add('on');}
  }
}

/* ---------- pictures ---------- */
function load(src,done,alt){
  var im=new Image();
  im.decoding='async';
  im.onload=function(){done(im);};
  im.onerror=function(){if(alt){load(alt,done,null);}else{done(null);}};
  im.src=src;
}
function pictures(){
  var need=2;
  function got(){if(--need===0){haveBottle=!!(img.n&&img.m);if(!haveBottle){intro=1;}}}
  load('/assets/dive/bottle-n2.webp',function(im){img.n=im;if(im)setTex('n',im);got();},'/assets/dive/bottle-n2.jpg');
  load('/assets/dive/bottle-m.png',function(im){img.m=im;if(im)setTex('m',im);got();},null);
  /* the two photographs are not needed until a third of the way down */
  var later=function(){
    load('/assets/dive/vis-resin.jpg',function(im){img.a=im;if(im)setTex('a',im);},null);
    load('/assets/dive/vis-spring.jpg',function(im){img.b=im;if(im)setTex('b',im);},null);
  };
  if(doc.readyState==='complete')setTimeout(later,300);else win.addEventListener('load',function(){setTimeout(later,300);});
}

/* ---------- start ---------- */
layout();
try{initGL();}catch(err){gl=null;root.classList.add('nogl');root.classList.add('ready');ready=true;if(win.console)console.warn('[dive] WebGL unavailable:',err&&err.message);}
if(gl){
  canvas.addEventListener('webglcontextlost',function(ev){ev.preventDefault();lost=true;root.classList.add('nogl');},false);
  canvas.addEventListener('webglcontextrestored',function(){
    try{lost=false;tex={n:null,m:null,t:null,a:null,b:null};initGL();resize();root.classList.remove('nogl');}
    catch(e){lost=true;}
  },false);
  pictures();
}
/* start at the first scale this screen can actually show, so every later step changes something */
while(scaleIdx<SCALES.length-1&&SCALES[scaleIdx+1]>=(win.devicePixelRatio||1))scaleIdx++;
resize();
var rz=0;
win.addEventListener('resize',function(){clearTimeout(rz);rz=setTimeout(function(){
  resize();
  if(gl&&!lost&&lastS){lastS=compute(Ps);dom(lastS);draw(lastS,tAcc,0);}
},120);});
(function fonts(){
  var n=0;
  function go(){try{drawAtlas();upload();}catch(e){if(win.console)console.warn('[dive] type:',e&&e.message);}}
  function again(){if(n++<3)go();}
  if(doc.fonts&&doc.fonts.load){
    Promise.all([doc.fonts.load('600 48px "Cormorant Garamond"','MASTRY'),doc.fonts.load('400 48px "Zen Old Mincho"','静')]).then(go,go);
    /* the Japanese face arrives in pieces: draw once early so the name is never missing, and again when all of it is in */
    setTimeout(again,1200);
    if(doc.fonts.ready&&doc.fonts.ready.then)doc.fonts.ready.then(function(){setTimeout(function(){again();resize();},60);});
  }else{setTimeout(go,300);}
})();
requestAnimationFrame(frame);
})();

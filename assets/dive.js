/* MASTRY — The Dive (v2)
   One scroll-driven shot: sea surface → under → the resin tear → the spring → the bottle → back to light.
   Everything is drawn by one fragment shader plus a point cloud for the wordmark. No libraries. */
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

/* ---------- language: same rule and storage key as the main site ---------- */
var lang=null;
var qs=/[?&]lang=(en|jp|ja)\b/.exec(location.search);
if(qs){lang=qs[1]==='en'?'en':'jp';}
if(!lang){try{var sv=localStorage.getItem('mastry-lang-v2');if(sv==='en'||sv==='jp')lang=sv;}catch(e){}}
if(!lang){
  var tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){}
  var nv=(navigator.language||'').toLowerCase();
  lang=(tz==='Asia/Tokyo'||nv.slice(0,2)==='ja')?'jp':'en';
}
if(lang==='en'){
  root.lang='en';
  var tr=doc.querySelectorAll('[data-en]');
  for(var ti=0;ti<tr.length;ti++){tr[ti].innerHTML=tr[ti].getAttribute('data-en');}
  var al=doc.querySelectorAll('[data-en-label]');
  for(var ai=0;ai<al.length;ai++){al[ai].setAttribute('aria-label',al[ai].getAttribute('data-en-label'));}
}
var STATIONS=lang==='en'
  ?['Surface','Descent','Chios, 38.25°N','Spring water of Japan','Stillness','Ascent']
  :['水面','潜降','ヒオス島 北緯38.25°','日本の湧水','静けさ','浮上'];

/* ---------- elements ---------- */
var canvas=$('gl');
var elBrand=$('brand'), elGauge=$('gauge'), elNum=$('depthNum'), elSt=$('station'), elCue=$('cue'), elProg=$('prog');
var elEdgeT=$('edgeT'), elEdgeB=$('edgeB');
var metaTheme=doc.querySelector('meta[name="theme-color"]');
var beats=[
  {el:$('bHero'),a:-1,   b:0.058,f:0.030},
  {el:$('b1'),   a:0.150,b:0.262,f:0.030},
  {el:$('b2'),   a:0.315,b:0.462,f:0.030},
  {el:$('b3'),   a:0.515,b:0.632,f:0.030},
  {el:$('b4'),   a:0.690,b:0.838,f:0.030},
  {el:$('bEnd'), a:0.953,b:2,    f:0.032}
];

/* ---------- layout-dependent numbers (screen units: height = 1, centre = 0, y up) ---------- */
var L={};
function layout(){
  var w=canvas.clientWidth||win.innerWidth, h=canvas.clientHeight||win.innerHeight;
  var asp=w/Math.max(h,1), portrait=asp<0.85;
  L.w=w;L.h=h;L.asp=asp;L.portrait=portrait;
  L.subX=portrait?(lang==='en'?0:-0.085):(asp<1.25?-0.12:-0.16);
  L.botR=portrait?0.066:0.09;
  L.botBase=portrait?(lang==='en'?-0.15:-0.26):-0.35;
  L.tearR=portrait?0.040:0.052;
  L.tearRestY=L.botBase+3.25*L.botR;
  L.tearRestR=0.33*L.botR;
  L.touchY=L.tearRestY+0.055;
  L.eye=L.touchY-L.tearR+0.16;
  L.span=Math.min(0.86*asp,1.25);
  L.wmHeroY=portrait?0.20:0.135;
  L.wmEndY=portrait?0.27:0.245;
  L.wmEndScale=portrait?1:0.66;
  L.horHero=-0.20;L.horEnd=-0.27;
  root.style.setProperty('--subx',(L.subX*h).toFixed(1)+'px');
}

/* ---------- the timeline: everything on screen is a function of scroll progress P ---------- */
var K_METERS=[[0,0],[0.09,0],[0.21,60],[0.31,700],[0.40,1200],[0.58,1900],[0.77,2600],[0.83,3000],[0.845,3000],[0.91,0],[1,0]];
var K_DEPTH =[[0,0],[0.09,0],[0.21,0.22],[0.40,0.46],[0.58,0.70],[0.77,0.92],[0.83,1],[0.845,1],[0.875,0.30],[0.895,0.06],[0.91,0],[1,0]];
var K_CEIL  =[[0,0.2],[0.08,0.2],[0.165,0.9],[0.27,4.5],[0.36,30],[0.845,30],[0.875,6],[0.895,1.2],[0.92,0.3],[1,0.3]];
function key(K,p){
  for(var i=1;i<K.length;i++){
    if(p<=K[i][0]){var a=K[i-1],b=K[i];return a[1]+(b[1]-a[1])*((p-a[0])/Math.max(b[0]-a[0],1e-5));}
  }
  return K[K.length-1][1];
}
function compute(P){
  var S={P:P};
  S.line=-0.66+1.44*ss(seg(P,0.045,0.165))-1.44*ss(seg(P,0.89,0.955));
  S.day=seg(P,0.5,0.88);
  S.hor=lerp(L.horHero,L.horEnd,S.day);
  S.camH=P<0.5?lerp(1,0.16,ss(seg(P,0,0.13))):lerp(0.2,0.85,ss(seg(P,0.91,0.985)));
  S.depth=key(K_DEPTH,P);
  S.meters=key(K_METERS,P);
  S.ceil=key(K_CEIL,P);
  S.travel=S.depth*7.5;
  S.bub=ss(seg(P,0.06,0.11))*(1-seg(P,0.19,0.30));
  S.rush=ss(seg(P,0.845,0.87))*(1-seg(P,0.90,0.93));
  S.spring=ss(seg(P,0.565,0.645))*(1-seg(P,0.845,0.875));
  /* the tear */
  var ap=1-Math.pow(1-seg(P,0.27,0.365),3);
  var ty=lerp(0.76,L.touchY+0.015,ap);
  ty=lerp(ty,L.touchY,ss(seg(P,0.365,0.545)));
  ty=lerp(ty,L.tearRestY,ss(seg(P,0.60,0.70)));
  var trad=lerp(L.tearR,L.tearRestR,ss(seg(P,0.545,0.675)));
  var away=Math.pow(seg(P,0.84,0.905),2)*1.6;
  S.tear=[L.subX,ty-away,trad,ss(seg(P,0.27,0.30))*(1-seg(P,0.885,0.91))];
  /* the still surface of the spring and its rings */
  var contact=L.touchY-L.tearR;
  var py=P<0.545?lerp(-0.90,contact,1-Math.pow(1-seg(P,0.455,0.545),2)):lerp(contact,0.98,Math.pow(seg(P,0.545,0.67),1.6));
  S.ring=[L.subX,py,seg(P,0.545,0.665)*1.15,ss(seg(P,0.545,0.556))*(1-ss(seg(P,0.60,0.665)))];
  S.plane=[ss(seg(P,0.455,0.49))*(1-ss(seg(P,0.64,0.675))),ss(seg(P,0.47,0.525))*(1-seg(P,0.538,0.55)),L.eye];
  /* the bottle */
  S.bot=[L.subX,L.botBase-away,L.botR,ss(seg(P,0.625,0.705))*(1-seg(P,0.885,0.91))];
  /* the wordmark */
  var e2=ss(seg(P,0.5,0.88));
  S.wmY=lerp(L.wmHeroY,L.wmEndY,e2);
  S.wmScale=lerp(1,L.wmEndScale,e2);
  return S;
}

/* ---------- page furniture driven by the same timeline ---------- */
var lastTone='', lastSt='', lastNum=-1, lastTop='', lastBot='', lastBg='', lastProg='', lastMeta='', lastMetaT=0;
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
    var g=Math.exp(-Math.pow(0.5-(S.hor+0.43),2)*4.2)*0.20;
    top=mix3(mix3([0.940,0.958,0.985],[0.972,0.974,0.972],S.day),mix3([0.585,0.745,0.945],[0.655,0.800,0.965],S.day),k);
    top=[top[0]+g,top[1]+0.965*g,top[2]+0.90*g];
  }else{
    var lt=Math.exp(-S.depth*4.6)*0.49;
    var fog=S.ceil<28?Math.exp(-(S.ceil/Math.max(0.5-S.hor,0.05))*0.34-S.ceil*0.07):0;
    top=waterEdge(S,true);
    top=[(top[0]*0.965+0.30*lt+0.07*fog)*0.86,(top[1]*0.965+0.55*lt+0.12*fog)*0.86,(top[2]*0.965+0.90*lt+0.16*fog)*0.86];
  }
  if(S.line<-0.5){bot=[0.337,0.467,0.694];}
  else{bot=waterEdge(S,false);bot=[bot[0]*0.83,bot[1]*0.83,bot[2]*0.83];}
  return [top,bot];
}
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
  var tone=S.line>0.40?'dark':'light';
  if(tone!==lastTone){lastTone=tone;root.setAttribute('data-tone',tone);}
  if(elBrand)elBrand.classList.toggle('on',S.line>S.wmY+0.10);
  if(elCue)elCue.classList.toggle('on',P<0.028);
  var pr=P.toFixed(4);
  if(pr!==lastProg){lastProg=pr;if(elProg)elProg.style.transform='scaleY('+pr+')';if(!gl||lost)root.style.setProperty('--p',pr);}
  var gOn=P>0.085&&P<0.945;
  if(elGauge){
    elGauge.classList.toggle('on',gOn);
    if(gOn){
      var m=Math.round(S.meters/10)*10;
      if(m!==lastNum){lastNum=m;elNum.textContent=String(m);}
      var st=P<0.10?0:(P<0.30?1:(P<0.50?2:(P<0.665?3:(P<0.845?4:5))));
      if(STATIONS[st]!==lastSt){lastSt=STATIONS[st];elSt.textContent=lastSt;}
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
}

/* ---------- shaders ---------- */
var VS_BG='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
var FS_BG=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime,uLine,uHor,uCamH,uDay,uDepth,uCeil,uTravel,uSlosh,uBub,uRush,uSpring,uQ;
uniform vec4 uTear,uBot,uRing;
uniform vec3 uPlane,uMouse;
uniform sampler2D uLabel;
const vec3 GOLD=vec3(1.,.81,.48);

float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1.,0.)),f.x),mix(hash12(i+vec2(0.,1.)),hash12(i+vec2(1.,1.)),f.x),f.y);}

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
  float h=p.y-uHor;
  vec2 sunC=vec2(0.,uHor+.43);
  if(h>=0.){
    vec3 c=skyAt(h)+sunGlow((p-sunC)*vec2(.75,1.))*.20;
    /* Chios, far off in the haze */
    float xn=p.x/asp;
    float a1=smoothstep(-.58,-.30,xn)*smoothstep(.06,-.14,xn);
    float rdg=(.50+.80*noise(vec2(xn*7.+2.,1.7))+.22*noise(vec2(xn*29.,4.2)))*.028*a1;
    float a2=smoothstep(-.04,.12,xn)*smoothstep(.40,.20,xn);
    float rd2=(.5+noise(vec2(xn*13.,7.3))+.3*noise(vec2(xn*41.,2.2)))*.010*a2;
    float e=.0016;
    vec3 far2=mix(skyAt(0.),vec3(.60,.71,.88),.34);
    c=mix(c,far2,smoothstep(rd2+e,rd2-e,h)*step(.0005,rd2));
    vec3 land=mix(skyAt(0.),vec3(.50,.63,.83),.40+.30*smoothstep(0.,.03,rdg-h));
    c=mix(c,land,smoothstep(rdg+e,rdg-e,h)*step(.0005,rdg));
    return c;
  }
  float dy=-h;
  float z=uCamH/max(dy,.0015);
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
  vec3 c=mix(deepC,refl,F*.9);
  /* sun sparkle on the small ripples */
  vec2 rw=w*15.+vec2(t*1.1,t*.7);
  vec2 rp=vec2(noise(rw)-.5,noise(rw+17.3)-.5);
  vec3 n2=normalize(n+vec3(rp.x,0.,rp.y)*(.9*fade+.08));
  float sd=max(dot(reflect(-v,n2),normalize(vec3(0.,.43,1.))),0.);
  c+=vec3(1.,.97,.90)*(pow(sd,300.)*1.8+pow(sd,30.)*.12)*exp(-max(dy-.085,0.)*16.);
  vec3 haze=skyAt(0.)+sunGlow(vec2(p.x*.75,-.43))*.20;
  return mix(haze,c,exp(-z*.020));
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
float botR(float y,out float dR){
  if(y<.25){float s=y/.25;dR=1.12*(1.-s);return 1.-.14*(1.-s)*(1.-s);}
  if(y<3.5){dR=0.;return 1.;}
  if(y<4.9){float s=(y-3.5)/1.4;dR=-.60*6.*s*(1.-s)/1.4;return 1.-.60*s*s*(3.-2.*s);}
  if(y<6.6){float s=(y-4.9)/1.7;dR=-.035;return .40-.06*s;}
  dR=0.;
  if(y<6.68)return .385;
  return .405-.05*smoothstep(7.2,7.3,y);
}
void bottle(vec2 p,inout vec3 c,float t,float L){
  float Rb=uBot.z,vis=uBot.w;
  if(vis<=.001)return;
  vec2 b=(p-uBot.xy)/Rb;
  vec2 hb=(b-vec2(0.,3.3))*vec2(.30,.22);
  c+=vec3(.07,.17,.46)*exp(-dot(hb,hb))*.20*vis;
  if(b.y<-.1||b.y>7.4||abs(b.x)>1.1)return;
  float dR;float R=botR(clamp(b.y,0.,7.3),dR);
  float aa=1.5/(Rb*uRes.y);
  float m=smoothstep(aa,-aa,(abs(b.x)-R)/sqrt(1.+dR*dR))*smoothstep(-aa,aa,b.y)*smoothstep(7.3+aa,7.3-aa,b.y);
  if(m<=0.)return;
  float nx=clamp(b.x/R,-1.,1.);
  float rn=abs(nx);
  float z=sqrt(1.-rn*rn);
  vec2 tl=(uTear.xy-uBot.xy)/Rb;
  float dT=length(b-tl);
  float lit=uTear.w;
  float isCap=step(6.68,b.y);
  float glass=1.-isCap;
  float liquid=step(b.y,5.90)*step(rn,.90);
  vec3 g=vec3(0.);
  g+=GOLD*exp(-dT*.62)*.30*lit*glass*(.5+.5*z);
  g+=vec3(.10,.22,.46)*.05*glass*(.4+.6*z);
  g+=vec3(.50,.70,1.)*pow(rn,7.)*(.24+.5*L)*glass;
  g+=GOLD*pow(rn,3.5)*exp(-abs(b.y-tl.y)*.50)*.60*lit*glass;
  g+=vec3(.45,.62,.95)*smoothstep(.06,0.,abs(rn-.86))*.10*glass;
  float bodyM=smoothstep(.2,.7,b.y)*smoothstep(5.2,4.2,b.y);
  g+=vec3(.75,.88,1.)*(smoothstep(.11,0.,abs(nx+.60))*.24+smoothstep(.035,0.,abs(nx-.78))*.34)*bodyM*(.34+.66*L+.30*lit);
  float neckM=smoothstep(4.7,5.1,b.y)*smoothstep(6.6,6.3,b.y);
  g+=vec3(.75,.88,1.)*smoothstep(.16,0.,abs(nx+.45))*.16*neckM*(.34+.66*L+.30*lit);
  g+=(GOLD*lit*.28+vec3(.3,.5,.9)*.08)*smoothstep(.55,0.,b.y)*(.4+.6*rn);
  g+=vec3(.8,.9,1.)*exp(-abs(b.y-5.90)*46.)*.20*glass*step(rn,.93);
  float bb=strings(b,t)+strings(b*vec2(1.,1.)+vec2(.071,1.3),t*1.35)*.75;
  g+=(vec3(.85,.93,1.)*.30+GOLD*exp(-dT*.50)*1.1*lit)*bb*liquid;
  c+=g*m*vis;
  /* paper label, lit from behind by the tear */
  float ly0=1.0,ly1=2.72;
  float th=asin(nx);
  float la=smoothstep(ly0,ly0+aa,b.y)*smoothstep(ly1,ly1-aa,b.y);
  if(la>0.){
    vec2 uv=vec2(.5+th/3.14159,(b.y-ly0)/(ly1-ly0));
    float ink=texture2D(uLabel,uv).r;
    float through=exp(-max(tl.y-b.y,0.)*.52)*lit;
    float gx=exp(-pow((b.x-tl.x)*1.1,2.));
    vec3 paper=vec3(1.,.90,.72)*through*(.45+.55*gx)*1.55+vec3(.20,.27,.40)*(.10+.5*L);
    paper*=.34+.66*pow(z,.55);
    paper*=.86+.14*smoothstep(0.,.04,uv.y)*smoothstep(1.,.96,uv.y);
    paper*=mix(1.,.08,ink);
    c=mix(c,paper,la*m*vis);
  }
  /* screw cap */
  if(isCap>.5){
    float kn=.86+.14*sin(th*44.)*step(b.y,7.16)*step(6.80,b.y);
    float lightC=.16+.40*pow(z,1.5)+smoothstep(.12,0.,abs(nx+.5))*.85+smoothstep(.05,0.,abs(nx-.72))*.6;
    vec3 al=vec3(.50,.58,.72)*lightC*kn*(.42+.58*L+.30*lit);
    al+=GOLD*.16*lit*smoothstep(7.0,6.68,b.y);
    c=mix(c,al,m*vis);
  }
}
void tear(vec2 p,inout vec3 c,float t,float L){
  float r=uTear.z,vis=uTear.w;
  if(vis<=.001)return;
  vec2 q=(p-uTear.xy)/r;
  float dark=1.-.55*L;
  float dg=length(q*vec2(1.,.82)-vec2(0.,.12));
  c+=GOLD*(exp(-max(dg-1.,0.)*1.45)*.34+exp(-dg*.30)*.085)*vis*dark;
  /* a thread of resin trailing behind as it sinks */
  float wy=q.y-1.6;
  float wisp=exp(-pow(q.x*2.4+sin(q.y*1.2+t*.9)*.22,2.))*smoothstep(0.,.8,wy)*exp(-wy*.30);
  c+=GOLD*wisp*.055*vis*dark;
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
  /* clear resin: amber at the edge, honey through the middle, a little of the water showing through upside down */
  float ry=uTear.y-(q.y-.2)*r*1.25;
  float ly=ry-.72;
  vec3 behind=waterCol(ry)+vec3(.30,.55,.90)*exp(-ly*ly*2.4)*L*.5;
  vec3 amber=vec3(.90,.56,.20),honey=vec3(1.,.85,.52),pale=vec3(1.,.96,.84);
  vec3 col=mix(amber,honey,pow(n.z,1.2));
  col=mix(col,behind*1.5+amber*.25,.20);
  col+=pale*smoothstep(.70,0.,length(q-vec2(.07,-.40)))*.55;
  vec3 env=mix(amber*.55,vec3(.78,.92,1.)*(.25+.75*L)+pale*.2,smoothstep(-.25,.9,n.y));
  col=mix(col,env,pow(fz,2.4)*.38);
  col+=pale*pow(fz,4.5)*.55;
  float s1=smoothstep(.980,.994,dot(n,normalize(vec3(-.40,.56,.72))));
  float s2=smoothstep(.985,.998,dot(n,normalize(vec3(.46,-.40,.79))));
  col+=vec3(1.)*(s1*.90+s2*.35);
  c=mix(c,col,m*vis);
}
vec3 underView(vec2 p,float asp,float t,float wl){
  vec3 c=waterCol(p.y);
  float L=exp(-uDepth*4.6);
  c*=.93+.14*noise(p*1.4+vec2(3.1,-uTravel*.22));
  vec2 q=vec2(p.x*.7,p.y-.72);
  c+=vec3(.30,.55,.90)*exp(-dot(q,q)*2.4)*L*.55;
  /* the underside of the surface, receding as we sink */
  float hy=p.y-uHor;
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
  /* drifting matter at three distances; it thins out in the spring */
  float clear=1.-.88*uSpring;
  vec3 sc=vec3(.62,.80,1.)*(.12+.88*L);
  float s=speck(p,26.,.35,.055,1.3,t,.45)*.55+speck(p,13.,.75,.075,5.1,t,.36)*.50;
  if(uQ>.5){
    vec2 qq=vec2(p.x,p.y-uTravel*1.7)*3.6+9.7;
    vec2 id=floor(qq),f=fract(qq);vec2 hh=hash22(id);
    float d=length(f-(.25+.5*hh));
    float rr=.10+.12*hh.x;
    s+=step(.70,hash12(id+4.4))*smoothstep(rr,rr*.55,d)*.07;
  }
  c+=sc*s*clear;
  if(uBub>.001){
    float nearS=exp(-max(wl-p.y,0.)*2.4);
    float bb=fizz(p,24.,3.2,2.2,t,1.)+fizz(p,12.,2.3,6.6,t,1.)*.7;
    c+=vec3(.82,.94,1.)*bb*uBub*nearS*(.3+.7*L)*.8;
  }
  if(uRush>.001){
    float bb=fizz(vec2(p.x,p.y-uTravel*1.4),19.,-.5,4.4,t,1.+2.6*uRush)+fizz(vec2(p.x,p.y-uTravel*.9),34.,-.3,8.1,t,1.+1.8*uRush)*.8;
    c+=vec3(.80,.93,1.)*bb*uRush*(.30+.70*L)*.85;
  }
  /* the still surface of the spring: the tear's reflection, the rings, the moment we pass through */
  if(uPlane.x>.001){
    vec2 pc=uRing.xy;
    float off=pc.y-uPlane.z;
    float sq=clamp(abs(off)*1.05,.03,.21);
    vec2 e2=vec2(p.x-pc.x,(p.y-pc.y)/sq);
    float e=length(e2);
    float side=smoothstep(0.,.02,(p.y-uPlane.z)*sign(off));
    float front=uRing.z;
    float crest=pow(max(sin((e-front)*30.),0.),14.);
    float ringA=crest*smoothstep(front+.02,front-.34,e)*smoothstep(0.,.05,front)*exp(-e*1.9)*uRing.w*mix(1.,.5,step(0.,off));
    float sheen=exp(-e*2.2)*.10*uPlane.x;
    vec2 mr=vec2(p.x-uTear.x,(p.y-(2.*pc.y-uTear.y))/max(sq*1.4,.12));
    float refl=exp(-dot(mr,mr)/(uTear.z*uTear.z*5.))*uPlane.y;
    vec3 ringC=mix(GOLD,vec3(.72,.92,1.),smoothstep(0.,.35,e));
    c+=(ringC*ringA*.95+vec3(.72,.92,1.)*sheen+GOLD*refl*.55)*side;
    c+=vec3(.70,.92,1.)*exp(-abs(p.y-uPlane.z)*70.)*exp(-abs(off)*16.)*.55*uPlane.x*(.6+.4*noise(vec2(p.x*9.+t*.4,t*.3)));
  }
  float md=length(p-uMouse.xy);
  c+=vec3(.3,.5,.9)*sin(md*40.-t*3.)*exp(-md*5.)*.06*uMouse.z*(.3+.7*L);
  tear(p,c,t,L);
  bottle(p,c,t,L);
  return c;
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float asp=uRes.x/uRes.y;
  float t=uTime;
  float aa=1.5/uRes.y;
  float amp=.55+2.4*uSlosh;
  float wl=uLine+(sin(p.x*5.3+t*1.15)*.005+sin(p.x*11.7-t*1.9)*.0025+(noise(vec2(p.x*2.6+t*.3,t*.55))-.5)*.016)*amp;
  float und=smoothstep(wl+aa,wl-aa,p.y);
  vec3 col=vec3(0.);
  if(und<.999)col=aboveView(p,asp,t);
  if(und>.001)col=mix(col,underView(p,asp,t,wl),und);
  float show=step(-.62,uLine)*step(uLine,.74);
  float dl=p.y-wl;
  col+=vec3(.92,.98,1.)*exp(-abs(dl)*240.)*.55*show;
  col*=1.-.22*smoothstep(.022,0.,-dl)*step(dl,0.)*show;
  vec2 vq=vec2(p.x/asp,p.y);
  col*=1.-dot(vq,vq)*.55*und;
  col+=(hash12(gl_FragCoord.xy+fract(t)*61.)-.5)/255.*1.6;
  gl_FragColor=vec4(col,1.);
}`;

var VS_PT=`
attribute vec3 aT;
attribute vec3 aO;
uniform float uAsm,uTime,uPx,uAsp,uSpan,uScale,uLine;
uniform vec2 uOff;
uniform vec3 uMouse;
varying float vA;
varying float vU;
void main(){
  float rnd=aT.z;
  vec2 tgt=aT.xy*uSpan*uScale+uOff;
  float a=clamp(uAsm*1.5-rnd*.5,0.,1.);a=a*a*(3.-2.*a);
  vec2 from=tgt+vec2(aO.x*.55*uAsp,.30+abs(aO.y)*.55);
  vec2 pos=mix(from,tgt,a);
  pos.y+=sin(uTime*.8+aT.x*9.)*.0030*uSpan;
  pos.x+=cos(uTime*.6+aT.y*40.)*.0012*uSpan;
  pos+=vec2(sin(uTime*.7+rnd*6.283),cos(uTime*.55+rnd*9.4))*.0012;
  /* once the water reaches a grain it is a bubble: it climbs after the surface, drifts, and pops */
  float wet=uLine-tgt.y+(rnd-.5)*.04;
  float s=smoothstep(0.,.30,wet);
  pos.y+=max(wet,0.)*(.50+.42*aO.z);
  pos.x+=aO.x*.05*s*uAsp+sin(uTime*1.7+rnd*20.+pos.y*30.)*.006*s;
  vec2 dm=pos-uMouse.xy;float dl=max(length(dm),.0001);
  pos+=(dm/dl)*smoothstep(.16,0.,dl)*.05*uMouse.z*(1.-s);
  gl_Position=vec4(pos.x/uAsp*2.,pos.y*2.,0.,1.);
  gl_PointSize=max(uPx*(.72+rnd*.9)*(1.+s*.9),1.);
  vA=(.55+.45*rnd)*a*(1.-smoothstep(.16,.40,wet+aO.y*.04));
  vU=step(0.,wet);
}`;
var FS_PT=`
precision mediump float;
varying float vA;
varying float vU;
void main(){
  float d=length(gl_PointCoord-.5);
  float al=smoothstep(.5,.20,d)*vA;
  vec3 col=mix(vec3(.060,.250,.800),vec3(.88,.95,1.),vU);
  gl_FragColor=vec4(col,al);
}`;

/* ---------- WebGL ---------- */
var gl=null, lost=false, pb=null, pp=null, quad=null, labelTex=null, pts={n:0,bT:null,bO:null,inkW:1,step:2};
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
function texFrom(src){
  var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  if(src){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
  else{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);}
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  return t;
}
function spaced(x,str,cx,y,font,gap){
  x.font=font;x.textAlign='left';x.textBaseline='alphabetic';
  var w=[],tot=0,i;
  for(i=0;i<str.length;i++){w[i]=x.measureText(str[i]).width;tot+=w[i];}
  tot+=gap*(str.length-1);
  var px=cx-tot/2;
  for(i=0;i<str.length;i++){x.fillText(str[i],px,y);px+=w[i]+gap;}
  return tot;
}
var artLabel=null, artWord=null;
function drawArt(){
  /* label: white ink on black, read from the red channel */
  var c=doc.createElement('canvas');c.width=512;c.height=256;
  var x=c.getContext('2d');
  x.fillStyle='#000';x.fillRect(0,0,512,256);
  x.fillStyle='#fff';x.strokeStyle='#fff';
  x.save();x.translate(256-21,24);x.scale(0.42,0.42);
  x.lineWidth=4;x.beginPath();x.arc(50,50,40,0,6.2832);x.stroke();
  x.beginPath();x.arc(50,23,3,0,6.2832);x.fill();
  x.lineWidth=6;x.lineCap='round';x.lineJoin='round';
  x.beginPath();x.moveTo(31,71);x.lineTo(31,33);x.lineTo(50,53);x.lineTo(69,33);x.lineTo(69,71);x.stroke();
  x.beginPath();x.moveTo(50,51);x.bezierCurveTo(45,61,45,70,50,75);x.bezierCurveTo(55,70,55,61,50,51);x.closePath();x.fill();
  x.restore();
  spaced(x,'MASTRY',256,130,'600 50px "Cormorant Garamond", Georgia, serif',10);
  x.fillRect(256-34,152,68,1.5);
  spaced(x,'SPARKLING WATER WITH MASTIHA',256,182,'400 12.5px "Jost", "Helvetica Neue", sans-serif',3);
  spaced(x,'CHIOS, GREECE × JAPAN',256,208,'400 10.5px "Jost", "Helvetica Neue", sans-serif',2.8);
  artLabel=c;
  /* wordmark → points */
  var W=1500,H=360,FS=250;
  var c2=doc.createElement('canvas');c2.width=W;c2.height=H;
  var y=c2.getContext('2d');y.fillStyle='#fff';
  spaced(y,'MASTRY',W/2,H/2+FS*0.33,'600 '+FS+'px "Cormorant Garamond", Georgia, serif',FS*0.045);
  var data=y.getImageData(0,0,W,H).data;
  var x0=W,x1=0,y0=H,y1=0,i,j;
  for(j=0;j<H;j+=2){for(i=0;i<W;i+=2){if(data[(j*W+i)*4+3]>110){if(i<x0)x0=i;if(i>x1)x1=i;if(j<y0)y0=j;if(j>y1)y1=j;}}}
  if(x1<=x0){x0=0;x1=W;y0=0;y1=H;}
  var inkW=x1-x0,cx=(x0+x1)/2,cy=(y0+y1)/2;
  var step=(win.innerWidth<700)?2.6:1.8;
  var T=[],O=[];
  for(j=y0;j<=y1;j+=step){for(i=x0;i<=x1;i+=step){
    var jx=i+(Math.random()-0.5)*step,jy=j+(Math.random()-0.5)*step;
    var xi=Math.min(W-1,Math.max(0,Math.round(jx))),yi=Math.min(H-1,Math.max(0,Math.round(jy)));
    if(data[(yi*W+xi)*4+3]>110){
      T.push((jx-cx)/inkW,(cy-jy)/inkW,Math.random());
      O.push(Math.random()*2-1,Math.random()*2-1,Math.random());
    }
  }}
  artWord={T:new Float32Array(T),O:new Float32Array(O),inkW:inkW,step:step};
}
function upload(){
  if(!gl||lost)return;
  if(artLabel){if(labelTex)gl.deleteTexture(labelTex);labelTex=texFrom(artLabel);}
  if(artWord){
    if(pts.bT)gl.deleteBuffer(pts.bT);if(pts.bO)gl.deleteBuffer(pts.bO);
    pts.bT=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pts.bT);gl.bufferData(gl.ARRAY_BUFFER,artWord.T,gl.STATIC_DRAW);
    pts.bO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pts.bO);gl.bufferData(gl.ARRAY_BUFFER,artWord.O,gl.STATIC_DRAW);
    pts.n=artWord.T.length/3;pts.inkW=artWord.inkW;pts.step=artWord.step;
  }
}
function initGL(){
  var opts={alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'default',preserveDrawingBuffer:false};
  gl=canvas.getContext('webgl',opts)||canvas.getContext('experimental-webgl',opts);
  if(!gl)throw new Error('no webgl');
  pb=program(VS_BG,FS_BG,['a']);
  pp=program(VS_PT,FS_PT,['aT','aO']);
  quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  labelTex=texFrom(null);
  gl.disable(gl.DEPTH_TEST);
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

var asm=reduce?1:0, asmStart=-1, shown=false, ready=false;
function draw(S,t,slosh){
  var u=pb.u,w=canvas.width,h=canvas.height;
  gl.disable(gl.BLEND);
  gl.useProgram(pb.p);
  gl.disableVertexAttribArray(1);
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.uniform2f(u.uRes,w,h);
  gl.uniform1f(u.uTime,t);
  gl.uniform1f(u.uLine,S.line);gl.uniform1f(u.uHor,S.hor);gl.uniform1f(u.uCamH,S.camH);gl.uniform1f(u.uDay,S.day);
  gl.uniform1f(u.uDepth,S.depth);gl.uniform1f(u.uCeil,S.ceil);gl.uniform1f(u.uTravel,S.travel);
  gl.uniform1f(u.uSlosh,slosh);gl.uniform1f(u.uBub,S.bub);gl.uniform1f(u.uRush,S.rush);
  gl.uniform1f(u.uSpring,S.spring);gl.uniform1f(u.uQ,quality);
  gl.uniform4f(u.uTear,S.tear[0],S.tear[1],S.tear[2],S.tear[3]);
  gl.uniform4f(u.uBot,S.bot[0],S.bot[1],S.bot[2],S.bot[3]);
  gl.uniform4f(u.uRing,S.ring[0],S.ring[1],S.ring[2],S.ring[3]);
  gl.uniform3f(u.uPlane,S.plane[0],S.plane[1],S.plane[2]);
  gl.uniform3f(u.uMouse,mouse.x,mouse.y,Math.min(mouse.e,1.4));
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,labelTex);gl.uniform1i(u.uLabel,0);
  gl.drawArrays(gl.TRIANGLES,0,3);
  if(pts.n&&S.line<S.wmY+0.62){
    var v=pp.u,sc=w/Math.max(L.w,1);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(pp.p);
    gl.bindBuffer(gl.ARRAY_BUFFER,pts.bT);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,pts.bO);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
    var cssPerPx=L.span*S.wmScale*L.h/pts.inkW;
    gl.uniform1f(v.uPx,Math.max(pts.step*cssPerPx*1.25,1.1)*sc);
    gl.uniform1f(v.uAsm,asm);gl.uniform1f(v.uTime,t);
    gl.uniform1f(v.uAsp,L.asp);gl.uniform1f(v.uSpan,L.span);gl.uniform1f(v.uScale,S.wmScale);
    gl.uniform1f(v.uLine,S.line);gl.uniform2f(v.uOff,0,S.wmY);
    gl.uniform3f(v.uMouse,mouse.x,mouse.y,Math.min(mouse.e,1.4));
    gl.drawArrays(gl.POINTS,0,pts.n);
  }
}

/* ---------- loop ---------- */
var Ps=0, last=0, tAcc=reduce?8:0, vel=0, ftAcc=0, ftN=0, warm=0;
function targetP(){
  var max=Math.max(1,root.scrollHeight-win.innerHeight);
  return cl((win.pageYOffset||root.scrollTop||0)/max);
}
function frame(now){
  requestAnimationFrame(frame);
  if(doc.hidden){last=0;return;}
  if(!last)last=now;
  var dt=Math.min((now-last)/1000,0.1);last=now;
  var Pt=targetP(),prev=Ps;
  if(reduce){Ps=Pt;}else{Ps+=(Pt-Ps)*(1-Math.exp(-dt*(coarse?16:7.5)));if(Math.abs(Pt-Ps)<0.00004)Ps=Pt;}
  var v=dt>0?Math.abs(Ps-prev)/dt:0;
  vel+=(v-vel)*Math.min(1,dt*5);
  if(!reduce)tAcc+=dt;
  mouse.x+=(mouse.tx-mouse.x)*0.08;mouse.y+=(mouse.ty-mouse.y)*0.08;
  mouse.te*=0.985;mouse.e+=(mouse.te-mouse.e)*0.05;
  if(asm<1&&pts.n){
    if(asmStart<0)asmStart=now;
    var a=cl((now-asmStart-250)/2600);
    asm=a<0.5?4*a*a*a:1-Math.pow(-2*a+2,3)/2;
  }
  if(!ready&&(asm>0.55||now>4200)){ready=true;root.classList.add('ready');}
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

/* ---------- start ---------- */
layout();
try{initGL();}catch(err){gl=null;root.classList.add('nogl');root.classList.add('ready');ready=true;if(win.console)console.warn('[dive] WebGL unavailable:',err&&err.message);}
if(gl){
  canvas.addEventListener('webglcontextlost',function(ev){ev.preventDefault();lost=true;root.classList.add('nogl');},false);
  canvas.addEventListener('webglcontextrestored',function(){
    try{lost=false;labelTex=null;pts.bT=null;pts.bO=null;initGL();resize();root.classList.remove('nogl');}
    catch(e){lost=true;}
  },false);
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
  var done=false;
  function go(){if(done)return;done=true;try{drawArt();upload();}catch(e){if(win.console)console.warn('[dive] art:',e&&e.message);}}
  if(doc.fonts&&doc.fonts.load){
    Promise.all([doc.fonts.load('600 48px "Cormorant Garamond"','MASTRY'),doc.fonts.load('400 12px "Jost"','SPARKLING')]).then(go,go);
    setTimeout(go,2200);
  }else{setTimeout(go,300);}
})();
requestAnimationFrame(frame);
})();

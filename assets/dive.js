/* MASTRY — The Dive
   Scroll-to-submerge WebGL journey.
   OSS: Three.js (WebGL) · GSAP + ScrollTrigger (scroll) · Lenis (smooth scroll) */
(function(){
  'use strict';
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch=window.matchMedia('(pointer: coarse)').matches;

  /* ---------- veil ---------- */
  function liftVeil(){var v=document.getElementById('veil');if(v)v.classList.add('off');}
  if(document.readyState==='complete'){setTimeout(liftVeil,reduce?0:900);}
  else{window.addEventListener('load',function(){setTimeout(liftVeil,reduce?0:900);});}
  setTimeout(liftVeil,3800);

  /* ---------- scroll progress (works with or without GSAP) ---------- */
  var P=0, depthEl=document.getElementById('depth'), depthNum=document.getElementById('depthNum');
  var bands=[
    {el:document.getElementById('ovHero'),  a:-0.10,b:0.10},
    {el:document.getElementById('ovDive'),  a:0.15, b:0.27},
    {el:document.getElementById('ovDeep1'), a:0.34, b:0.47},
    {el:document.getElementById('ovDeep2'), a:0.53, b:0.64},
    {el:document.getElementById('ovBottle'),a:0.70, b:0.84}
  ];
  var cue=document.getElementById('heroCue');
  function clamp01(x){return x<0?0:(x>1?1:x);}
  var depthLabel=depthEl?depthEl.querySelector('span'):null;
  var dCk=[[0,0],[0.10,0],[0.21,600],[0.40,1200],[0.58,1900],[0.77,2600],[0.93,3000]];
  function depthAt(p){for(var k=1;k<dCk.length;k++){if(p<=dCk[k][0]){var a=dCk[k-1],b=dCk[k];var f=(p-a[0])/Math.max(b[0]-a[0],1e-4);return Math.round((a[1]+(b[1]-a[1])*f)/10)*10;}}return 3000;}
  var dLab=[[0.14,'水面 — Surface'],[0.31,'潜行 — Descent'],[0.50,'ヒオス島 · 38.25°N'],[0.67,'日本の湧水 · Spring'],[1.01,'静けさ — Stillness']];
  function labelAt(p){for(var k=0;k<dLab.length;k++){if(p<dLab[k][0])return dLab[k][1];}return '深度 — THE DIVE';}
  function setP(p){
    P=p;
    for(var i=0;i<bands.length;i++){
      var b=bands[i];
      var o=clamp01(Math.min(p-b.a,b.b-p)/0.035);
      b.el.style.opacity=o;
      b.el.style.transform='translateY('+((1-o)*26)+'px)';
    }
    if(cue){var co=clamp01(Math.min(p+0.05,0.07-p)/0.02);cue.style.opacity=co;}
    if(depthEl){
      var on=p>0.06&&p<0.95;
      depthEl.classList.toggle('on',on);
      if(on){
        depthNum.innerHTML=depthAt(p)+'<small>m</small>';
        if(depthLabel)depthLabel.textContent=labelAt(p);
      }
    }
  }
  function spaceEnd(){
    var sp=document.querySelector('.scroll-space');
    return sp.offsetTop+sp.offsetHeight-window.innerHeight;
  }
  if(typeof gsap!=='undefined'&&typeof ScrollTrigger!=='undefined'){
    gsap.registerPlugin(ScrollTrigger);
    if(typeof Lenis!=='undefined'&&!isTouch&&!reduce){
      var lenis=new Lenis({duration:1.2,easing:function(t){return 1-Math.pow(1-t,3);}});
      lenis.on('scroll',ScrollTrigger.update);
      gsap.ticker.add(function(t){lenis.raf(t*1000);});
      gsap.ticker.lagSmoothing(0);
    }
    ScrollTrigger.create({start:0,end:spaceEnd,onUpdate:function(self){setP(self.progress);}});
  }else{
    window.addEventListener('scroll',function(){setP(clamp01(window.scrollY/spaceEnd()));},{passive:true});
  }
  setP(0);

  /* ---------- magnetic button ---------- */
  (function(){
    if(isTouch||reduce)return;
    var btn=document.getElementById('magBtn');if(!btn)return;
    btn.addEventListener('pointermove',function(e){
      var r=btn.getBoundingClientRect();
      var dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
      btn.style.transform='translate('+dx*0.22+'px,'+dy*0.28+'px)';
    });
    btn.addEventListener('pointerleave',function(){
      btn.style.transition='transform .6s cubic-bezier(.16,1,.3,1)';
      btn.style.transform='translate(0,0)';
      setTimeout(function(){btn.style.transition='';},600);
    });
  })();

  /* ---------- WebGL ---------- */
  if(typeof THREE==='undefined')return;
  var canvas=document.getElementById('gl'),renderer;
  try{renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:false});}
  catch(e){canvas.style.display='none';return;}
  var dpr=Math.min(window.devicePixelRatio||1,1.5);
  renderer.setPixelRatio(dpr);
  renderer.autoClear=false;

  var camera=new THREE.PerspectiveCamera(55,1,0.1,1200);
  camera.position.set(0,0,90);
  var scene=new THREE.Scene();
  var world=new THREE.Group();scene.add(world);

  /* ----- background shader (sky / waterline / deep / god rays) ----- */
  var bgScene=new THREE.Scene();
  var bgCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  var bgU={uTime:{value:0},uRes:{value:new THREE.Vector2(1,1)},uP:{value:0},
           uM:{value:new THREE.Vector2(0.5,0.5)},uME:{value:0}};
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
    uniforms:bgU,depthWrite:false,depthTest:false,
    vertexShader:'void main(){gl_Position=vec4(position,1.0);}',
    fragmentShader:[
      'precision highp float;',
      'uniform float uTime;uniform vec2 uRes;uniform float uP;uniform vec2 uM;uniform float uME;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
      'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);',
      ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
      'float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=0.5;}return v;}',
      'void main(){',
      ' vec2 uv=gl_FragCoord.xy/uRes;',
      ' float t=uTime;',
      ' float sub=smoothstep(0.02,0.26,uP);',
      ' float uw=smoothstep(0.12,0.26,uP);',
      ' float yline=mix(0.34,1.7,sub)+noise(vec2(uv.x*5.0,t*0.4))*0.02;',
      ' vec3 sky=mix(vec3(0.46,0.58,0.72),vec3(0.75,0.84,0.94),uv.y);',
      ' float sun=smoothstep(0.30,0.0,length(uv-vec2(0.5,0.80)));',
      ' sky+=vec3(0.9,0.78,0.55)*sun*0.35;',
      ' float depthMix=smoothstep(0.2,0.85,uP);',
      ' vec3 shallow=vec3(0.06,0.20,0.38);',
      ' vec3 deep=vec3(0.004,0.022,0.055);',
      ' vec3 water=mix(shallow,deep,depthMix);',
      ' water+=vec3(0.05,0.12,0.22)*fbm(uv*3.0+vec2(t*0.06,t*0.03))*(1.0-depthMix*0.8);',
      ' float ang=atan(uv.x-0.5,1.4-uv.y);',
      ' float rays=max(0.0,sin(ang*30.0+t*0.35))*max(0.0,sin(ang*14.0-t*0.22));',
      ' water+=vec3(0.20,0.38,0.66)*rays*uw*(1.0-depthMix*0.85)*uv.y*0.35;',
      ' float caus=fbm(uv*vec2(8.0,5.0)+vec2(t*0.22,t*0.15));',
      ' water+=vec3(0.18,0.32,0.55)*smoothstep(0.62,0.95,caus)*uw*(1.0-depthMix)*0.30;',
      ' float below=smoothstep(yline+0.012,yline-0.012,uv.y);',
      ' vec3 col=mix(sky,water,max(below,uw));',
      ' float lineGlow=exp(-abs(uv.y-yline)*60.0)*(1.0-uw);',
      ' col+=vec3(0.8,0.9,1.0)*lineGlow*0.5;',
      ' float d=length((uv-uM)*vec2(uRes.x/uRes.y,1.0));',
      ' col+=vec3(0.3,0.5,0.9)*sin(d*40.0-t*3.0)*exp(-d*5.0)*0.10*uME;',
      ' float rs=smoothstep(0.86,0.99,uP);',
      ' col=mix(col,vec3(0.10,0.22,0.40),rs*(1.0-uv.y)*0.8);',
      ' col*=1.0-0.40*length(uv-0.5);',
      ' gl_FragColor=vec4(col,1.0);',
      '}'
    ].join('\n')
  })));

  /* ----- particle wordmark ----- */
  var pUniforms={uAssemble:{value:reduce?1:0},uScatter:{value:0},uTime:{value:0},
                 uPix:{value:dpr},uMouse:{value:new THREE.Vector3(9999,9999,0)},uME:{value:0},uFit:{value:1}};
  (function buildParticles(){
    function build(){
      var W=1100,H=260;
      var c=document.createElement('canvas');c.width=W;c.height=H;
      var x=c.getContext('2d');
      x.fillStyle='#fff';
      x.font='600 200px "Cormorant Garamond", serif';
      x.textAlign='center';x.textBaseline='middle';
      x.fillText('MASTRY',W/2,H/2+8);
      var data=x.getImageData(0,0,W,H).data;
      var step=3;
      /* fit the wordmark to the viewport so it never overflows on portrait phones */
      var halfH=Math.tan(55*Math.PI/360)*90;
      var halfW=halfH*(window.innerWidth/Math.max(window.innerHeight,1));
      var fit=Math.min(1,(halfW*1.72)/150);
      var SPAN=150*fit, TXH=35.5*fit, OFFY=30*fit;
      pUniforms.uFit.value=fit;
      var targets=[],i,j;
      for(j=0;j<H;j+=step){for(i=0;i<W;i+=step){
        if(data[(j*W+i)*4+3]>128){
          targets.push((i/W-0.5)*SPAN,(0.5-j/H)*TXH+OFFY,(Math.random()-0.5)*3*fit);
        }
      }}
      var n=targets.length/3;
      var pos=new Float32Array(n*3),tar=new Float32Array(targets),out=new Float32Array(n*3),rnd=new Float32Array(n);
      for(i=0;i<n;i++){
        out[i*3]=(Math.random()-0.5)*240;
        out[i*3+1]=(Math.random()-0.5)*160;
        out[i*3+2]=(Math.random()-0.5)*120;
        rnd[i]=Math.random();
        pos[i*3]=tar[i*3];pos[i*3+1]=tar[i*3+1];pos[i*3+2]=tar[i*3+2];
      }
      var g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      g.setAttribute('aTarget',new THREE.BufferAttribute(tar,3));
      g.setAttribute('aOut',new THREE.BufferAttribute(out,3));
      g.setAttribute('aRand',new THREE.BufferAttribute(rnd,1));
      var m=new THREE.ShaderMaterial({
        uniforms:pUniforms,transparent:true,depthWrite:false,blending:THREE.NormalBlending,
        vertexShader:[
          'attribute vec3 aTarget;attribute vec3 aOut;attribute float aRand;',
          'uniform float uAssemble,uScatter,uTime,uPix,uME,uFit;uniform vec3 uMouse;',
          'varying float vA;',
          'void main(){',
          ' vec3 pos=mix(aOut*1.5+vec3(0.,150.,0.),aTarget,uAssemble);',
          ' pos=mix(pos,aOut+vec3(0.,200.,50.),uScatter);',
          ' float wob=mix(0.3,1.0,uFit)*(1.0-0.52*uAssemble*(1.0-uScatter));',
          ' pos.x+=sin(uTime*0.7+aRand*6.28)*(0.8+aRand)*wob;',
          ' pos.y+=cos(uTime*0.55+aRand*9.4)*(0.6+aRand)*0.8*wob;',
          ' pos.y+=sin(uTime*0.8+aTarget.x*0.055)*0.6*uFit;',
          ' pos.x+=cos(uTime*0.6+aTarget.y*0.12)*0.3*uFit;',
          ' vec2 dm=pos.xy-uMouse.xy;',
          ' float dl=max(length(dm),0.0001);',
          ' pos.xy+=(dm/dl)*smoothstep(24.0,0.0,dl)*20.0*uME*uFit;',
          ' vec4 mv=modelViewMatrix*vec4(pos,1.0);',
          ' gl_PointSize=uPix*(1.6+aRand*2.0)*(150.0/-mv.z)*mix(0.42,1.0,uFit);',
          ' gl_Position=projectionMatrix*mv;',
          ' vA=0.45+0.55*aRand;',
          '}'
        ].join('\n'),
        fragmentShader:[
          'precision highp float;varying float vA;uniform float uScatter;',
          'void main(){',
          ' float d=length(gl_PointCoord-0.5);if(d>0.5)discard;',
          ' float a=smoothstep(0.5,0.08,d)*(0.35+0.65*vA);',
          ' vec3 ink=vec3(0.055,0.255,0.82);',
          ' vec3 bright=mix(vec3(0.60,0.76,1.0),vec3(1.0),vA*0.55);',
          ' vec3 col=mix(ink,bright,clamp(uScatter*2.4,0.0,1.0));',
          ' gl_FragColor=vec4(col,a);',
          '}'
        ].join('\n')
      });
      world.add(new THREE.Points(g,m));
      if(!reduce&&typeof gsap!=='undefined'){
        gsap.fromTo(pUniforms.uAssemble,{value:0},{value:1,duration:2.8,ease:'power3.inOut',delay:0.5});
      }else{pUniforms.uAssemble.value=1;}
    }
    if(document.fonts&&document.fonts.ready){
      var done=false;
      document.fonts.ready.then(function(){if(!done){done=true;build();}});
      setTimeout(function(){if(!done){done=true;build();}},1800);
    }else{build();}
  })();

  /* ----- bubbles ----- */
  var bubGeo=new THREE.BufferGeometry();
  var BN=(window.innerWidth<700)?260:520;
  var bp=new Float32Array(BN*3),bs=new Float32Array(BN);
  for(var bi=0;bi<BN;bi++){
    bp[bi*3]=(Math.random()-0.5)*160;
    bp[bi*3+1]=-60-Math.random()*440;
    bp[bi*3+2]=(Math.random()-0.5)*80;
    bs[bi]=0.25+Math.random();
  }
  bubGeo.setAttribute('position',new THREE.BufferAttribute(bp,3));
  var bubTex=(function(){
    var c=document.createElement('canvas');c.width=64;c.height=64;
    var x=c.getContext('2d');
    var g=x.createRadialGradient(28,26,2,32,32,30);
    g.addColorStop(0,'rgba(255,255,255,.95)');
    g.addColorStop(0.25,'rgba(190,215,255,.45)');
    g.addColorStop(1,'rgba(120,160,255,0)');
    x.fillStyle=g;x.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
  })();
  var bubMat=new THREE.PointsMaterial({size:2.6,map:bubTex,transparent:true,opacity:0,
    depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
  world.add(new THREE.Points(bubGeo,bubMat));

  /* ----- bottle in the deep ----- */
  var bottle=new THREE.Group();
  (function(){
    var pts=[];
    function v(x,y){pts.push(new THREE.Vector2(x,y));}
    v(0,0);v(7.4,0);v(8.6,1.0);v(9.0,4.5);v(9.0,25);v(8.4,30);v(4.8,35);v(3.5,37.5);
    v(3.5,43);v(4.1,43.6);v(4.1,46);v(0,46);
    var geo=new THREE.LatheGeometry(pts,48);
    var mat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{uTime:{value:0}},
      vertexShader:[
        'varying vec3 vN;varying vec3 vV;',
        'void main(){',
        ' vec4 wp=modelMatrix*vec4(position,1.0);',
        ' vN=normalize(mat3(modelMatrix)*normal);',
        ' vV=normalize(cameraPosition-wp.xyz);',
        ' gl_Position=projectionMatrix*viewMatrix*wp;',
        '}'
      ].join('\n'),
      fragmentShader:[
        'precision mediump float;varying vec3 vN;varying vec3 vV;',
        'void main(){',
        ' float rim=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.1);',
        ' vec3 col=mix(vec3(0.05,0.12,0.26),vec3(0.55,0.75,1.0),rim);',
        ' gl_FragColor=vec4(col,0.10+rim*0.9);',
        '}'
      ].join('\n')
    });
    var mesh=new THREE.Mesh(geo,mat);
    mesh.position.y=-23;
    bottle.add(mesh);
    /* golden tear inside */
    var tear=new THREE.Mesh(new THREE.SphereGeometry(2.3,20,20),
      new THREE.MeshBasicMaterial({color:0xe9c885,transparent:true,opacity:0.95}));
    tear.scale.y=1.5;tear.position.y=-6;bottle.add(tear);
    var glowTex=(function(){
      var c=document.createElement('canvas');c.width=128;c.height=128;
      var x=c.getContext('2d');
      var g=x.createRadialGradient(64,64,4,64,64,62);
      g.addColorStop(0,'rgba(255,222,150,.9)');
      g.addColorStop(0.4,'rgba(233,200,133,.28)');
      g.addColorStop(1,'rgba(233,200,133,0)');
      x.fillStyle=g;x.fillRect(0,0,128,128);
      return new THREE.CanvasTexture(c);
    })();
    var glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,
      blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.9}));
    glow.scale.set(34,34,1);glow.position.y=-6;bottle.add(glow);
    var halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,
      blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.35,color:0x4f8df9}));
    halo.scale.set(150,150,1);bottle.add(halo);
    bottle.userData={tear:tear,glow:glow};
  })();
  bottle.position.set(0,-330,0);
  world.add(bottle);

  /* ---------- pointer ---------- */
  var mNdc={x:0.5,y:0.5},mTarget={x:0.5,y:0.5},energy=0,tEnergy=0;
  window.addEventListener('pointermove',function(e){
    mTarget.x=e.clientX/window.innerWidth;
    mTarget.y=1-e.clientY/window.innerHeight;
    tEnergy=Math.max(tEnergy,1);
  },{passive:true});
  window.addEventListener('pointerdown',function(){tEnergy=3;},{passive:true});

  /* ---------- resize / loop ---------- */
  function resize(){
    var w=window.innerWidth,h=window.innerHeight;
    renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
    bgU.uRes.value.set(w*dpr,h*dpr);
  }
  window.addEventListener('resize',resize);resize();

  var clock=new THREE.Clock(),running=true;
  document.addEventListener('visibilitychange',function(){running=!document.hidden;});
  function worldMouse(){
    var halfH=Math.tan(camera.fov*Math.PI/360)*camera.position.z;
    var halfW=halfH*camera.aspect;
    return {x:(mNdc.x*2-1)*halfW,y:(mNdc.y*2-1)*halfH-world.position.y};
  }
  (function loop(){
    requestAnimationFrame(loop);
    if(!running)return;
    var t=clock.getElapsedTime();
    var dt=Math.min(clock.getDelta()||0.016,0.05);
    mNdc.x+=(mTarget.x-mNdc.x)*0.07;mNdc.y+=(mTarget.y-mNdc.y)*0.07;
    tEnergy*=0.985;energy+=(tEnergy-energy)*0.05;

    bgU.uTime.value=t;bgU.uP.value=P;
    bgU.uM.value.set(mNdc.x,mNdc.y);bgU.uME.value=Math.min(energy,1.4);

    world.position.y=P*460;
    pUniforms.uTime.value=t;
    pUniforms.uScatter.value=clamp01((P-0.06)/0.22);
    pUniforms.uME.value=Math.min(energy,1.4);
    var wm=worldMouse();
    pUniforms.uMouse.value.set(wm.x,wm.y,0);

    /* bubbles rise, wrap, fade in underwater */
    var arr=bubGeo.attributes.position.array;
    for(var i=0;i<BN;i++){
      arr[i*3+1]+=bs[i]*(22*dt);
      arr[i*3]+=Math.sin(t*0.8+i)*0.015;
      if(arr[i*3+1]>-40-world.position.y+60){arr[i*3+1]=-460-world.position.y*0.2-Math.random()*60;}
    }
    bubGeo.attributes.position.needsUpdate=true;
    bubMat.opacity=clamp01((P-0.18)/0.1)*0.85*(1-clamp01((P-0.88)/0.08));

    /* bottle */
    bottle.rotation.y+=dt*0.3;
    bottle.position.y=-330+Math.sin(t*0.7)*2.2;
    bottle.position.x=(mNdc.x-0.5)*8;
    var pulse=0.85+Math.sin(t*2.1)*0.15;
    bottle.userData.glow.material.opacity=0.7*pulse;
    bottle.userData.tear.scale.setScalar(1+Math.sin(t*2.1)*0.06);
    bottle.userData.tear.scale.y=1.5*(1+Math.sin(t*2.1)*0.06);

    renderer.clear();
    renderer.render(bgScene,bgCam);
    renderer.clearDepth();
    renderer.render(scene,camera);
  })();
})();

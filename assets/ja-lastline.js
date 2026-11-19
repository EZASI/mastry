/* MASTRY ja-lastline v1: without text-wrap:pretty (iOS<=18 Safari, Firefox) keep the last
   4+ characters of Japanese p/li/figcaption/dd together. Call: mastryLastLine('main') */
(function(){
var SEL='p,li,figcaption,dd',SKIP='[data-lines],nav,button,.chips,.no-ll,#mst-panel',
  PUNCT=/[\u3001\u3002\uff0c\uff0e\uff01\uff1f\u300d\u300f\uff09)\s]/g,JA=/[\u3040-\u30ff\u3400-\u9fff]/,seg;
function vis(e){return e.getClientRects().length>0&&getComputedStyle(e).visibility!='hidden';}
function one(el){
  if(el.closest(SKIP)||el.querySelector('span.ll')||!vis(el))return;
  var t=el.textContent;
  if(!JA.test(t)||t.replace(/\s/g,'').length<16)return;
  var cs=getComputedStyle(el);
  if(cs.whiteSpace=='nowrap'||cs.textWrapMode=='nowrap')return;
  var w=document.createTreeWalker(el,4,null),n,last=null;
  while((n=w.nextNode()))if(/\S/.test(n.data)&&vis(n.parentNode))last=n;
  if(!last)return;
  var core=last.data.replace(/\s+$/,''),s=Array.from(seg.segment(core)),g='',i=s.length,c;
  while(i--){
    c=s[i].segment+g;
    if(c.length>10||c.length>=core.length)break;
    g=c;
    if(g.replace(PUNCT,'').length>=4)break;
  }
  if(g.replace(PUNCT,'').length<2)return;
  var tail=last.splitText(core.length-g.length);
  if(tail.data.length>g.length)tail.splitText(g.length);
  var sp=document.createElement('span');
  sp.className='ll';sp.setAttribute('style','all:unset;white-space:nowrap');
  tail.parentNode.insertBefore(sp,tail);sp.appendChild(tail);
}
window.mastryLastLine=function(target){
  if(window.CSS&&CSS.supports&&CSS.supports('text-wrap','pretty'))return;
  if(!window.Intl||!Intl.Segmenter)return;
  seg=seg||new Intl.Segmenter('ja',{granularity:'word'});
  var roots=typeof target=='string'?document.querySelectorAll(target):target?[target]:[],i,j,r,l;
  for(i=0;i<roots.length;i++){
    r=roots[i];
    l=[].slice.call(r.querySelectorAll(SEL));
    if(r.matches&&r.matches(SEL))l.unshift(r);
    for(j=0;j<l.length;j++){try{one(l[j]);}catch(e){}}
  }
};
})();

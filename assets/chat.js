/* MASTRY 集客チャットボット (無料・リード獲得型)
 * - 33問Q&Aで即応答
 * - ビジネス意図を検知 → 連絡先を回収 → Web3Forms で担当者にメール通知
 * - LINE誘導 / 問い合わせフォーム誘導
 * AIアップグレード: window.MASTRY_AI_ENDPOINT を設定すると freeform 回答に切替（後日）
 */
(function () {
  "use strict";
  var ACCENT = "#2563eb", INK = "#0c1a2b";
  var WEB3KEY = "e4a2680b-2894-46e8-a87d-59ca6462aca9";
  var LINE_URL = "https://line.me/R/ti/p/@469dufhi";
  var CONTACT_URL = "https://mastry.jp/contact.html";
  var QA = window.MASTRY_QA || [];
  var convo = [];

  // ---------- styles ----------
  var css = "" +
  "#mst-bubble{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;background:" + ACCENT + ";box-shadow:0 8px 24px rgba(37,99,235,.4);cursor:pointer;z-index:99999;display:flex;align-items:center;justify-content:center;transition:transform .2s}" +
  "#mst-bubble:hover{transform:scale(1.08)}" +
  "#mst-bubble svg{width:28px;height:28px;fill:#fff}" +
  "#mst-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;border-radius:10px;padding:1px 6px}" +
  "#mst-panel{position:fixed;right:20px;bottom:92px;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(12,26,43,.28);z-index:99999;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,'Hiragino Kaku Gothic ProN',sans-serif}" +
  "#mst-panel.open{display:flex;animation:mstin .25s ease}" +
  "@keyframes mstin{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}" +
  "#mst-head{background:" + ACCENT + ";color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}" +
  "#mst-head b{font-size:15px}#mst-head span{font-size:12px;opacity:.85;display:block;font-weight:400}" +
  "#mst-x{margin-left:auto;cursor:pointer;font-size:20px;opacity:.9;line-height:1}" +
  "#mst-body{flex:1;overflow-y:auto;padding:14px;background:#f6f8fc}" +
  ".mst-msg{max-width:84%;padding:10px 13px;border-radius:14px;margin:6px 0;font-size:13.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}" +
  ".mst-bot{background:#fff;color:" + INK + ";border:1px solid #e6ebf2;border-bottom-left-radius:4px}" +
  ".mst-user{background:" + ACCENT + ";color:#fff;margin-left:auto;border-bottom-right-radius:4px}" +
  ".mst-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}" +
  ".mst-chip{background:#fff;border:1px solid " + ACCENT + ";color:" + ACCENT + ";border-radius:16px;padding:6px 12px;font-size:12.5px;cursor:pointer}" +
  ".mst-chip:hover{background:" + ACCENT + ";color:#fff}" +
  "#mst-foot{border-top:1px solid #eee;padding:10px;display:flex;gap:8px;background:#fff}" +
  "#mst-in{flex:1;border:1px solid #d8e0ee;border-radius:20px;padding:9px 14px;font-size:13.5px;outline:none}" +
  "#mst-send{background:" + ACCENT + ";border:none;color:#fff;border-radius:50%;width:38px;height:38px;cursor:pointer;font-size:16px}" +
  ".mst-form input{width:100%;box-sizing:border-box;border:1px solid #d8e0ee;border-radius:10px;padding:9px 11px;margin:5px 0;font-size:13px}" +
  ".mst-form button{width:100%;background:" + ACCENT + ";color:#fff;border:none;border-radius:10px;padding:10px;font-size:13.5px;font-weight:700;cursor:pointer;margin-top:4px}" +
  ".mst-pow{font-size:10px;color:#9aa7b8;text-align:center;padding:4px}" +
  "#mst-panel,#mst-panel *{cursor:auto !important}" +
  "#mst-in{cursor:text !important}" +
  "#mst-bubble,#mst-bubble *,.mst-chip,#mst-send,#mst-x,.mst-form button,.mst-msg a{cursor:pointer !important}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- DOM ----------
  var bubble = document.createElement("div"); bubble.id = "mst-bubble";
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.6 6.1L5 21l4.2-2.1c.9.2 1.8.3 2.8.3 5.5 0 10-3.6 10-8s-4.5-8-10-8z"/></svg><span id="mst-badge">1</span>';
  document.body.appendChild(bubble);

  var panel = document.createElement("div"); panel.id = "mst-panel";
  panel.innerHTML =
    '<div id="mst-head"><div><b>MASTRY サポート</b><span>ご質問・お取扱いのご相談はこちら</span></div><div id="mst-x">×</div></div>' +
    '<div id="mst-body"></div>' +
    '<div id="mst-foot"><input id="mst-in" placeholder="メッセージを入力…" autocomplete="off"/><button id="mst-send">▶</button></div>' +
    '<div class="mst-pow">MASTRY合同会社</div>';
  document.body.appendChild(panel);

  var body = panel.querySelector("#mst-body");
  var input = panel.querySelector("#mst-in");

  function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}
  function scroll(){body.scrollTop = body.scrollHeight;}

  function addMsg(text, who) {
    var m = document.createElement("div");
    m.className = "mst-msg " + (who === "user" ? "mst-user" : "mst-bot");
    m.innerHTML = esc(text).replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank" style="color:inherit;text-decoration:underline">$1</a>');
    body.appendChild(m); convo.push((who==="user"?"客: ":"Bot: ")+text); scroll();
  }
  function addChips(items) {
    var c = document.createElement("div"); c.className = "mst-chips";
    items.forEach(function (it) {
      var b = document.createElement("div"); b.className = "mst-chip"; b.textContent = it.label;
      b.onclick = it.fn; c.appendChild(b);
    });
    body.appendChild(c); scroll();
  }
  var MAIN_CHIPS = [
    {label:"商品について", fn:function(){handle("MASTRYとは");}},
    {label:"業務用・卸の相談", fn:function(){leadForm("業務用・卸");}},
    {label:"サンプルが欲しい", fn:function(){leadForm("サンプル希望");}},
    {label:"よくある質問", fn:function(){handle("よくある質問");}},
    {label:"LINEで相談", fn:function(){addMsg("LINEでもご相談いただけます。友だち追加はこちら：\n"+LINE_URL,"bot");}}
  ];

  // ---------- matching ----------
  function norm(s){return (s||"").toLowerCase().replace(/[\s　、。！？!?．.，,・]/g,"");}
  function bigrams(s){var a=[];for(var i=0;i<s.length-1;i++)a.push(s.substr(i,2));return a;}
  function sim(a,b){var A=bigrams(norm(a)),B=bigrams(norm(b));if(!A.length||!B.length)return 0;var setB={};B.forEach(function(x){setB[x]=1;});var hit=0;A.forEach(function(x){if(setB[x])hit++;});return hit/Math.max(A.length,B.length);}

  var INTENT = ["卸","仕入","取扱","取り扱","業務用","導入","納品","ロット","サンプル","取材","メディア","協業","コラボ","ホテル","店で","バーで","レストラン"];
  function hasIntent(t){t=norm(t);return INTENT.some(function(k){return t.indexOf(norm(k))>=0;});}

  function bestQA(t){
    var best=null,score=0;
    QA.forEach(function(x){var s=sim(t,x.q);if(s>score){score=s;best=x;}});
    return score>=0.18?best:null;
  }

  function handle(text){
    if(text==="よくある質問"){
      addMsg("よくあるご質問です。気になるものをどうぞ：","bot");
      addChips([
        {label:"価格は？",fn:function(){handle("価格はいくらですか");}},
        {label:"どんな味？",fn:function(){handle("どんな味ですか");}},
        {label:"どこで買える？",fn:function(){handle("どこで買えますか");}},
        {label:"発売はいつ？",fn:function(){handle("発売はいつですか");}},
        {label:"会社情報",fn:function(){handle("会社情報を教えてください");}}
      ]);
      return;
    }
    var qa=bestQA(text);
    if(qa){
      addMsg(qa.a,"bot");
      if(hasIntent(text)){ setTimeout(function(){offerLead();},400); }
      else { setTimeout(function(){addChips([
        {label:"業務用・卸の相談",fn:function(){leadForm("業務用・卸");}},
        {label:"サンプルが欲しい",fn:function(){leadForm("サンプル希望");}},
        {label:"LINEで相談",fn:function(){addMsg("LINE友だち追加：\n"+LINE_URL,"bot");}}
      ]);},400); }
    } else if(hasIntent(text)){
      offerLead();
    } else {
      addMsg("ありがとうございます。担当者がより詳しくご案内します。下のボタンからお進みください。","bot");
      addChips(MAIN_CHIPS);
    }
  }
  function offerLead(){
    addMsg("ぜひ担当者よりご案内します。お差し支えなければ、ご連絡先を教えてください（後ほどご連絡します）。","bot");
    addChips([{label:"連絡先を入力する",fn:function(){leadForm("お問い合わせ");}},{label:"LINEで相談",fn:function(){addMsg("LINE友だち追加：\n"+LINE_URL,"bot");}}]);
  }

  // ---------- lead capture ----------
  function leadForm(kind){
    var f=document.createElement("div"); f.className="mst-msg mst-bot mst-form";
    f.innerHTML =
      '<div style="font-weight:700;margin-bottom:4px">'+esc(kind)+'のご相談</div>'+
      '<input id="mst-co" placeholder="店名・会社名"/>'+
      '<input id="mst-nm" placeholder="お名前"/>'+
      '<input id="mst-em" placeholder="メールアドレス" type="email"/>'+
      '<input id="mst-ms" placeholder="ご用件（任意）"/>'+
      '<button id="mst-submit">送信する</button>';
    body.appendChild(f); scroll();
    f.querySelector("#mst-submit").onclick=function(){
      var co=f.querySelector("#mst-co").value.trim();
      var nm=f.querySelector("#mst-nm").value.trim();
      var em=f.querySelector("#mst-em").value.trim();
      var ms=f.querySelector("#mst-ms").value.trim();
      if(!em||!nm){addMsg("お名前とメールアドレスのご入力をお願いします。","bot");return;}
      this.disabled=true; this.textContent="送信中…";
      var payload={access_key:WEB3KEY,subject:"【サイトチャット】新規リード："+kind,from_name:"MASTRYサイトチャット",
        種別:kind,店名_会社名:co,お名前:nm,メール:em,ご用件:ms,会話ログ:convo.slice(-12).join("\n"),ページ:location.href};
      fetch("https://api.web3forms.com/submit",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload)})
        .then(function(r){return r.json();}).then(function(d){
          if(d.success){addMsg("ありがとうございます、"+nm+"様。内容を受け付けました。担当者より追ってご連絡いたします。お急ぎの場合はLINEでもご相談いただけます：\n"+LINE_URL,"bot");}
          else{throw new Error();}
        }).catch(function(){addMsg("送信に失敗しました。お手数ですが問い合わせフォームをご利用ください：\n"+CONTACT_URL,"bot");});
    };
  }

  // ---------- send ----------
  function send(){
    var t=input.value.trim(); if(!t)return; input.value="";
    addMsg(t,"user");
    setTimeout(function(){handle(t);},250);
  }
  panel.querySelector("#mst-send").onclick=send;
  input.addEventListener("keydown",function(e){if(e.key==="Enter")send();});

  // ---------- open/close ----------
  var greeted=false;
  function open(){
    panel.classList.add("open");
    var bd=document.getElementById("mst-badge"); if(bd)bd.style.display="none";
    if(!greeted){greeted=true;
      addMsg("こんにちは！MASTRY（マストライ）です🌿\nギリシャ・ヒオス島のマスティハ × 日本の湧水、糖類ゼロのプレミアム・スパークリングウォーターです。ご質問・お取扱いのご相談、お気軽にどうぞ。","bot");
      addChips(MAIN_CHIPS);
    }
  }
  bubble.onclick=function(){ panel.classList.contains("open")?panel.classList.remove("open"):open(); };
  panel.querySelector("#mst-x").onclick=function(){panel.classList.remove("open");};

  // チャット操作中はサイトのカスタムカーソル(リング/ドット)を隠す（カーソルのちらつき防止）
  function mstHideCur(h){[".cursor",".cursor-dot"].forEach(function(s){var e=document.querySelector(s);if(e)e.style.opacity=h?"0":"";});}
  [bubble,panel].forEach(function(el){
    el.addEventListener("mouseenter",function(){mstHideCur(true);});
    el.addEventListener("mouseleave",function(){mstHideCur(false);});
  });
})();

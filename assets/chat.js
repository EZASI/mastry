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
  var PRIVACY_URL = "https://mastry.jp/privacy.html";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var JA_RE = /[぀-ヿ一-鿿]/;
  var MINCHO = "'Zen Old Mincho','Hiragino Mincho ProN','Yu Mincho',serif";
  var QA = window.MASTRY_QA || [];
  var convo = [];

  function isEN(){ return (document.documentElement.lang || "").slice(0, 2) !== "ja"; }
  function track(name, method){ try{ if(typeof gtag === "function") gtag("event", name, {method: method}); }catch(e){} }

  // ---------- styles ----------
  var css = "" +
  "#mst-bubble{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;background:" + ACCENT + ";box-shadow:0 8px 24px rgba(37,99,235,.4);cursor:pointer;z-index:99999;display:flex;align-items:center;justify-content:center;transition:transform .2s}" +
  "#mst-bubble:hover{transform:scale(1.08)}" +
  "#mst-bubble:focus-visible{outline:2px solid #fff;outline-offset:2px;box-shadow:0 0 0 4px " + ACCENT + ",0 8px 24px rgba(37,99,235,.4)}" +
  "#mst-bubble svg{width:28px;height:28px;fill:#fff}" +
  "#mst-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;border-radius:10px;padding:1px 6px}" +
  "#mst-panel{position:fixed;right:20px;bottom:92px;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(12,26,43,.28);z-index:99999;display:none;flex-direction:column;overflow:hidden;font-family:'Jost',-apple-system,'Helvetica Neue',sans-serif}" +
  "#mst-panel{letter-spacing:normal}" +
  "#mst-panel:lang(ja),#mst-panel :lang(ja){font-family:" + MINCHO + ";letter-spacing:.04em}" +
  "#mst-panel input,#mst-panel button{font-family:inherit}" +
  "#mst-panel.open{display:flex;animation:mstin .25s ease}" +
  "@keyframes mstin{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}" +
  "#mst-head{background:" + ACCENT + ";color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}" +
  "#mst-head b{font-size:15px}#mst-head span{font-size:12px;opacity:1;display:block;font-weight:400}" +
  "#mst-x{margin:-10px -10px -10px auto;width:44px;height:44px;background:none;border:0;padding:0;color:#fff;cursor:pointer;font-size:20px;opacity:.9;line-height:1;font-family:-apple-system,'Helvetica Neue',sans-serif}" +
  "#mst-x:focus-visible{outline:2px solid #fff;outline-offset:-4px;opacity:1}" +
  "#mst-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:14px;background:#f6f8fc}" +
  ".mst-msg{max-width:84%;padding:10px 13px;border-radius:14px;margin:6px 0;font-size:13.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}" +
  ".mst-bot{background:#fff;color:" + INK + ";border:1px solid #e6ebf2;border-bottom-left-radius:4px}" +
  ".mst-user{background:" + ACCENT + ";color:#fff;margin-left:auto;border-bottom-right-radius:4px;width:-webkit-fit-content;width:fit-content}" +
  ".mst-msg a{color:inherit;text-decoration:underline;letter-spacing:0;word-break:normal;overflow-wrap:anywhere}" +
  ".mst-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}" +
  ".mst-chip{background:#fff;border:1px solid " + ACCENT + ";color:" + ACCENT + ";border-radius:16px;padding:6px 12px;font-size:12.5px;cursor:pointer;font-family:inherit;line-height:1.3}" +
  ".mst-chip:hover{background:" + ACCENT + ";color:#fff}" +
  ".mst-chip:focus-visible{outline:2px solid " + ACCENT + ";outline-offset:2px}" +
  "#mst-foot{border-top:1px solid #eee;padding:10px;display:flex;gap:8px;background:#fff}" +
  "#mst-in{flex:1;min-width:0;border:1px solid #9fb3dd;border-radius:20px;padding:9px 14px;font-size:13.5px;outline:none}" +
  "#mst-send{flex:none;background:" + ACCENT + ";border:none;color:#fff;border-radius:50%;width:38px;height:38px;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
  "#mst-send svg{width:18px;height:18px;display:block}" +
  "#mst-send:focus-visible{outline:2px solid " + ACCENT + ";outline-offset:2px}" +
  ".mst-form input{width:100%;box-sizing:border-box;border:1px solid #9fb3dd;border-radius:10px;padding:9px 11px;margin:5px 0;font-size:13px}" +
  ".mst-form input:disabled{background:#f1f4f9;color:#5a6b80}" +
  "#mst-in:focus-visible,.mst-form input:focus-visible{outline:2px solid #2563eb;outline-offset:1px}" +
  ".mst-form button{width:100%;background:" + ACCENT + ";color:#fff;border:none;border-radius:10px;padding:10px;font-size:13.5px;font-weight:700;cursor:pointer;margin-top:4px}" +
  ".mst-form button:disabled{opacity:.7;cursor:default}" +
  ".mst-form button:focus-visible{outline:2px solid " + INK + ";outline-offset:2px}" +
  ".mst-note{font-size:11px;color:#5a6b80;margin:4px 0;line-height:1.5}" +
  ".mst-pow{font-size:10px;color:#5a6b80;text-align:center;padding:4px;background:#fff}" +
  "@media(max-width:560px){#mst-bubble{width:52px;height:52px;right:14px;bottom:calc(14px + env(safe-area-inset-bottom))}#mst-bubble svg{width:24px;height:24px}" +
    "#mst-panel{left:16px;right:16px;width:auto;max-width:none;bottom:calc(78px + env(safe-area-inset-bottom));max-height:calc(100vh - 110px);max-height:calc(100dvh - 110px)}}" +
  "@media(max-width:374px){.mst-msg{max-width:92%}}" +
  "@media (hover:none) and (pointer:coarse){#mst-in,.mst-form input,.mst-form textarea{font-size:16px}}" +
  "#mst-panel,#mst-panel *{cursor:auto !important}" +
  "#mst-in{cursor:text !important}" +
  "#mst-bubble,#mst-bubble *,.mst-chip,#mst-send,#mst-send *,#mst-x,.mst-form button,.mst-msg a{cursor:pointer !important}" +
  ".mst-form button:disabled{cursor:default !important}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- DOM ----------
  var bubble = document.createElement("div"); bubble.id = "mst-bubble";
  bubble.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.6 6.1L5 21l4.2-2.1c.9.2 1.8.3 2.8.3 5.5 0 10-3.6 10-8s-4.5-8-10-8z"/></svg>';
  bubble.setAttribute("role", "button"); bubble.setAttribute("tabindex", "0");
  bubble.setAttribute("aria-controls", "mst-panel"); bubble.setAttribute("aria-expanded", "false");
  document.body.appendChild(bubble);

  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var panel = document.createElement("div"); panel.id = "mst-panel";
  panel.innerHTML =
    '<div id="mst-head"><div><b></b><span></span></div><button type="button" id="mst-x" aria-label="閉じる">×</button></div>' +
    '<div id="mst-body" role="log"></div>' +
    '<div id="mst-foot"><input id="mst-in" placeholder="メッセージを入力…" aria-label="メッセージ" autocomplete="off"/><button type="button" id="mst-send" aria-label="送信">' + ARROW + '</button></div>' +
    '<div class="mst-pow">MASTRY合同会社</div>';
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "MASTRY サポート"); panel.setAttribute("lang", "ja");
  document.body.appendChild(panel);

  var body = panel.querySelector("#mst-body");
  var input = panel.querySelector("#mst-in");
  var closeBtn = panel.querySelector("#mst-x");
  var sendBtn = panel.querySelector("#mst-send");

  // 表示言語に合わせて枠（見出し・入力欄・ボタン名）を切り替える。回答本文は日本語のまま。
  function lab(){
    var en = isEN();
    bubble.setAttribute("aria-label", en ? "Chat with MASTRY (in Japanese)" : "チャットで質問する");
    panel.setAttribute("lang", en ? "en" : "ja");
    panel.setAttribute("aria-label", en ? "MASTRY chat" : "MASTRY サポート");
    panel.querySelector("#mst-head b").textContent = en ? "MASTRY" : "MASTRY サポート";
    panel.querySelector("#mst-head span").textContent = en ? "Questions, wholesale and press" : "ご質問・お取扱いのご相談はこちら";
    input.setAttribute("placeholder", en ? "Type a message…" : "メッセージを入力…");
    input.setAttribute("aria-label", en ? "Message" : "メッセージ");
    sendBtn.setAttribute("aria-label", en ? "Send" : "送信");
    closeBtn.setAttribute("aria-label", en ? "Close" : "閉じる");
    panel.querySelector(".mst-pow").textContent = en ? "MASTRY LLC" : "MASTRY合同会社";
  }
  lab();
  try{ new MutationObserver(lab).observe(document.documentElement, {attributes:true, attributeFilter:["lang"]}); }catch(e){}

  function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}
  function scroll(){body.scrollTop = body.scrollHeight;}
  function linkify(h){ return h.replace(/(https?:\/\/[A-Za-z0-9\-._~:\/?#@!$&+,;=%]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>'); }

  // 日本語の最後の数文字をまとめて折り返し、最終行が1文字（「い。」など）にならないようにする。URL の途中では切らない
  var URL_RE = /https?:\/\/[A-Za-z0-9\-._~:\/?#@!$&+,;=%]+/g;
  var SEG = null; try{ if(window.Intl && Intl.Segmenter) SEG = new Intl.Segmenter("ja", {granularity:"word"}); }catch(e){}
  function tail(t){
    // 語の切れ目でまとめる（Intl.Segmenter があるとき）。句読点を除いて4文字以上、10文字以内
    if(SEG){
      var segs = Array.from(SEG.segment(t)), k = 0, i = segs.length, s;
      while(i > 0){
        s = segs[i-1].segment; if(/\s/.test(s)) break;
        var c = s.replace(/[、。，．！？」』）]/g, "").length;
        if(k + c > 10) break;
        k += c; i--;
        if(k >= 4) return {index: segs[i].index, text: t.slice(segs[i].index)};
      }
    }
    return /[^\s、。，．！？」』）]{4}[、。，．！？」』）]*$/.exec(t);
  }
  function glue(t){
    var m = tail(t);
    if(m && m.text === undefined) m = {index: m.index, text: m[0]};
    if(!m || m.index === 0 || !JA_RE.test(m.text)) return linkify(esc(t));
    var end = 0, u; URL_RE.lastIndex = 0;
    while((u = URL_RE.exec(t))) end = u.index + u[0].length;
    if(end > m.index) return linkify(esc(t));
    return linkify(esc(t.slice(0, m.index))) + '<span style="white-space:nowrap">' + esc(m.text) + '</span>';
  }

  var userSpoke = false;
  function addMsg(text, who) {
    var m = document.createElement("div");
    m.className = "mst-msg " + (who === "user" ? "mst-user" : "mst-bot");
    m.setAttribute("lang", JA_RE.test(text) ? "ja" : "en");
    m.innerHTML = glue(text);
    body.appendChild(m); convo.push((who==="user"?"客: ":"Bot: ")+text); scroll();
    if (who === "user") userSpoke = true;
  }
  // キーボード操作中に押した選択肢が消えたら、次に操作できるものへフォーカスを移す
  function refocus(){
    setTimeout(function(){
      if(!panel.classList.contains("open")) return;
      var a = document.activeElement;
      if(a && a !== document.body && panel.contains(a)) return;
      var forms = body.querySelectorAll(".mst-form"), lastForm = forms[forms.length-1];
      var chip = body.querySelector(".mst-chips .mst-chip");
      var t = chip || (lastForm && lastForm.querySelector("input:not([disabled])")) || input;
      t.focus();
    }, 650);
  }
  function addChips(items) {
    [].forEach.call(body.querySelectorAll(".mst-chips"), function(e){ e.remove(); }); // 古い選択肢を消す（重複防止）
    var c = document.createElement("div"); c.className = "mst-chips";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.type = "button"; b.className = "mst-chip"; b.textContent = it.label;
      b.setAttribute("lang", JA_RE.test(it.label) ? "ja" : "en");
      b.onclick = function(){
        if(c.dataset.used) return;          // 連打・二重発火を防ぐ
        c.dataset.used = "1";
        var hadFocus = document.activeElement === b;
        addMsg(it.label, "user");           // 選んだ内容を発言として表示
        c.remove();                          // 選択肢を消す（増殖防止）
        it.fn();
        if(hadFocus) refocus();
      };
      c.appendChild(b);
    });
    body.appendChild(c); scroll();
  }
  // Enter（変換確定中は除く）でボタンを押す
  function enterTo(el, btn){
    el.addEventListener("keydown", function(e){
      if(e.key === "Enter" && !e.isComposing && e.keyCode !== 229){ e.preventDefault(); if(!btn.disabled) btn.click(); }
    });
  }
  var MAIN_CHIPS = [
    {label:"商品について", fn:function(){handle("MASTRYとは");}},
    {label:"業務用・卸の相談", fn:function(){leadForm("業務用・卸");}},
    {label:"サンプルが欲しい", fn:function(){leadForm("サンプル希望");}},
    {label:"よくある質問", fn:function(){handle("よくある質問");}}
  ];

  // ---------- matching ----------
  function norm(s){return (s||"").toLowerCase().replace(/[\s　、。！？!?．.，,・]/g,"");}
  function bigrams(s){var a=[];for(var i=0;i<s.length-1;i++)a.push(s.substr(i,2));return a;}
  function sim(a,b){var A=bigrams(norm(a)),B=bigrams(norm(b));if(!A.length||!B.length)return 0;var setB={};B.forEach(function(x){setB[x]=1;});var hit=0;A.forEach(function(x){if(setB[x])hit++;});return hit/Math.max(A.length,B.length);}

  var INTENT = ["卸","仕入","取扱","取り扱","業務用","導入","納品","ロット","サンプル","取材","メディア","協業","コラボ","ホテル","店で","バーで","レストラン"];
  function hasIntent(t){t=norm(t);return INTENT.some(function(k){return t.indexOf(norm(k))>=0;});}

  // 1文字のキーワード（「味」など）が別の語の一部（意味・甘味…）に当たらないようにする
  var KW_SKIP = /意味|甘味|趣味|興味|賞味/g;
  function kwHit(n, k){
    k = norm(k); if(!k) return false;
    return (k.length === 1 ? n.replace(KW_SKIP, "") : n).indexOf(k) >= 0;
  }
  function bestQA(t){
    // キーワード一致を先に（配列の順）。業務のご相談は従来どおり類似度で該当の回答へ。
    if(!hasIntent(t)){
      var n = norm(t);
      for(var i=0;i<QA.length;i++){
        var k = QA[i].k;
        if(k && k.some(function(w){return kwHit(n, w);})) return QA[i];
      }
    }
    var best=null,score=0;
    QA.forEach(function(x){var s=sim(t,x.q);if(s>score){score=s;best=x;}});
    return score>=0.18?best:null;
  }

  var INTERNAL = ["よくある質問","MASTRYとは"];
  function handle(text){
    if(isEN() && !JA_RE.test(text) && INTERNAL.indexOf(text) < 0){
      addMsg("Thank you. For a reply in English, please use our contact form: " + CONTACT_URL, "bot");
      return;
    }
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
        {label:"先行販売に登録する",fn:function(){signupLite();}},
        {label:"業務用・卸の相談",fn:function(){leadForm("業務用・卸");}}
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
    addChips([{label:"連絡先を入力する",fn:function(){leadForm("お問い合わせ");}}]);
  }

  function post(payload){
    return fetch("https://api.web3forms.com/submit",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload)})
      .then(function(r){return r.json();}).then(function(d){ if(!d || !d.success) throw new Error("not sent"); return d; });
  }
  function lockForm(f){ [].forEach.call(f.querySelectorAll("input,textarea,button"), function(x){ x.disabled = true; }); }
  function note(text){
    // 個人情報の利用目的とプライバシーポリシーへのリンク（URLは本文の末尾に置く）
    return '<div class="mst-note" lang="ja">' + esc(text) + '（プライバシーポリシー：<a href="' + PRIVACY_URL + '" target="_blank" rel="noopener">' + PRIVACY_URL + '</a>）</div>';
  }

  // ---------- lead capture ----------
  var TITLES = {"お問い合わせ":"お問い合わせ","サンプル希望":"サンプルのご相談","業務用・卸":"業務用・卸のご相談","取材・協業":"取材・協業のご相談"};
  function leadForm(kind){
    var f=document.createElement("div"); f.className="mst-msg mst-bot mst-form"; f.setAttribute("lang","ja");
    f.innerHTML =
      '<div style="font-weight:700;margin-bottom:4px">'+esc(TITLES[kind]||kind+'のご相談')+'</div>'+
      '<input class="mst-co" placeholder="店名・会社名（任意）" aria-label="店名・会社名（任意）"/>'+
      '<input class="mst-nm" placeholder="お名前" aria-label="お名前"/>'+
      '<input class="mst-em" placeholder="メールアドレス" aria-label="メールアドレス" type="email"/>'+
      '<input class="mst-ms" placeholder="ご用件（任意）" aria-label="ご用件（任意）"/>'+
      note("入力内容とこのチャットのやりとりは、ご連絡のために担当者へ送られます")+
      '<button type="button" class="mst-submit">送信する</button>';
    body.appendChild(f); scroll();
    var btn = f.querySelector(".mst-submit");
    [].forEach.call(f.querySelectorAll("input"), function(x){ enterTo(x, btn); });
    btn.onclick=function(){
      var co=f.querySelector(".mst-co").value.trim();
      var nm=f.querySelector(".mst-nm").value.trim();
      var em=f.querySelector(".mst-em").value.trim();
      var ms=f.querySelector(".mst-ms").value.trim();
      if(!em||!nm){addMsg("お名前とメールアドレスのご入力をお願いします。","bot");return;}
      if(!EMAIL_RE.test(em)){addMsg("メールアドレスをご確認ください。","bot");return;}
      var kb=f.contains(document.activeElement); // 無効化でフォーカスが失われるので、終わったら戻す
      btn.disabled=true; btn.textContent="送信中…";
      post({access_key:WEB3KEY,subject:"【サイトチャット】新規リード："+kind,from_name:"MASTRYサイトチャット",
        種別:kind,店名_会社名:co,お名前:nm,メール:em,ご用件:ms,会話ログ:convo.slice(-12).join("\n"),ページ:location.href})
        .then(function(){
          lockForm(f); btn.textContent="送信しました";
          track("generate_lead","chat");
          addMsg("ありがとうございます、"+nm+"様。内容を受け付けました。担当者より追ってご連絡いたします。","bot");
          if(kb) refocus();
        }).catch(function(){
          btn.disabled=false; btn.textContent="もう一度送信する";
          addMsg("送信に失敗しました。お手数ですが問い合わせフォームをご利用ください：\n"+CONTACT_URL,"bot");
          if(kb) refocus();
        });
    };
  }

  // ---------- onboarding (super simple) ----------
  function onboard(){
    if(isEN()){
      addMsg("Hello — our chat replies in Japanese for now. These pages answer in English:","bot");
      addChips([
        {label:"Reserve early access",fn:function(){location.href="/#offer";}},
        {label:"Read the FAQ",fn:function(){location.href="/faq.html";}},
        {label:"Wholesale, press or other",fn:function(){location.href="/contact.html";}}
      ]);
      return;
    }
    addMsg("こんにちは。MASTRYです。今日はどのようなご用件でしょうか。","bot");
    addChips([
      {label:"個人で飲んでみたい",fn:function(){signupLite();}},
      {label:"お店・業務用で扱いたい",fn:function(){leadForm("業務用・卸");}},
      {label:"サンプルが欲しい",fn:function(){leadForm("サンプル希望");}},
      {label:"取材・コラボ",fn:function(){leadForm("取材・協業");}},
      {label:"まず質問したい",fn:function(){handle("よくある質問");}}
    ]);
  }
  function signupLite(){
    addMsg("ありがとうございます。発売・先行販売のご案内をいちばんにお届けします。メールアドレスをご入力ください。","bot");
    var f=document.createElement("div"); f.className="mst-msg mst-bot mst-form"; f.setAttribute("lang","ja");
    f.innerHTML='<input class="mst-em2" placeholder="メールアドレス" aria-label="メールアドレス" type="email"/>'+
      note("ご登録のメールアドレスは、発売・先行販売のご案内に使います")+
      '<button type="button" class="mst-sub2">先行販売に登録する</button>';
    body.appendChild(f); scroll();
    var btn=f.querySelector(".mst-sub2"), emIn=f.querySelector(".mst-em2");
    enterTo(emIn, btn);
    btn.onclick=function(){
      var em=emIn.value.trim();
      if(!EMAIL_RE.test(em)){addMsg("メールアドレスをご確認ください。","bot");return;}
      var kb=f.contains(document.activeElement); // 無効化でフォーカスが失われるので、終わったら戻す
      btn.disabled=true; btn.textContent="送信中…";
      post({access_key:WEB3KEY,subject:"【サイトチャット】先行登録",from_name:"MASTRYサイトチャット","種別":"先行登録(個人)","メール":em,"ページ":location.href})
        .then(function(){
          lockForm(f); btn.textContent="登録しました";
          track("sign_up","chat");
          addMsg("ご登録ありがとうございます。初回ロットの準備が整いしだい、いちばんにご案内いたします。","bot");
          fmNumber(em); setTimeout(function(){askWhy(em);},500);
          if(kb) refocus();
        })
        .catch(function(){
          btn.disabled=false; btn.textContent="もう一度送信する";
          addMsg("送信に失敗しました。お手数ですが問い合わせフォームをご利用ください：\n"+CONTACT_URL,"bot");
          if(kb) refocus();
        });
    };
  }

  // 先行登録番号: 台帳(Registrants_v1)へ即時採番して通知
  var FM_API="https://script.google.com/macros/s/AKfycbwBEWufURy4YB8Y2wdKk9oAkA0eXkWyEGODhhqToEXKpxMriam5NuEcfYCvD7fatkRvJg/exec";
  function fmNumber(em){
    fetch(FM_API+"?action=reg&email="+encodeURIComponent(em))
      .then(function(r){return r.json();})
      .then(function(j){
        if(j&&j.ok&&j.no){
          var num="No."+String(j.no).padStart(3,"0");
          addMsg("あなたの先行登録番号は "+num+" です。この番号順に、初回ロットをご案内します。","bot");
        }
      }).catch(function(){});
  }

  // PMF質問: 登録後ワンタップ(任意)
  function askWhy(em){
    addMsg("最後にひとつだけ——何に一番惹かれましたか？（タップでOK）","bot");
    function sendWhy(v){
      fetch("https://api.web3forms.com/submit",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({access_key:WEB3KEY,subject:"【サイトチャット】惹かれた点",from_name:"MASTRYサイトチャット","メール":em,"惹かれた点":v,"ページ":location.href})}).catch(function(){});
      addMsg("ありがとうございます。とても参考になります。","bot");
    }
    addChips([
      {label:"マスティハの希少性",fn:function(){sendWhy("マスティハの希少性");}},
      {label:"ノンアル0.00%",fn:function(){sendWhy("ノンアル0.00%");}},
      {label:"砂糖・甘味料不使用",fn:function(){sendWhy("砂糖・甘味料不使用");}},
      {label:"デザイン・ギフト",fn:function(){sendWhy("デザイン・ギフト");}},
      {label:"その他",fn:function(){sendWhy("その他");}}
    ]);
  }

  // ---------- send ----------
  function send(){
    var t=input.value.trim(); if(!t)return; input.value="";
    [].forEach.call(body.querySelectorAll(".mst-chips"), function(e){ e.remove(); }); // 入力時も古い選択肢を消す
    addMsg(t,"user");
    setTimeout(function(){handle(t);},250);
  }
  sendBtn.onclick=send;
  // 日本語入力の変換確定の Enter では送らない
  input.addEventListener("keydown",function(e){ if(e.key==="Enter"&&!e.isComposing&&e.keyCode!==229){ e.preventDefault(); send(); } });

  // ---------- open/close ----------
  var greeted=false, greetedEN=null;
  function open(){
    lab();
    // 何も話していないうちに表示言語が変わっていたら、その言語で案内し直す
    if(greeted && !userSpoke && greetedEN !== isEN()){ body.innerHTML=""; convo=[]; greeted=false; }
    panel.classList.add("open");
    bubble.setAttribute("aria-expanded","true");
    var bd=document.getElementById("mst-badge"); if(bd)bd.style.display="none";
    if(!greeted){greeted=true; greetedEN=isEN(); onboard();}
  }
  function close(){
    panel.classList.remove("open");
    bubble.setAttribute("aria-expanded","false");
    bubble.focus();
  }
  bubble.onclick=function(){ panel.classList.contains("open")?close():open(); };
  bubble.onkeydown=function(e){
    if(e.key==="Enter"||e.key===" "){
      e.preventDefault();
      var wasOpen = panel.classList.contains("open");
      bubble.onclick();
      if(!wasOpen) setTimeout(function(){ (panel.querySelector(".mst-chip")||input).focus(); },300);
    }
  };
  closeBtn.onclick=close;
  // 開いたまま表示言語が切り替わった場合も、まだ何も話していなければ案内し直す
  try{ new MutationObserver(function(){ if(panel.classList.contains("open") && greeted && !userSpoke && greetedEN !== isEN()) open(); })
    .observe(document.documentElement, {attributes:true, attributeFilter:["lang"]}); }catch(e){}
  panel.addEventListener("keydown",function(e){ if((e.key==="Escape"||e.key==="Esc")&&!e.isComposing){ e.preventDefault(); close(); } });

  // チャット操作中はサイトのカスタムカーソル(リング/ドット)を隠す（カーソルのちらつき防止）
  function mstHideCur(h){[".cursor",".cursor-dot"].forEach(function(s){var e=document.querySelector(s);if(e)e.style.opacity=h?"0":"";});}
  [bubble,panel].forEach(function(el){
    el.addEventListener("mouseenter",function(){mstHideCur(true);});
    el.addEventListener("mouseleave",function(){mstHideCur(false);});
  });
})();

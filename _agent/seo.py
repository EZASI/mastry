# -*- coding: utf-8 -*-
"""Inject SEO/OpenGraph/Twitter/canonical/JSON-LD into all pages; write robots.txt + sitemap.xml."""
import glob, os, json

SITE='https://mastry.jp'
OG=SITE+'/assets/og.jpg'
TODAY='2026-06-04'

# key -> (title, description(JP), path)
PAGES={
 'index':('MASTRY — 木の涙 · Tears of the Tree','MASTRY（マストライ）— ギリシャ・ヒオス島の希少なマスティハと日本のやわらかな湧水から生まれた、プレミアム・ノンアルコール・スパークリングウォーター。糖類ゼロ。','/'),
 'about':('私たちについて｜MASTRY','MASTRYのブランドストーリー。「木の涙」＝ヒオス島のマスティハと日本の湧水が出会う、静けさのための一杯。','/about.html'),
 'sustainability':('サステナビリティ｜MASTRY','MASTRYのサステナビリティ。PDO認証のヒオス島マスティハ、責任ある水源、無糖・無添加、ガラス容器。','/sustainability.html'),
 'press':('プレス｜MASTRY','MASTRYのプレス・メディア向け情報とブランド概要。取材のお問い合わせはこちら。','/press.html'),
 'faq':('よくある質問｜MASTRY','MASTRYのFAQ。マスティハとは、味わい、ノンアルコール、原材料・アレルゲン、提供方法など。','/faq.html'),
 'shipping':('配送・返品｜MASTRY','MASTRYの配送・返品ポリシー（オンラインストアは準備中）。','/shipping.html'),
 'privacy':('プライバシーポリシー｜MASTRY','MASTRY合同会社のプライバシーポリシー。個人情報の取り扱いについて。','/privacy.html'),
 'terms':('利用規約｜MASTRY','MASTRYウェブサイトの利用規約。','/terms.html'),
 'tokushoho':('特定商取引法に基づく表記｜MASTRY','MASTRY合同会社 特定商取引法に基づく表記。','/tokushoho.html'),
 'cookies':('Cookieポリシー｜MASTRY','MASTRYのCookieポリシー。当サイトのCookie・Google Analyticsの利用について。','/cookies.html'),
 'contact':('お問い合わせ｜MASTRY','MASTRYへのお問い合わせ。一般・業務用/卸・取材・協業などの種別からお選びください。','/contact.html'),
}

LD=[
 {"@context":"https://schema.org","@type":"Organization","name":"MASTRY","legalName":"MASTRY合同会社","url":SITE,"logo":OG,"image":OG,
  "description":"ギリシャ・ヒオス島のマスティハと日本の湧水から生まれたプレミアム・ノンアルコール・スパークリングウォーター。",
  "email":"hello@mastry.jp","sameAs":["https://line.me/R/ti/p/@469dufhi"],
  "address":{"@type":"PostalAddress","streetAddress":"2762-121 Narachō, Aoba-ku","addressLocality":"Yokohama","addressRegion":"Kanagawa","postalCode":"227-0036","addressCountry":"JP"}},
 {"@context":"https://schema.org","@type":"WebSite","name":"MASTRY","url":SITE,"inLanguage":["ja","en"]},
]

def esc(s): return s.replace('&','&amp;').replace('"','&quot;').replace('<','&lt;').replace('>','&gt;')

def head_block(key,title,desc,path,is_index):
    url=SITE+('/' if is_index else path)
    b=[]
    b.append(f'<link rel="canonical" href="{url}" />')
    b.append('<meta property="og:type" content="website" />')
    b.append('<meta property="og:site_name" content="MASTRY" />')
    b.append(f'<meta property="og:title" content="{esc(title)}" />')
    b.append(f'<meta property="og:description" content="{esc(desc)}" />')
    b.append(f'<meta property="og:url" content="{url}" />')
    b.append(f'<meta property="og:image" content="{OG}" />')
    b.append('<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />')
    b.append('<meta property="og:locale" content="ja_JP" /><meta property="og:locale:alternate" content="en_US" />')
    b.append('<meta name="twitter:card" content="summary_large_image" />')
    b.append(f'<meta name="twitter:title" content="{esc(title)}" />')
    b.append(f'<meta name="twitter:description" content="{esc(desc)}" />')
    b.append(f'<meta name="twitter:image" content="{OG}" />')
    if is_index:
        b.append('<script type="application/ld+json">'+json.dumps(LD,ensure_ascii=False)+'</script>')
    return '\n'.join(b)

ANCHOR='<meta name="theme-color" content="#ffffff" />'
changed=[]
for f in glob.glob('*.html'):
    key=f[:-5]
    if key not in PAGES: continue
    s=open(f,encoding='utf-8').read()
    if 'og:title' in s:
        changed.append(f+'(already)'); continue
    title,desc,path=PAGES[key]; is_index=(key=='index')
    blk=head_block(key,title,desc,path,is_index)
    # add meta description if missing
    if 'name="description"' not in s:
        blk=f'<meta name="description" content="{esc(desc)}" />\n'+blk
    if ANCHOR in s:
        s=s.replace(ANCHOR, ANCHOR+'\n'+blk, 1)
    else:
        s=s.replace('</title>', '</title>\n'+blk, 1)
    open(f,'w',encoding='utf-8').write(s); changed.append(f+'(+seo)')

# robots.txt
open('robots.txt','w').write("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n"%SITE)
# sitemap.xml
urls=''.join(f'  <url><loc>{SITE+("/" if k=="index" else v[2])}</loc><lastmod>{TODAY}</lastmod><changefreq>weekly</changefreq><priority>{"1.0" if k=="index" else "0.7"}</priority></url>\n' for k,v in PAGES.items())
open('sitemap.xml','w',encoding='utf-8').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls+'</urlset>\n')

print('SEO injected:', ', '.join(sorted(changed)))
print('wrote robots.txt + sitemap.xml ('+str(len(PAGES))+' urls)')

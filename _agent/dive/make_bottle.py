# Builds the Dive's bottle textures from the brand's hero render.
#   in : ../src/hero-orig.png (633x951), hero-mask.png (macOS Vision subject mask, see lift.swift)
#   out: bottle-n.png   RGB  = photo divided by the studio backdrop (x0.75 headroom): glass → transmission, label/cap → reflectance
#        bottle-m.png   R = silhouette, G = opaque parts (label, cap), B = rim (1 at the glass edge → 0 inside)
#   both 512x2048 (power of two, so WebGL1 can mipmap); the bottle sits in the UV rect printed at the end.
import numpy as np, json
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter, gaussian_filter1d, distance_transform_edt, binary_erosion, median_filter

P=np.asarray(Image.open('../src/hero-orig.png').convert('RGB')).astype(np.float32)/255
M=np.asarray(Image.open('hero-mask.png').convert('L')).astype(np.float32)/255
H,W=M.shape
ys,xs=np.where(M>0.5); x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
cx=(x0+x1)/2

# --- backdrop: per-row median of the clean left backdrop, smoothed down the image
strip=P[:,30:150,:]
ok=(M[:,30:150]<0.02)
Wy=np.zeros((H,3),np.float32)
for y in range(H):
    px=strip[y][ok[y]] if ok[y].sum()>20 else strip[y]
    Wy[y]=np.percentile(px,60,axis=0)           # slightly above the median: droplets and haze are darker than the backdrop
Wy=gaussian_filter1d(Wy,18,axis=0,mode='nearest')
N=np.clip(P/np.maximum(Wy[:,None,:],1e-3),0,1.33)

# --- tidy the silhouette: symmetric, smooth profile; flat-ish base
Mb=M>0.5
prof=np.zeros(H,np.float32)
for y in range(y0,y1+1):
    r=np.where(Mb[y])[0]
    if len(r): prof[y]=max(cx-r.min(),r.max()-cx)+0.5
base=int(np.max(np.where(prof>60)[0]))            # last row that is still the body
# the Vision mask picks up a little contact shadow under the base: cut where the width starts collapsing unevenly
yb=y1
for y in range(y1,y1-40,-1):
    r=np.where(Mb[y])[0]
    if len(r) and (r.max()-r.min())>0.90*(2*prof[base-30]): yb=y; break
prof_s=prof.copy(); prof_s[y0:yb+1]=gaussian_filter1d(prof[y0:yb+1],1.6,mode='nearest')
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
half=prof_s[np.clip(yy.astype(int),0,H-1)]
# rounded base: the last 14 rows curve in
rb=14.0
t=np.clip((yy-(yb-rb))/rb,0,1)
half_b=half-(1-np.sqrt(np.clip(1-t*t,0,1)))*9.0
sd=half_b-np.abs(xx-cx)                           # signed distance-ish across the bottle (px, + inside)
S=np.clip(sd+0.5,0,1)*(yy>=y0-0.5)*(yy<=yb+0.5)
S=gaussian_filter(S,0.6)
inside=S>0.5

# --- label: paper is the least blue thing on the bottle; fit straight-ish top and bottom edges per column
blue=gaussian_filter(P[...,2]-P[...,0],2.0)
tops=[];bots=[];cols=[]
for x in range(int(cx-100),int(cx+101),4):
    col=blue[:,x]
    d=np.diff(gaussian_filter1d(col,2))
    t_=420+int(np.argmin(d[420:480])); b_=735+int(np.argmax(d[735:790]))
    tops.append(t_);bots.append(b_);cols.append(x)
cols=np.array(cols,np.float32); tops=np.array(tops,np.float32); bots=np.array(bots,np.float32)
kt=np.polyfit(cols-cx,tops,2); kb=np.polyfit(cols-cx,bots,2)
print('label top fit',kt.round(5),'bottom fit',kb.round(5),'median top',np.median(tops),'median bottom',np.median(bots))
ltop=np.polyval(kt,xx-cx); lbot=np.polyval(kb,xx-cx)
LBL=np.clip(yy-ltop+0.5,0,1)*np.clip(lbot-yy+0.5,0,1)*S

# --- cap: the knurled metal ends where the neck glass starts (brightness texture → find the row where blueness returns)
rowb=np.array([blue[y,int(cx-18):int(cx+18)].mean() for y in range(H)])
rowv=np.array([P[y,int(cx-18):int(cx+18)].mean() for y in range(H)])
print('cap rows (y: blue, value):',' '.join('%d:%.2f/%.2f'%(y,rowb[y],rowv[y]) for y in range(34,140,6)))

CAP=np.clip(103.5-yy+0.5,0,1)*S
OPQ=np.clip(LBL+CAP,0,1)
# rim: 1 at the glass edge, falling to 0 over 22% of the local half-width (used for edge light under water)
RIM=np.clip(1-sd/np.maximum(half_b*0.22,1.0),0,1)*S

# --- crop, upscale x2, place into 512x2048
pad=6
cx0,cx1,cy0,cy1=int(np.floor(cx-prof_s.max()))-pad,int(np.ceil(cx+prof_s.max()))+pad,y0-pad,yb+pad
def crop(a): return a[cy0:cy1+1,cx0:cx1+1]
def up(a,mode=Image.LANCZOS):
    im=Image.fromarray(np.clip(a*255,0,255).astype(np.uint8))
    return im.resize((im.width*2,im.height*2),mode)
Nn=up(crop(N)*0.75).filter(ImageFilter.UnsharpMask(radius=1.4,percent=55,threshold=2))
Mm=np.dstack([np.asarray(up(crop(c),Image.BICUBIC)) for c in (S,OPQ,RIM)])
w,h=Nn.size
TW,TH=512,2048
assert w<=TW and h<=TH,(w,h)
ox,oy=(TW-w)//2,(TH-h)//2
# extend edge colours outwards so mip levels do not bleed black into the bottle
Nfull=np.asarray(Nn).astype(np.uint8)
canvasN=np.zeros((TH,TW,3),np.uint8); canvasN[...]=Nfull.reshape(-1,3).mean(0).astype(np.uint8)
canvasN[oy:oy+h,ox:ox+w]=Nfull
canvasM=np.zeros((TH,TW,3),np.uint8); canvasM[oy:oy+h,ox:ox+w]=Mm
Image.fromarray(canvasN).save('bottle-n.png'); Image.fromarray(canvasM).save('bottle-m.png')
meta={'tex':[TW,TH],'rect':[ox,oy,w,h],'bottle_px':[int(2*(2*prof_s.max())),int(2*(yb-y0+1))],
      'axis_u':(ox+2*(cx-cx0))/TW,'base_v':1-(oy+2*(yb-cy0))/TH,'top_v':1-(oy+2*(y0-cy0))/TH,
      'label_v':[1-(oy+2*(float(np.median(bots))-cy0))/TH,1-(oy+2*(float(np.median(tops))-cy0))/TH],
      'aspect':float((2*prof_s.max())/(yb-y0+1))}
json.dump(meta,open('bottle.json','w'),indent=1); print(json.dumps(meta))

# --- preview: the planned shading over three grounds
def comp(bg,light,amb=1.0,glow=0.0):
    n=N/1.0; s=S[...,None]; o=OPQ[...,None]; r=RIM[...,None]
    T=np.clip(n,0,1)**1.15
    hi=np.clip(n-1.0,0,1)*2.2
    glass=bg*T+hi*light+r*0.10*light*(1-amb+0.25)
    glass=glass+glow*np.array([0.75,0.9,1.0])*np.exp(-((xx-cx)/60.0)**2)[...,None]*0.35*(1-o)
    opaque=np.clip(n,0,1.2)*light*amb+glow*np.array([0.9,0.95,1.0])*0.25
    return bg*(1-s)+(glass*(1-o)+opaque*o)*s
g=np.linspace(0,1,H)[:,None,None]
sky=(1-g)*np.array([0.62,0.78,0.96])+g*np.array([0.95,0.97,0.99]); sky=np.repeat(sky,W,1)
mid=(1-g)*np.array([0.06,0.30,0.66])+g*np.array([0.02,0.12,0.36]); mid=np.repeat(mid,W,1)
deep=(1-g)*np.array([0.010,0.040,0.110])+g*np.array([0.003,0.010,0.035]); deep=np.repeat(deep,W,1)
a=comp(sky,np.array([1,1,1.0]),1.0)
b=comp(mid,np.array([0.55,0.80,1.0]),0.62)
c=comp(deep,np.array([0.30,0.50,0.85]),0.20,glow=1.0)
sheet=np.concatenate([a,b,c],1)[cy0-10:cy1+10]
Image.fromarray(np.clip(sheet*255,0,255).astype(np.uint8)).save('bottle_preview.jpg',quality=88)
print('preview',sheet.shape)

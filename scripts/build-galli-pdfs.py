"""Rebuild the authored Galli Club products. No remote services or catalogue data.

Requires reportlab, Pillow and pypdf. Outputs are checked into the private repo;
only the free kit and preview belong in dist. Layout overflow fails the build.
"""
from pathlib import Path
import json
import html
from io import BytesIO
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'dist/galli-club'
PRODUCT = ROOT / 'products/galli-club'
DOWNLOADS = PUBLIC / 'downloads'
DOWNLOADS.mkdir(parents=True, exist_ok=True)
PACK = json.loads((PRODUCT / 'pack.json').read_text())
FREE = json.loads((PUBLIC / 'adventure.json').read_text())
FONTS = Path('/usr/share/fonts/truetype/dejavu')
for name, file in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf'),('Story','DejaVuSerif.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / file)))
W,H = A4
M=43
INK=HexColor('#202555'); BLUE=HexColor('#303dc9'); MUTED=HexColor('#555a74'); LINE=HexColor('#d8d8e4')
YELLOW=HexColor('#ffdb60'); PINK=HexColor('#f4bdd2'); LILAC=HexColor('#dad1fb')
styles={
    'body':ParagraphStyle('body',fontName='Body',fontSize=11,leading=16,textColor=INK,spaceAfter=8),
    'small':ParagraphStyle('small',fontName='Body',fontSize=9,leading=13,textColor=MUTED),
    'story':ParagraphStyle('story',fontName='Story',fontSize=12.7,leading=19,textColor=INK),
    'bold':ParagraphStyle('bold',fontName='Bold',fontSize=11,leading=16,textColor=BLUE),
    'title':ParagraphStyle('title',fontName='Bold',fontSize=29,leading=34,textColor=INK),
}

def clean(text):
    return html.escape(str(text).replace('–','-').replace('—','-').replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"'))

class Book:
    def __init__(self,path,title):
        self.path=path; self.c=canvas.Canvas(str(path),pagesize=A4,invariant=1)
        self.c.setTitle(title); self.c.setAuthor('Galli Club / Animesh Jain'); self.page=0; self.y=H-M
    def new(self,label):
        if self.page: self.c.showPage()
        self.page+=1; self.c.setFillColor(INK); self.c.setFont('Bold',15); self.c.drawString(M,H-M,'galli club')
        self.c.setFont('Body',8); self.c.setFillColor(MUTED); self.c.drawRightString(W-M,H-M,label.upper())
        self.c.setStrokeColor(LINE); self.c.line(M,H-M-15,W-M,H-M-15)
        self.c.setFont('Body',8); self.c.drawString(M,25,'Galli Club / Hyderabad at Home / Family playtest edition')
        self.c.drawRightString(W-M,25,str(self.page)); self.y=H-M-42
    def text(self,text,style='body',gap=10,x=M,width=None):
        p=Paragraph(clean(text),styles[style]); _,height=p.wrap(width or W-2*M,H)
        if self.y-height<49: raise ValueError(f'Page {self.page} overflows at {text[:50]}')
        p.drawOn(self.c,x,self.y-height); self.y-=height+gap
    def title(self,text,kicker=None):
        if kicker:self.text(kicker,'bold',gap=8)
        self.text(text,'title',gap=20)
    def panel(self,label,body):
        self.text(label,'bold',gap=4);self.text(body,'body',gap=13)
    def save(self):self.c.save()

def cover(book,free=False):
    book.new('Ages 3-7 / Adult-led play')
    book.title("Piku's missing postcard" if free else PACK['title'])
    book.text('A little Charminar adventure, right where you are.' if free else 'Three little adventures. One very big imagination.','story',gap=20)
    # Embed a compressed JPEG stream rather than a multi-megabyte decoded bitmap.
    encoded=BytesIO()
    Image.open(PUBLIC/'assets/hyderabad-at-home.webp').convert('RGB').save(encoded,format='JPEG',quality=84)
    encoded.seek(0)
    image=ImageReader(encoded)
    iw=W-2*M; ih=iw*2/3
    book.c.drawImage(image,M,book.y-ih,width=iw,height=ih,mask='auto');book.y-=ih+16
    book.text('An imaginary home-built city, inspired by Hyderabad. Illustration is not an architectural guide.','small',gap=18)
    book.panel('Your entire packing list','Paper, a pencil or crayons, and a grown-up to play along. No special kit, printer, water, food, scissors or tiny craft pieces required.')
    book.text('English stories with short optional Hinglish prompts. Choose the quiet option when a baby is asleep. Every mission can be played seated.','body')
    book.text('Read a little. Put the page down. Follow your child.','bold')

def guide(book):
    book.new('Start here');book.title('The grown-up cheat sheet')
    for label,body in [
        ('Before you begin','Choose a clear, comfortable spot. Gather two whole sheets and crayons. You can draw the play pages by hand; a printer is optional. Keep materials and scraps away from younger siblings.'),
        ('How to use a mission','Read the opening, do the first two play steps, then read the middle. Try the next step, read the twist, and decide what happens together. Finish with the ending only if your child wants to.'),
        ('For ages 3-4','You do the reading and writing. Pointing, moving a finger, telling you what to draw, or making a few marks all count. Use one or two choices instead of an open-ended question.'),
        ('For ages 5-7','Invite your child to make a rule, change the story, explain a choice, or take the grown-up role. These are suggestions, not a test or a developmental target.'),
        ('The quiet way','Choose the silent gestures and tabletop options. No echo experiment, loud clapping or background audio is required. Quiet mode cannot promise a quiet child; adapt it to your family.'),
        ('No printer? No problem.','Draw four boxes for the post office, three boxes for the secret signal, or an oval for the lake. Keep sheets whole and use a fingertip as a game piece. The child’s drawings are the keepsake.'),
        ('Permission to stop','A suggested 20-30 minutes is an estimate, not a target. Stop after five good minutes, skip a step, or turn the pigeon into a dinosaur. You do not need to finish the pack.'),
        ('A note on story and fact','These places exist, but the characters, codes and plots are invented. The small city facts and primary sources appear on each mission’s story page. This is at-home play, not a guide to visiting monuments.')
    ]: book.panel(label,body)

def mission_story(book,m,number):
    book.new(f'Adventure {number} / Read together');book.title(m['title'],m['place'])
    for label,key in [('THE INVITATION','opening'),('ONCE YOU HAVE STARTED','middle'),('A LITTLE TWIST','twist'),('WHEN YOU ARE READY TO FINISH','ending')]:
        book.text(label,'bold',gap=3);book.text(m[key],'story',gap=13)
    book.text('A LITTLE HINGLISH','bold',gap=3);book.text(m['hinglish'],'body',gap=12)
    book.text('REAL CITY / PRETEND STORY','bold',gap=3);book.text(m['fact'],'small',gap=4);book.text(m['source'],'small',gap=0)

def mission_play(book,m,number):
    book.new(f'Adventure {number} / Play guide');book.title('Now, make it yours.',m['title'])
    book.text(m['materials'],'small',gap=15)
    for i,step in enumerate(m['steps'],1):book.panel(f'{i:02d}  {step["title"]}',step['body'])
    book.text('AGES 3-4: '+m['little'],'small',gap=8)
    book.text('AGES 5-7: '+m['big'],'small',gap=8)
    book.text('QUIET PLAY: '+m['quiet'],'small',gap=8)

def rounded(c,x,y,w,h):
    c.setStrokeColor(INK);c.setLineWidth(1.1);c.roundRect(x,y,w,h,12,stroke=1,fill=0)

def worksheet(book,m,number):
    book.new(f'Adventure {number} / Make-and-keep page'); c=book.c
    if m['worksheet']=='doors':
        book.title('Four doors. Many friends.');book.text('Colour or label the doors. Invent a neighbour for each. Trace each delivery with a fingertip. Leave the page whole.','body',gap=15)
        top=book.y-170
        for i,(label,colour) in enumerate([('RED DOOR',PINK),('BLUE DOOR',LILAC),('YELLOW DOOR',YELLOW),('GREEN DOOR',HexColor('#d3e8d7'))]):
            x=M+(i%2)*270;y=top-(i//2)*200
            rounded(c,x,y,240,170);c.setFont('Bold',10);c.setFillColor(INK);c.drawString(x+15,y+145,label)
            c.setFont('Body',9);c.drawString(x+15,y+20,'Who lives here? Draw or tell a grown-up.')
        book.y=top-200-25;book.panel('The fifth letter has no colour.','Where will it go? Tell the story or draw another door below.')
        c.setStrokeColor(LINE);c.line(M,85,W-M,85)
    elif m['worksheet']=='signal':
        book.title('Our secret hello');book.text('Draw one comfortable action in each box. Point and play from left to right. Try one or two boxes first if three feels too much.','body',gap=25)
        y=book.y-170
        for i in range(3):
            x=M+i*174;rounded(c,x,y,160,170);c.setFont('Bold',13);c.setFillColor(BLUE);c.drawString(x+15,y+143,str(i+1))
        book.y=y-25;book.panel('A visitor wants a different hello.','Invent an alternative code. Every gesture is optional. Waves, nods and pointing can all be silent.')
        y=book.y-160
        for i in range(3):rounded(c,M+i*174,y,160,160)
        book.y=y-25;book.text('Our code means: ____________________________________________','body')
        book.text('Who would you like to welcome? ______________________________','body')
    else:
        book.title('A neighbourhood for everyone');book.text('Make a pretend lake. Add a place to rest, a place to play and a place to meet. Draw paths with room for the neighbours in your story.','body',gap=20)
        y=book.y-375;rounded(c,M,y,W-2*M,375);c.setStrokeColor(BLUE);c.setLineWidth(1.2);c.ellipse(M+145,y+125,W-M-145,y+245,stroke=1,fill=0)
        c.setFont('Body',10);c.setFillColor(MUTED);c.drawCentredString(W/2,y+183,'Our pretend lake')
        book.y=y-25;book.panel('A wish for our little neighbourhood','________________________________________________________')
        book.text('Our invented place name: ____________________________________','body')
        book.text('A paper game only. No water, real-world route or boat needed.','small')

def passport(book):
    book.new('The keepsake');book.title('My little Hyderabad passport')
    book.text('Explorer name: ______________________________________________','body',gap=25)
    for title,prompt in [('CHARMINAR','A neighbour I invented...'),('GOLCONDA','A hello that made someone welcome...'),('HUSSAIN SAGAR','Something I changed for a friend...')]:
        book.text(title,'bold',gap=3);book.text(prompt,'body',gap=6)
        rounded(book.c,M,book.y-88,W-2*M,88);book.y-=110
    book.text('No stamps to earn and no boxes to finish. Draw, dictate, or leave space for another day.','small')
    book.text('Replay ideas: swap neighbours, invent a sleepy signal, or revisit the lake in pretend rain. Household use; classroom/commercial editions need separate permission.','small')

full=PRODUCT/'hyderabad-at-home.pdf'
book=Book(full,'Galli Club - Hyderabad at Home');cover(book);guide(book)
for number,mission in enumerate(PACK['missions'],1):mission_story(book,mission,number);mission_play(book,mission,number);worksheet(book,mission,number)
passport(book);book.save()

free=Book(DOWNLOADS/'pikus-postcard.pdf',"Galli Club - Piku's missing postcard");cover(free,True)
free.new('Free adventure / Read and play');free.title('Help Piku make a postcard')
for i,step in enumerate(FREE['steps']):
    free.text(f'{i+1:02d}  '+step['title'],'bold',gap=3)
    free.text(step['read'].replace('{name}','Captain'),'story',gap=5)
    free.text(step['do'],'small',gap=12)
free.new('Free adventure / Grown-up cues');free.title('Make it fit your child')
for step in FREE['steps']:
    free.text(step['label'],'bold',gap=4);free.text('3-4: '+step['little'],'body',gap=5);free.text('5-7: '+step['big'],'body',gap=10)
free.text('QUIET WAY: whisper, point, or draw together. A nod or a silent wave can stand in for speaking. Every stage works seated.','small',gap=10)
free.text('A LITTLE HINGLISH: '+FREE['steps'][0]['hinglish'].replace('{name}','Captain'),'small',gap=10)
free.text(FREE['fact']+' '+FREE['fiction'],'small',gap=4);free.text(FREE['source'],'small')
free.new('Free adventure / Your postcard');free.title('Greetings from my Hyderabad!')
free.text('Make four tall marks, borrow a colour, and add one wonderfully made-up thing. A grown-up can draw while you tell the story.','body',gap=20)
rounded(free.c,M,230,W-2*M,360);free.y=205
free.text('My picture is called: _________________________________________','body',gap=20)
free.text('A postcard for: ______________________________________________','body',gap=20)
free.text('Made by: __________________________________________________','body',gap=20)
free.text('Piku says: a lopsided postcard can hold a very good story.','story');free.save()

preview=PdfWriter();reader=PdfReader(full)
for index in [0,3,4]:preview.add_page(reader.pages[index])
preview.add_metadata({'/Title':'Galli Club - Actual pages from Hyderabad at Home','/Author':'Galli Club / Animesh Jain'})
with (DOWNLOADS/'pack-preview.pdf').open('wb') as f:preview.write(f)
for path,count in [(full,12),(DOWNLOADS/'pikus-postcard.pdf',4),(DOWNLOADS/'pack-preview.pdf',3)]:
    reader=PdfReader(path)
    assert len(reader.pages)==count,(path,len(reader.pages))
    assert all((p.extract_text() or '').strip() for p in reader.pages)
    print(f'{path.relative_to(ROOT)}: {count} pages, {path.stat().st_size:,} bytes')

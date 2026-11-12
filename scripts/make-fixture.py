"""Generate a synthetic design screenshot. No external assets or customer data."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

image = Image.new("RGB", (1200, 800), "#f7f4ee")
draw = ImageDraw.Draw(image)

def font(size, bold=False):
    names = ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
             "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)

draw.rectangle((0, 0, 1200, 88), fill="#fffdf8")
draw.text((52, 27), "ATLAS / COFFEE", font=font(27, True), fill="#27372d")
draw.text((655, 32), "Our coffee       Our story       Visit us", font=font(18), fill="#364238")
draw.rounded_rectangle((1045, 23, 1148, 64), 20, fill="#27372d")
draw.text((1073, 33), "Shop", font=font(17), fill="white")
draw.text((64, 150), "SLOW MORNINGS. GOOD COFFEE.", font=font(16, True), fill="#64715c")
draw.text((58, 200), "Make room\nfor a better\nmorning.", font=font(66, True), fill="#27372d", spacing=3)
draw.text((64, 470), "Thoughtfully roasted. Beautifully simple.\nYour everyday ritual, made a little better.", font=font(22), fill="#626759", spacing=10)
draw.rounded_rectangle((64, 572, 299, 630), 29, fill="#27372d")
draw.text((94, 588), "Find your blend   >", font=font(21), fill="white")
draw.rounded_rectangle((630, 135, 1144, 664), 14, fill="#d7ddce")
draw.ellipse((704, 532, 1072, 610), fill="#bdc6b2")
draw.rounded_rectangle((813, 249, 1014, 550), 11, fill="#b67c46")
draw.polygon([(813, 249), (844, 212), (1000, 212), (1014, 249)], fill="#c79765")
draw.rectangle((838, 311, 990, 475), fill="#fbf6e8")
draw.text((860, 333), "ATLAS", font=font(30, True), fill="#27372d")
draw.text((859, 380), "Everyday\nBlend", font=font(21), fill="#27372d", spacing=5)
draw.text((861, 445), "250 g", font=font(14), fill="#626759")
draw.ellipse((687, 454, 815, 568), fill="#fffaf0")
draw.ellipse((702, 466, 800, 533), fill="#74472d")
draw.ellipse((712, 472, 789, 519), fill="#a4784c")
draw.rectangle((0, 716, 1200, 800), fill="#e8eadf")
draw.text((100, 749), "Freshly roasted", font=font(20), fill="#364238")
draw.text((454, 749), "Responsibly sourced", font=font(20), fill="#364238")
draw.text((881, 749), "Delivered to you", font=font(20), fill="#364238")
target = Path(__file__).parent / "fixtures" / "design.png"
target.parent.mkdir(exist_ok=True)
image.save(target, optimize=True)
print(target)

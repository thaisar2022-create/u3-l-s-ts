import zlib
import struct
import math
import os

def create_png(width, height, draw_fn, filename):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = draw_fn(x, y, width, height)
            raw_data.extend([r, g, b, a])
    
    def chunk(tag, data):
        return (
            struct.pack('>I', len(data)) +
            tag +
            data +
            struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
        )
    
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    idat_data = zlib.compress(bytes(raw_data), 9)
    
    png_bytes = (
        b'\x89PNG\r\n\x1a\n' +
        chunk(b'IHDR', ihdr_data) +
        chunk(b'IDAT', idat_data) +
        chunk(b'IEND', b'')
    )
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png_bytes)
    print(f"Created {filename} ({len(png_bytes)} bytes)")

def draw_logo(x, y, w, h):
    # Normalized coords (-1 to 1)
    nx = (x - w / 2) / (w / 2)
    ny = (y - h / 2) / (h / 2)
    dist = math.sqrt(nx * nx + ny * ny)
    
    if dist > 0.98:
        # Anti-aliasing edge
        if dist > 1.0:
            return 0, 0, 0, 0
        alpha = int(255 * (1.0 - dist) / 0.02)
        return 77, 16, 96, alpha

    # Radial gradient purple background
    # Dark purple (#3b094e) to rich purple (#6b1683)
    grad = 0.5 + 0.5 * (nx * 0.3 - ny * 0.5)
    r = int(59 * (1 - grad) + 107 * grad)
    g = int(9 * (1 - grad) + 22 * grad)
    b = int(78 * (1 - grad) + 131 * grad)
    
    # Plumeria flower center around (-0.52, -0.28), radius 0.28
    fx = nx - (-0.50)
    fy = ny - (-0.26)
    fdist = math.sqrt(fx * fx + fy * fy)
    
    # Text zone: horizontal center ny in [-0.2, 0.45], nx in [-0.85, 0.85]
    # Check if in flower
    if fdist < 0.28:
        # Petals angle
        angle = math.atan2(fy, fx)
        petal_mod = math.cos(angle * 5)
        petal_radius = 0.18 + 0.09 * (petal_mod * 0.5 + 0.5)
        if fdist < petal_radius:
            # Inside flower
            core_dist = fdist / 0.10
            if core_dist < 1.0:
                # Golden center #f4b400
                fr = int(255 * (1 - core_dist) + 250 * core_dist)
                fg = int(200 * (1 - core_dist) + 245 * core_dist)
                fb = int(30 * (1 - core_dist) + 220 * core_dist)
            else:
                # White/cream petals
                fr, fg, fb = 252, 250, 245
            return fr, fg, fb, 255

    # Yellow text curves / letters
    # Approximate Thai/Burmese stylized letters:
    # Letter 1: "သူ" around nx in [-0.75, -0.4], ny in [-0.05, 0.4]
    # Letter 2: "့" / "ရ" around nx in [-0.35, -0.05], ny in [-0.35, 0.2]
    # Letter 3: "ဇ" / "ะ" around nx in [-0.05, 0.25], ny in [-0.05, 0.2]
    # Letter 4: "ဝ" / "ာ" around nx in [0.28, 0.8], ny in [-0.15, 0.25]
    in_text = False
    
    # Letter 1 curve
    if -0.72 < nx < -0.38 and -0.12 < ny < 0.22:
        # Loop shape
        cx, cy = -0.55, 0.05
        d = math.sqrt((nx - cx)**2 + (ny - cy)**2)
        if 0.07 < d < 0.16:
            in_text = True
    # Down stroke for letter 1
    if -0.63 < nx < -0.48 and 0.18 < ny < 0.42:
        in_text = True
    if -0.52 < nx < -0.42 and 0.38 < ny < 0.44:
        in_text = True

    # Letter 2 tall flourish
    if -0.38 < nx < -0.05:
        # curved loop
        cx, cy = -0.22, 0.05
        d = math.sqrt((nx - cx)**2 + (ny - cy)**2)
        if 0.07 < d < 0.16:
            in_text = True
        # upward tail
        if -0.28 < nx < -0.15 and -0.35 < ny < -0.05:
            curve_x = -0.20 + 0.15 * ((ny + 0.35) / 0.3)**2
            if abs(nx - curve_x) < 0.045:
                in_text = True

    # Letter 3 small double curves
    if -0.05 < nx < 0.24:
        cx1, cy1 = 0.04, 0.08
        d1 = math.sqrt((nx - cx1)**2 + (ny - cy1)**2)
        cx2, cy2 = 0.16, 0.08
        d2 = math.sqrt((nx - cx2)**2 + (ny - cy2)**2)
        if (0.04 < d1 < 0.10) or (0.04 < d2 < 0.10):
            in_text = True

    # Letter 4 right loop & hook
    if 0.26 < nx < 0.80:
        cx, cy = 0.50, 0.08
        d = math.sqrt((nx - cx)**2 + (ny - cy)**2)
        if 0.08 < d < 0.18:
            in_text = True
        # flourish hook top right
        if 0.58 < nx < 0.78 and -0.15 < ny < 0.05:
            curve_y = -0.08 + 0.15 * ((nx - 0.58) / 0.2)**2
            if abs(ny - curve_y) < 0.045:
                in_text = True

    if in_text:
        # Brilliant bright yellow #fff000
        return 255, 240, 0, 255

    return r, g, b, 255

create_png(192, 192, draw_logo, 'public/school-logo.png')
create_png(512, 512, draw_logo, 'public/app-icon.png')

import { nativeImage } from 'electron';

const FALLBACK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAS1BMVEVHcEwjY+v///8zZfC53f5xmfX5/P+fuvjK4v7r8f/J4P6Utvff7f8qX+98nPTP5v65zv1Lj+8eW+x8o/RznfVpifNjl/FWgPB6ofV5nPR4gu6mAAAAFHRSTlMAbBR8w0QjP9sK8f8Vv2n/n23g3G0Ah5CEAAAA9ElEQVQ4y+2TWQ7CMAxEw5TYhACB9z9t2QxN0m6S9A6P9JxY3vD8w3tA0m7b5J+1qJq6bG5r0gA3A1w6z3Q9m0lq8Fq6c3s8Pj8yA9x5YbqS7jN4mP8n3j4m4Ckq2n0xA0gQ5z8m4iP6c8QHfJ3h2q1m+Qx5jv9A1uC3Q3I5dY5xJ5q4mSx0l2S0WbB7xJm2mQhG3qQ3VhQH+KQYy2xvB9mWkqG4Jf1kQ+2E7Y8X9dX2k3p6rL8Xz7f5aQ4fYd2L6h+9M6m5eV9v6xHkzJ9m4r9kY+4m2V6N7z7XfVqV0r4a1W3OQh8o7vE5Zf8FJdM8B0wY5UAAAAASUVORK5CYII=';

function createWindowsSolidIcon(hasUnread: boolean): Electron.NativeImage {
  const width = 16;
  const height = 16;
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const isCenter = x >= 4 && x <= 11 && y >= 4 && y <= 11;

      if (isBorder) {
        rgba[i] = 10;
        rgba[i + 1] = 16;
        rgba[i + 2] = 32;
        rgba[i + 3] = 255;
      } else if (isCenter) {
        rgba[i] = 255;
        rgba[i + 1] = 255;
        rgba[i + 2] = 255;
        rgba[i + 3] = 255;
      } else {
        rgba[i] = 37;
        rgba[i + 1] = 99;
        rgba[i + 2] = 235;
        rgba[i + 3] = 255;
      }
    }
  }

  if (hasUnread) {
    const cx = 12;
    const cy = 4;
    const outerRadius = 3;
    const innerRadius = 2;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        const distanceSquared = dx * dx + dy * dy;
        const i = (y * width + x) * 4;

        if (distanceSquared <= outerRadius * outerRadius) {
          rgba[i] = 255;
          rgba[i + 1] = 255;
          rgba[i + 2] = 255;
          rgba[i + 3] = 255;
        }

        if (distanceSquared <= innerRadius * innerRadius) {
          rgba[i] = 239;
          rgba[i + 1] = 68;
          rgba[i + 2] = 68;
          rgba[i + 3] = 255;
        }
      }
    }
  }

  return nativeImage.createFromBitmap(rgba, {
    width,
    height,
    scaleFactor: 1
  });
}

function createNonWindowsIcon(hasUnread: boolean): Electron.NativeImage {
  const unreadDot = hasUnread
    ? '<circle cx="25" cy="7" r="4" fill="#EF4444" stroke="#FFFFFF" stroke-width="2" />'
    : '';
  const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="28" height="22" rx="8" fill="#2563EB"/><path d="M11 12H21" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M11 17H18" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M13 26L17 22H21" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${unreadDot}</svg>`;
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  let image = nativeImage.createFromDataURL(dataUrl);
  if (image.isEmpty()) {
    image = nativeImage.createFromPath(process.execPath);
  }

  if (image.isEmpty()) {
    image = nativeImage.createFromDataURL(`data:image/png;base64,${FALLBACK_PNG_BASE64}`);
  }

  const resized = image.resize({ width: 20, height: 20, quality: 'best' });
  if (process.platform === 'darwin') {
    resized.setTemplateImage(false);
  }

  return resized;
}

export function createTrayIcon(hasUnread = false): Electron.NativeImage {
  if (process.platform === 'win32') {
    return createWindowsSolidIcon(hasUnread);
  }

  return createNonWindowsIcon(hasUnread);
}

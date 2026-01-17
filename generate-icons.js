import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputFile = path.join(__dirname, 'penguin-reader-logo.svg');

const icons = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 }
];

async function generateIcons() {
  if (!fs.existsSync(inputFile)) {
    console.error('Error: penguin-reader-logo.svg not found in the current directory.');
    return;
  }

  console.log('Generating icons from SVG...');

  for (const icon of icons) {
    try {
      // Calculate density to ensure crisp rendering of the SVG at the target size
      // Base size of your SVG is 32px. Standard density is 72dpi.
      const density = 72 * (icon.size / 32);

      await sharp(inputFile, { density: density })
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(path.join(__dirname, icon.name));
      
      console.log(`✅ Created ${icon.name} (${icon.size}x${icon.size})`);
    } catch (error) {
      console.error(`❌ Error creating ${icon.name}:`, error);
    }
  }
}

generateIcons();
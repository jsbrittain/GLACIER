import sharp from 'sharp';

(async () => {
  await sharp('assets/icon.svg').resize(1024, 1024).png().toFile('assets/icon-1024.png');
})();

const fs = require('fs');
const adsContent = fs.readFileSync('C:\\Users\\HP\\Downloads\\mangareader\\frontend\\public\\ads.js', 'utf8');

const matches = [...adsContent.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
console.log('Matches:', matches.length);
if (matches.length) {
  console.log('Inner length:', matches[matches.length - 1][1].trim().length);
  console.log('First 200 chars:', matches[matches.length - 1][1].trim().substring(0, 200));
}
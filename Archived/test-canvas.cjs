/* global require */
const { createCanvas } = require('canvas');

try {
  const canvas = createCanvas(120, 40);
  const ctx = canvas.getContext('2d');
  
  // Test large numbers
  ctx.moveTo(0, Number.MAX_VALUE);
  console.log('moveTo with MAX_VALUE succeeded');
  ctx.lineTo(0, Number.MAX_VALUE);
  console.log('lineTo with MAX_VALUE succeeded');
  
  // Test arc with MAX_VALUE
  ctx.arc(0, Number.MAX_VALUE, 2, 0, 2 * Math.PI);
  console.log('arc with MAX_VALUE succeeded');
} catch (e) {
  console.log('Error:', e.message);
}

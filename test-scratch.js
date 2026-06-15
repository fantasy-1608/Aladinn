console.log('WARN'.localeCompare(undefined));
try {
  console.log(undefined.localeCompare('WARN'));
} catch (e) {
  console.log('Error:', e.message);
}

// Simple script to generate a 32-character hex token
// Similar to randomToken32_() in Code.gs

function generateToken() {
  const chars = '0123456789abcdef';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

const token = generateToken();
console.log('Generated token for Jem Pest Solutions:');
console.log(token);
console.log('\nIntake Form URL:');
console.log(`https://zakpestsos.github.io/engage-intake/frontend-intake/?token=${token}`);
console.log('\nDashboard URL:');
console.log(`https://zakpestsos.github.io/engage-intake/frontend-dashboard/?token=${token}`);


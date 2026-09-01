const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables manually
const envPath = path.join(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
console.log('GOOGLE_SERVICE_ACCOUNT_JSON type:', typeof saJson);
if (!saJson) {
  console.log('No GOOGLE_SERVICE_ACCOUNT_JSON found!');
  process.exit(1);
}

try {
  let jsonString = saJson.trim();
  if ((jsonString.startsWith("'") && jsonString.endsWith("'")) ||
      (jsonString.startsWith('"') && jsonString.endsWith('"')) ) {
    jsonString = jsonString.slice(1, -1);
  }
  const parsed = JSON.parse(jsonString);
  console.log('Parsed successfully!');
  console.log('Private key exists:', !!parsed.private_key);
  console.log('Private key length:', parsed.private_key ? parsed.private_key.length : 0);
  
  // Try to clean the private key if it has literal newlines or escaped \n
  let key = parsed.private_key;
  console.log('Key start:', key.substring(0, 50));
  console.log('Key contains raw newlines:', key.includes('\n'));
  console.log('Key contains escaped newlines (\\\\n):', key.includes('\\n'));
  
  // Try to parse using crypto to see if it throws the decoder error
  const crypto = require('crypto');
  try {
    crypto.createPrivateKey(key);
    console.log('Crypto successfully parsed the original private key!');
  } catch (err) {
    console.error('Crypto failed to parse original private key:', err.message);
    
    // Attempt cleaning: replace any double backslashes with single backslashes, or literal \n with raw newlines
    const cleanedKey = key.replace(/\\n/g, '\n').replace(/\r/g, '');
    try {
      crypto.createPrivateKey(cleanedKey);
      console.log('Crypto successfully parsed the cleaned private key!');
    } catch (err2) {
      console.error('Crypto failed to parse cleaned private key:', err2.message);
    }
  }
} catch (err) {
  console.error('Parsing failed:', err.message);
}

const envVar = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
console.log('Env var exists:', !!envVar);
if (envVar) {
  console.log('Length:', envVar.length);
  console.log('First 100 chars:', envVar.substring(0, 100));
  try {
    const parsed = JSON.parse(envVar);
    console.log('JSON parsed successfully');
    console.log('Has private_key:', !!parsed.private_key);
    console.log('Private key first 50 chars:', parsed.private_key?.substring(0, 50));
  } catch (e) {
    console.error('JSON parse error:', e.message);
  }
}

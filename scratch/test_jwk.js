import { webcrypto } from 'crypto'
const { subtle } = webcrypto

async function testJwk() {
  try {
    // Generate key pair
    const tempKeyPair = await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign']
    )
    const tempJwk = await subtle.exportKey('jwk', tempKeyPair.privateKey)
    console.log('Exported JWK:', tempJwk)

    // Re-import the exported JWK with all x, y, d
    const imported = await subtle.importKey(
      'jwk',
      tempJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    )
    console.log('Re-import of matching JWK components successful:', !!imported)
  } catch (err) {
    console.error('Re-import failed:', err)
  }
}

testJwk()

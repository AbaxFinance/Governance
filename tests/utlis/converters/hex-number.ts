export function hexToNumbers(hex: string): number[] {
  const byteArray = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2) {
    byteArray[i / 2] = parseInt(hex.substr(i, 2), 16);
  }

  return Array.from(byteArray);
}

export function numbersToHex(bytes: number[]): string {
  let hexString = '';

  for (const byte of bytes) {
    const hex = byte.toString(16).padStart(2, '0');
    hexString += hex;
  }

  return hexString;
}

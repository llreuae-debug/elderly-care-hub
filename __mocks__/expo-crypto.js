module.exports = {
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
  digestStringAsync: jest.fn(async (algorithm, str) => {
    // Return known SHA-256 hash for 1234
    if (str === '1234') {
      return '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
    }
    // Simple deterministic hash simulation for other inputs
    return `hash-${str}`;
  }),
};

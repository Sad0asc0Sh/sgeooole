const dns = require("dns").promises;

const DNS_TTL_MS = 300000; // 5 minutes

const dnsCache = new Map();

/**
 * Resolve a hostname to an IP address with in-memory caching (5-min TTL).
 * Returns null on failure instead of throwing.
 */
const resolveHostname = async (hostname) => {
  const now = Date.now();
  const cached = dnsCache.get(hostname);

  if (cached && now - cached.timestamp < DNS_TTL_MS) {
    return cached.ip;
  }

  try {
    const { address } = await dns.lookup(hostname);
    dnsCache.set(hostname, { ip: address, timestamp: now });
    console.log(`[DNSCache] Resolved ${hostname} → ${address}`);
    return address;
  } catch (err) {
    console.warn(`[DNSCache] Failed to resolve ${hostname}: ${err.message}`);
    if (cached) {
      console.warn(`[DNSCache] Using stale cache for ${hostname} → ${cached.ip}`);
      return cached.ip;
    }
    return null;
  }
};

const clearCache = () => {
  dnsCache.clear();
};

module.exports = {
  resolveHostname,
  clearCache,
  dnsCache,
};

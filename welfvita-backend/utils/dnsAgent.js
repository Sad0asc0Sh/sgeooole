const dns = require('dns');
const https = require('https');

/**
 * Custom DNS Resolver to bypass restrictions.
 * Uses specific DNS servers: 178.22.122.100, 185.51.200.2
 */
const resolver = new dns.Resolver();
resolver.setServers(['178.22.122.101', '8.8.8.8']);

/**
 * Custom lookup function for https.Agent
 * Handles both single and 'all' (multiple) address requests.
 */
const customLookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    const family = options.family || 4;
    const all = options.all || false;

    if (family === 6) {
        resolver.resolve6(hostname, (err, addresses) => {
            if (err) return callback(err);
            if (!addresses || !addresses.length) return callback(new Error(`No IPv6 address found for ${hostname}`));

            if (all) {
                const result = addresses.map(addr => ({ address: addr, family: 6 }));
                callback(null, result);
            } else {
                callback(null, addresses[0], 6);
            }
        });
    } else {
        // Family 4 or 0 (any) -> prefer 4
        resolver.resolve4(hostname, (err, addresses) => {
            if (err) return callback(err);
            if (!addresses || !addresses.length) return callback(new Error(`No IPv4 address found for ${hostname}`));

            if (all) {
                const result = addresses.map(addr => ({ address: addr, family: 4 }));
                callback(null, result);
            } else {
                callback(null, addresses[0], 4);
            }
        });
    }
};

/**
 * HTTPS Agent with custom DNS lookup
 */
const dnsAgent = new https.Agent({
    lookup: customLookup,
    keepAlive: true,
    timeout: 30000 // 30s timeout
});

module.exports = dnsAgent;

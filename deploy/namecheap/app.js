/**
 * cPanel / Phusion Passenger startup file for the orderweeddc artifact.
 *
 * This file sits at the ARTIFACT root (next to server.js, .next/static,
 * and public/). Passenger launches it; it hardens the runtime defaults
 * and hands off to the Next.js standalone server, which honors PORT and
 * HOSTNAME from the environment (Passenger supplies PORT).
 *
 * No secrets live here. All configuration arrives via the cPanel
 * "Setup Node.js App" environment-variable panel.
 */
'use strict';

process.env.NODE_ENV = 'production';

// Bind to loopback: Passenger proxies external traffic to this process.
if (!process.env.HOSTNAME) {
  process.env.HOSTNAME = '127.0.0.1';
}

// Fail loudly and early if the operator forgot the database location —
// a directory site that silently starts without its database is worse
// than one that refuses to start.
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. In cPanel > Setup Node.js App, add ' +
      'DATABASE_URL=file:/home/<cpanel-user>/orderweeddc-data/prod.db ' +
      'and restart.',
  );
}

require('./server.js');

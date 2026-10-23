const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ASSETS_SRC = path.join(ROOT_DIR, 'assets');

console.log('--- Starting Web SEO & AEO Post-Build Enhancement ---');

if (!fs.existsSync(DIST_DIR)) {
  console.error('Error: dist directory does not exist. Run "expo export -p web" first.');
  process.exit(1);
}

// 1. Copy Brand Assets for Social Previews (Open Graph / Twitter Cards)
const distAssetsDir = path.join(DIST_DIR, 'assets');
if (!fs.existsSync(distAssetsDir)) {
  fs.mkdirSync(distAssetsDir, { recursive: true });
}

if (fs.existsSync(path.join(ASSETS_SRC, 'logo.png'))) {
  fs.copyFileSync(path.join(ASSETS_SRC, 'logo.png'), path.join(distAssetsDir, 'logo.png'));
  fs.copyFileSync(path.join(ASSETS_SRC, 'logo.png'), path.join(DIST_DIR, 'logo.png'));
  console.log('✓ Copied brand logo to dist/assets/logo.png and dist/logo.png');
}

// 2. Structured Data (JSON-LD) for Schema.org SoftwareApplication & FAQPage (AEO)
const jsonLdData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://elderly-care-hub.vercel.app/#application",
      "name": "Elderly Care Hub",
      "operatingSystem": "iOS, Android, Web",
      "applicationCategory": "HealthApplication",
      "description": "Coordinate elderly care with family and caregivers. Track daily check-ins, medication logs, shift coverage, and emergency contacts in one secure app.",
      "url": "https://elderly-care-hub.vercel.app",
      "image": "https://elderly-care-hub.vercel.app/assets/logo.png",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "featureList": [
        "Daily elder check-in with one-tap status and emergency caregiver escalation",
        "Real-time caregiver shift coverage and gap detection",
        "Caregiver handoff notes and shared timeline",
        "Medication logs and reminder schedules",
        "Zero-PII privacy guarantee with no third-party tracking pixels"
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://elderly-care-hub.vercel.app/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Elderly Care Hub?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Elderly Care Hub is a care coordination platform designed for families and caregivers to manage the daily care of aging loved ones. It combines simplified elder check-ins, caregiver shift scheduling, handoff notes, and medication tracking into a unified private care circle."
          }
        },
        {
          "@type": "Question",
          "name": "How does caregiver shift coverage work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Caregivers can view scheduled shifts, log shift handoff notes, claim open coverage hours, and view real-time warnings whenever consecutive shifts leave gaps in care coverage."
          }
        },
        {
          "@type": "Question",
          "name": "How does the daily check-in feature protect seniors?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Seniors use an elder-friendly, large-button interface with PIN access to tap 'I'm OK' each morning or evening. If a check-in deadline passes without response, the system automatically alerts primary caregivers via push notification and emergency SMS."
          }
        },
        {
          "@type": "Question",
          "name": "How is user health and personal data protected?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Elderly Care Hub utilizes Supabase PostgreSQL with strict Row Level Security (RLS), encrypts elder PINs, uses zero third-party advertising pixels, and enforces an anonymized zero-PII telemetry architecture."
          }
        }
      ]
    }
  ]
};

// 3. Enhance dist/index.html with Meta, Open Graph, Twitter Cards, and Pre-rendered Semantic Content
const indexPath = path.join(DIST_DIR, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // Replace Title
  html = html.replace(
    /<title>.*?<\/title>/i,
    '<title>Elderly Care Hub | Family Caregiver Coordination &amp; Daily Check-Ins</title>'
  );

  // Meta & Social Tags to inject in <head>
  const headMetaTags = `
    <!-- Core SEO Meta -->
    <meta name="description" content="Coordinate elderly care with family and caregivers. Track daily check-ins, medication logs, shift coverage, and emergency contacts in one secure app." />
    <meta name="keywords" content="elderly care app, family care coordination, caregiver shift coverage, elder check-in, medication reminder, care circle, handoff notes" />
    <meta name="author" content="Elderly Care Hub Team" />
    <link rel="canonical" href="https://elderly-care-hub.vercel.app/" />

    <!-- Open Graph (Facebook, iMessage, WhatsApp, Slack) -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Elderly Care Hub" />
    <meta property="og:url" content="https://elderly-care-hub.vercel.app/" />
    <meta property="og:title" content="Elderly Care Hub | Family Caregiver Coordination &amp; Daily Check-Ins" />
    <meta property="og:description" content="Coordinate elderly care with family and caregivers. Track daily check-ins, medication logs, shift coverage, and emergency contacts in one secure app." />
    <meta property="og:image" content="https://elderly-care-hub.vercel.app/assets/logo.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Elderly Care Hub Application Logo and Care Circle Platform" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Elderly Care Hub | Family Caregiver Coordination" />
    <meta name="twitter:description" content="Coordinate elderly care with family and caregivers. Track daily check-ins, medication logs, shift coverage, and emergency contacts in one secure app." />
    <meta name="twitter:image" content="https://elderly-care-hub.vercel.app/assets/logo.png" />

    <!-- JSON-LD Structured Data for Search & Answer Engines (AEO) -->
    <script type="application/ld+json">
      ${JSON.stringify(jsonLdData, null, 2)}
    </script>

    <style>
      .seo-crawlable-content {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }
    </style>
  `;

  // Inject into <head>
  html = html.replace('</head>', `${headMetaTags}\n  </head>`);

  // Pre-rendered Semantic Content for Search Crawlers & AEO Bots (accessible in DOM, layered under app)
  const semanticLandingContent = `
    <!-- Semantic Landing Content for Search & Answer Engines -->
    <div id="seo-pre-render" class="seo-crawlable-content">
      <header>
        <h1>Elderly Care Hub — Dignified Care Circle Coordination</h1>
        <p>Coordinate daily care for elderly loved ones across family members and private caregivers.</p>
      </header>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading">Key Features &amp; Care Capabilities</h2>
        <ul>
          <li><strong>Daily Elder Check-In:</strong> One-tap "I'm OK" status check with automatic emergency caregiver SMS notifications upon missed check-in deadlines.</li>
          <li><strong>Caregiver Shift Coverage:</strong> Daily shift scheduling, real-time gap detection, and shift handoff notes for continuous care.</li>
          <li><strong>Medication &amp; Care Timeline:</strong> Synchronized timeline of medicine schedules, meals, wellness observations, and care notes.</li>
          <li><strong>Privacy &amp; Security:</strong> Strict Row Level Security (RLS) data isolation, zero third-party advertising tracking, and zero-PII telemetry.</li>
        </ul>
      </section>

      <section aria-labelledby="faq-heading">
        <h2 id="faq-heading">Frequently Asked Questions (FAQ)</h2>
        <article>
          <h3>What is Elderly Care Hub?</h3>
          <p>Elderly Care Hub is an integrated caregiving platform designed for families and professional caregivers to support elderly parents and relatives in living safely and independently at home.</p>
        </article>
        <article>
          <h3>How does shift handoff work?</h3>
          <p>Each caregiver logs shift handover notes summarizing medication intake, vitals, mood, and daily activities. The incoming caregiver immediately sees these notes upon starting their shift.</p>
        </article>
        <article>
          <h3>How do I join or create a Care Circle?</h3>
          <p>Family administrators create a Care Circle and generate a unique invite code to invite other family members, neighbors, or professional aides.</p>
        </article>
      </section>

      <footer>
        <nav aria-label="Footer Legal Links">
          <a href="/privacy">Privacy Policy</a> |
          <a href="/terms">Terms of Service</a> |
          <a href="/support">Caregiver Support</a>
        </nav>
      </footer>
    </div>
  `;

  // Update <noscript> with rich semantic summary
  const enhancedNoscript = `
    <noscript>
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 40px auto; padding: 24px; line-height: 1.6; color: #1e293b;">
        <h1 style="color: #0e7490;">Elderly Care Hub</h1>
        <p><strong>A dignified coordination platform for family caregivers and elderly loved ones.</strong></p>
        <p>Track daily check-ins, medication logs, shift coverage, and emergency contacts in one secure app.</p>
        <div style="margin: 24px 0; padding: 16px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px;">
          Please enable JavaScript in your browser to launch the interactive Care Circle application.
        </div>
        <p>Quick Links: <a href="/privacy" style="color: #0e7490;">Privacy Policy</a> &bull; <a href="/terms" style="color: #0e7490;">Terms of Service</a> &bull; <a href="/support" style="color: #0e7490;">Support</a></p>
      </div>
    </noscript>
  `;

  html = html.replace(/<noscript>.*?<\/noscript>/s, enhancedNoscript);
  html = html.replace('<div id="root"></div>', `<div id="root"></div>\n${semanticLandingContent}`);

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✓ Successfully injected SEO meta, Open Graph, JSON-LD, and pre-rendered content into dist/index.html');
}

// 4. Helper Function to Generate Beautiful Standalone HTML Pages
function createStandalonePage({ title, heading, subtitle, metaDesc, contentHtml, canonicalPath }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>${title} | Elderly Care Hub</title>
    <meta name="description" content="${metaDesc.replace(/"/g, '&quot;')}" />
    <link rel="canonical" href="https://elderly-care-hub.vercel.app${canonicalPath}" />
    <link rel="icon" href="/favicon.ico" />
    <meta property="og:title" content="${title} | Elderly Care Hub" />
    <meta property="og:description" content="${metaDesc.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="https://elderly-care-hub.vercel.app/assets/logo.png" />
    <meta property="og:url" content="https://elderly-care-hub.vercel.app${canonicalPath}" />
    <meta name="twitter:card" content="summary" />
    <style>
      :root {
        --primary: #0e7490;
        --primary-dark: #155e75;
        --bg: #f8fafc;
        --card-bg: #ffffff;
        --text: #1e293b;
        --text-muted: #64748b;
        --border: #e2e8f0;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background-color: var(--bg);
        color: var(--text);
        line-height: 1.65;
        padding: 0 16px 48px;
      }
      .nav-bar {
        max-width: 820px;
        margin: 0 auto;
        padding: 20px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--border);
      }
      .logo-link {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--primary);
        font-weight: 700;
        font-size: 1.15rem;
      }
      .nav-links a {
        color: var(--text-muted);
        text-decoration: none;
        margin-left: 16px;
        font-size: 0.95rem;
        transition: color 0.2s;
      }
      .nav-links a:hover { color: var(--primary); }
      .container {
        max-width: 820px;
        margin: 32px auto 0;
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 40px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      }
      h1 { font-size: 2rem; color: #0f172a; margin-bottom: 8px; }
      .subtitle { color: var(--text-muted); font-size: 1.05rem; margin-bottom: 32px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
      h2 { font-size: 1.35rem; color: var(--primary-dark); margin: 28px 0 12px; }
      h3 { font-size: 1.1rem; color: #334155; margin: 18px 0 8px; }
      p { margin-bottom: 16px; color: #334155; }
      ul { margin: 0 0 18px 24px; color: #334155; }
      li { margin-bottom: 6px; }
      .badge-callout {
        background: #ecfeff;
        border-left: 4px solid var(--primary);
        padding: 16px 20px;
        border-radius: 6px;
        margin: 20px 0;
        font-size: 0.95rem;
      }
      .footer-bar {
        max-width: 820px;
        margin: 32px auto 0;
        text-align: center;
        color: var(--text-muted);
        font-size: 0.88rem;
      }
      .btn {
        display: inline-block;
        background: var(--primary);
        color: #ffffff;
        padding: 10px 20px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        margin-top: 16px;
      }
      .btn:hover { background: var(--primary-dark); }
    </style>
  </head>
  <body>
    <header class="nav-bar">
      <a href="/" class="logo-link">
        <span>💙 Elderly Care Hub</span>
      </a>
      <nav class="nav-links">
        <a href="/">Open App</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/support">Support</a>
      </nav>
    </header>

    <main class="container">
      <h1>${heading}</h1>
      <p class="subtitle">${subtitle}</p>
      ${contentHtml}
      <p><a href="/" class="btn">&larr; Return to Elderly Care Hub</a></p>
    </main>

    <footer class="footer-bar">
      &copy; ${new Date().getFullYear()} Elderly Care Hub. All rights reserved. &bull; <a href="/privacy" style="color: inherit;">Privacy</a> &bull; <a href="/terms" style="color: inherit;">Terms</a> &bull; <a href="/support" style="color: inherit;">Support</a>
    </footer>
  </body>
</html>`;
}

// 5. Generate Privacy Policy
const privacyHtml = `
  <div class="badge-callout">
    <strong>Zero-PII &amp; Privacy-First Guarantee:</strong> Elderly Care Hub never sells user data, contains zero third-party advertising trackers, and isolates family care records using PostgreSQL Row Level Security (RLS).
  </div>

  <h2>1. Overview &amp; Principles</h2>
  <p>Elderly Care Hub ("we", "us", or "our") provides a dignified, mobile-first care coordination platform for family caregivers and elderly loved ones. We operate on three inviolable principles:</p>
  <ul>
    <li><strong>Dignity-First Privacy:</strong> We never sell, monetize, or broker personal care data.</li>
    <li><strong>Zero-PII Measurement Layer:</strong> All operational analytics are strictly scrubbed of names, phone numbers, and care notes.</li>
    <li><strong>No Third-Party Tracking:</strong> We do not embed ad pixels, cross-app tracking SDKs, or device fingerprinting.</li>
  </ul>

  <h2>2. Information We Collect</h2>
  <p>We only collect information necessary to coordinate care within your authorized Care Circle:</p>
  <ul>
    <li><strong>Account Information:</strong> Caregiver email and name for authentication and circle management.</li>
    <li><strong>Elder Profile:</strong> Elder preferred name and a secure 4-digit PIN (cryptographically hashed, never stored in plaintext).</li>
    <li><strong>Care Coordination Logs:</strong> Medication reminders, shift handoff logs, and daily "I'm OK" check-in confirmations.</li>
    <li><strong>Emergency Contacts:</strong> Caregiver mobile phone numbers used strictly for SMS alerts when a check-in deadline is missed.</li>
  </ul>

  <h2>3. Third-Party Service Providers</h2>
  <ul>
    <li><strong>Supabase:</strong> Encrypted database hosting with Row Level Security enforcing strict family circle isolation.</li>
    <li><strong>Twilio:</strong> Emergency SMS gateway for missed check-in alerts (never used for marketing).</li>
  </ul>

  <h2>4. Data Retention &amp; Account Deletion</h2>
  <p>Users can permanently delete their account and associated care circle data at any time directly inside the app settings (Circle Selection &rarr; Settings &rarr; Delete Account) or by emailing <a href="mailto:support@elderlycarehub.com">support@elderlycarehub.com</a>.</p>
`;

const privacyPage = createStandalonePage({
  title: 'Privacy Policy',
  heading: 'Privacy Policy',
  subtitle: 'Last updated: October 2026 &bull; Effective for all Elderly Care Hub users',
  metaDesc: 'Read the Elderly Care Hub Privacy Policy. Learn about our zero-PII architecture, zero tracking guarantee, and data deletion rights.',
  contentHtml: privacyHtml,
  canonicalPath: '/privacy'
});

// 6. Generate Terms of Service
const termsHtml = `
  <div class="badge-callout">
    <strong>Notice:</strong> Elderly Care Hub is a care coordination and communication tool. It is not an emergency response dispatch service and does not replace emergency 911 services.
  </div>

  <h2>1. Acceptance of Terms</h2>
  <p>By creating an account, joining a Care Circle, or accessing Elderly Care Hub, you agree to comply with and be bound by these Terms of Service.</p>

  <h2>2. Permitted Use &amp; Care Circles</h2>
  <p>Elderly Care Hub is designed to assist families and non-emergency caregivers with scheduling shifts, recording handoffs, and logging daily check-ins. You agree to use the service only for lawful personal or family care purposes.</p>

  <h2>3. Emergency Medical Disclaimer</h2>
  <p><strong>IF YOU OR AN ELDER LOVED ONE EXPERIENCES A LIFE-THREATENING EMERGENCY, CALL EMERGENCY SERVICES (911) IMMEDIATELY.</strong> Elderly Care Hub notifications, SMS alerts, and check-ins depend on device internet connectivity and cellular carrier networks and must not be used as the sole lifeline in acute emergencies.</p>

  <h2>4. User Responsibilities &amp; Community Standards</h2>
  <p>Users must not post abusive, harmful, or defamatory content in shift handoff notes. Elderly Care Hub provides in-app content reporting and blocking mechanisms; inappropriate conduct will result in immediate circle removal.</p>

  <h2>5. Termination &amp; Deletion</h2>
  <p>You may terminate your account at any time within the application settings. We reserve the right to suspend accounts that violate safety guidelines.</p>
`;

const termsPage = createStandalonePage({
  title: 'Terms of Service',
  heading: 'Terms of Service',
  subtitle: 'Last updated: October 2026 &bull; Effective for all Elderly Care Hub users',
  metaDesc: 'Terms of Service and conditions for using the Elderly Care Hub platform, care circle coordination, and notifications.',
  contentHtml: termsHtml,
  canonicalPath: '/terms'
});

// 7. Generate Support Page
const supportHtml = `
  <div class="badge-callout">
    <strong>Need Assistance?</strong> We're here to help your family manage your Care Circle smoothly and securely.
  </div>

  <h2>Contact Support</h2>
  <p>For questions regarding Care Circles, invitations, account access, or technical issues, reach our team directly:</p>
  <ul>
    <li><strong>Email Support:</strong> <a href="mailto:support@elderlycarehub.com">support@elderlycarehub.com</a></li>
    <li><strong>Response Time:</strong> We review all support and content inquiries within 24 hours.</li>
  </ul>

  <h2>Frequently Asked Help Questions</h2>
  <h3>How do I invite a caregiver to my Circle?</h3>
  <p>Go to your Care Circle screen, tap <em>Manage Circle</em>, and share the 6-character Invite Code or invitation link with your family member or caregiver.</p>

  <h3>How does an Elder loved one log in?</h3>
  <p>On the initial login screen, switch to <strong>Elder Check-In Mode</strong>. The elder simply selects their circle and enters their 4-digit PIN.</p>

  <h3>How do I permanently delete my account?</h3>
  <p>Open the app &rarr; Select Care Circle screen &rarr; Tap the gear icon (Settings) in the top right &rarr; Tap <strong>Delete Account &amp; Data</strong>.</p>
`;

const supportPage = createStandalonePage({
  title: 'Caregiver Support',
  heading: 'Support &amp; Help Center',
  subtitle: 'Help resources, FAQs, and contact channels for Elderly Care Hub families',
  metaDesc: 'Get help and support for Elderly Care Hub. Contact our support team, find care circle invite help, or learn how to delete account data.',
  contentHtml: supportHtml,
  canonicalPath: '/support'
});

// Helper to write both dist/[name].html and dist/[name]/index.html
function writePage(name, content) {
  fs.writeFileSync(path.join(DIST_DIR, `${name}.html`), content, 'utf8');
  const pageDir = path.join(DIST_DIR, name);
  if (!fs.existsSync(pageDir)) {
    fs.mkdirSync(pageDir, { recursive: true });
  }
  fs.writeFileSync(path.join(pageDir, 'index.html'), content, 'utf8');
  console.log(`✓ Generated dist/${name}.html and dist/${name}/index.html`);
}

writePage('privacy', privacyPage);
writePage('terms', termsPage);
writePage('support', supportPage);

// 8. Generate robots.txt
const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://elderly-care-hub.vercel.app/sitemap.xml
`;
fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt, 'utf8');
console.log('✓ Generated dist/robots.txt');

// 9. Generate sitemap.xml
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://elderly-care-hub.vercel.app/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://elderly-care-hub.vercel.app/privacy</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://elderly-care-hub.vercel.app/terms</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://elderly-care-hub.vercel.app/support</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`;
fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf8');
console.log('✓ Generated dist/sitemap.xml');

console.log('--- Web SEO & AEO Post-Build Enhancement Completed Successfully ---');

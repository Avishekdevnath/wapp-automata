/**
 * Wholesale Telecom Trading Terminal
 * Benchmark Telecom Route Dataset & Seeding Utility
 * 
 * Provides authentic, multi-day wholesale voice rate sheets across tier-1/tier-2 global markets.
 * Used for automated initial bootstrap, historical trend plotting, and fallback testing.
 */

const BENCHMARK_ROUTES = [
  // 1. North America
  {
    country: 'USA',
    route_type: 'CC CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0055,
    ani_pass: '86xx/1xx ANI Pass',
    quality_notes: 'Direct Media, Local Correct Display',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'HANI',
    vendor_phone: '+8801304474210',
    company_name: 'Echolink Tel Ltd',
    raw_text: '🇺🇸 USA CC CLI 1/1 at $0.0055 | 86xx/1xx ANI Pass | Local Correct',
    daysAgo: 0.1
  },
  {
    country: 'USA',
    route_type: 'CLI',
    billing_pulse: '60/1',
    rate_per_min: 0.0075,
    ani_pass: '100% ANI Pass',
    quality_notes: 'Tier-1 Conversational, Clean Transit',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Alex Rivera',
    vendor_phone: '+14155552671',
    company_name: 'IDT Global Communications',
    raw_text: '🇺🇸 USA Conversational CLI 60/1 @ $0.0075/min | 100% ANI Pass',
    daysAgo: 1.2
  },
  {
    country: 'USA',
    route_type: 'CC CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0070,
    ani_pass: 'All ANI Passing',
    quality_notes: 'Urgent buyer requirement: Seeking 50k ACD daily volume',
    fas_free: 1,
    intent: 'WTB',
    vendor_name: 'Sarah Jenkins',
    vendor_phone: '+12125553920',
    company_name: 'VoxTel Enterprise NY',
    raw_text: 'WTB: USA 800 Toll-Free CC CLI 1/1 at $0.0070 | Live Outbound Volume',
    daysAgo: 0.3
  },
  {
    country: 'Canada',
    route_type: 'CC CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0048,
    ani_pass: 'Direct 1xx ANI',
    quality_notes: 'FAS-Free Direct Route, High ASR 48% / ACD 4.2',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Marc Tremblay',
    vendor_phone: '+15145558912',
    company_name: 'Telus Partner Network',
    raw_text: '🇨🇦 Canada CC CLI 1/1 at $0.0048/min | Direct Gateway',
    daysAgo: 0.5
  },

  // 2. Latin America
  {
    country: 'Colombia',
    route_type: 'CC CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0062,
    ani_pass: '86xx/1xx ANI',
    quality_notes: 'Local Correct Display, Direct Bogota Media',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Carlos Morales',
    vendor_phone: '+573005551234',
    company_name: 'LatAm Telecom Bogota',
    raw_text: '🇨🇴 Colombia CC CLI 1/1 Local Correct @ $0.0062 | High Capacity',
    daysAgo: 0.2
  },
  {
    country: 'Colombia',
    route_type: 'IVR',
    billing_pulse: '1/1',
    rate_per_min: 0.0045,
    ani_pass: 'DTMF Pass',
    quality_notes: 'DTMF Supported, 200 Ports Available',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Mateo Ortiz',
    vendor_phone: '+573105556789',
    company_name: 'Andean Carrier Network',
    raw_text: '🇨🇴 Colombia IVR 1/1 DTMF Supported @ $0.0045 | 200 Ports',
    daysAgo: 2.1
  },
  {
    country: 'Colombia',
    route_type: 'CC CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0075,
    ani_pass: 'All ANI',
    quality_notes: 'Looking for stable provider with zero FAS',
    fas_free: 1,
    intent: 'WTB',
    vendor_name: 'Diego Ramirez',
    vendor_phone: '+573155559876',
    company_name: 'Medellin Call Tech',
    raw_text: 'WTB: Colombia CC CLI 1/1 @ $0.0075 | Daily 35k Minutes',
    daysAgo: 0.8
  },
  {
    country: 'Mexico',
    route_type: 'CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0185,
    ani_pass: '52xx Direct',
    quality_notes: 'Telcel & Movistar Mobile Clean Termination',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Sofia Reyes',
    vendor_phone: '+525555554321',
    company_name: 'Telmex Enterprise Partner',
    raw_text: '🇲🇽 Mexico Mobile CLI 1/1 @ $0.0185 | Direct Operator Route',
    daysAgo: 1.0
  },
  {
    country: 'Brazil',
    route_type: 'CC CLI',
    billing_pulse: '60/1',
    rate_per_min: 0.0089,
    ani_pass: '55xx SP / Rio',
    quality_notes: 'Direct Gateway, FAS Free Guaranteed',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Lucas Silva',
    vendor_phone: '+5511995551234',
    company_name: 'Vivo Transit Solutions',
    raw_text: '🇧🇷 Brazil CC CLI 60/1 @ $0.0089 | Sao Paulo / Rio Clean',
    daysAgo: 0.7
  },

  // 3. Europe
  {
    country: 'United Kingdom',
    route_type: 'CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0125,
    ani_pass: '44xx Clean ANI',
    quality_notes: 'BT Direct Transit, 100% FAS Free Guaranteed',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'David Hughes',
    vendor_phone: '+442079460912',
    company_name: 'Colt Telecom London',
    raw_text: '🇬🇧 UK CLI 1/1 Clean Transit @ $0.0125 | BT Direct',
    daysAgo: 0.4
  },
  {
    country: 'United Kingdom',
    route_type: 'CC CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0140,
    ani_pass: 'Clean ANI',
    quality_notes: 'Urgent buyer requirement: Seeking reliable UK route',
    fas_free: 1,
    intent: 'WTB',
    vendor_name: 'Arthur Pendelton',
    vendor_phone: '+447700900145',
    company_name: 'Apex Voice Capital',
    raw_text: 'WTB: UK CC CLI 1/1 at $0.0140 | 25k daily capacity needed',
    daysAgo: 1.5
  },
  {
    country: 'Germany',
    route_type: 'CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0195,
    ani_pass: '49xx Clean ANI',
    quality_notes: 'Deutsche Telekom Direct Interconnect',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Klaus Weber',
    vendor_phone: '+493012345678',
    company_name: 'Deutsche Carrier Solutions',
    raw_text: '🇩🇪 Germany CLI 1/1 at $0.0195 | Clean Interconnect',
    daysAgo: 2.0
  },

  // 4. Asia Pacific
  {
    country: 'Australia',
    route_type: 'CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0140,
    ani_pass: '614xx ANI Pass',
    quality_notes: 'Telstra Wholesale Interconnect, 0% FAS',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Liam Vance',
    vendor_phone: '+61491570156',
    company_name: 'Telstra Wholesale Partner',
    raw_text: '🇦🇺 Australia CLI 1/1 at $0.0140 | 614xx ANI Pass',
    daysAgo: 0.9
  },
  {
    country: 'Hong Kong',
    route_type: 'CC CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0110,
    ani_pass: '852xx ANI Supported',
    quality_notes: 'HKT Interconnect, 100% FAS Free',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Ken Wong',
    vendor_phone: '+85291234567',
    company_name: 'CITIC Telecom CPC',
    raw_text: '🇭🇰 Hong Kong CC CLI 1/1 @ $0.0110 | HKT Direct',
    daysAgo: 1.1
  },
  {
    country: 'Singapore',
    route_type: 'CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0165,
    ani_pass: '65xx Direct',
    quality_notes: 'Singtel Enterprise Gateway, Low Latency',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Wei Zhang',
    vendor_phone: '+6591234567',
    company_name: 'Singtel Enterprise Partner',
    raw_text: '🇸🇬 Singapore CLI 1/1 at $0.0165 | Direct Gateway',
    daysAgo: 1.8
  },
  {
    country: 'Bangladesh',
    route_type: 'CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0240,
    ani_pass: '880xx IGW Direct',
    quality_notes: 'Direct IGW Clean Termination, Licensed Carrier',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Tanvir Ahmed',
    vendor_phone: '+8801711223344',
    company_name: 'Summit Communications IGW',
    raw_text: '🇧🇩 Bangladesh CLI 1/1 IGW Direct @ $0.0240',
    daysAgo: 0.3
  },
  {
    country: 'India',
    route_type: 'CLI',
    billing_pulse: '60/1',
    rate_per_min: 0.0130,
    ani_pass: '91xx Clean Operator',
    quality_notes: 'Tata Communications Direct Transit',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Rahul Sharma',
    vendor_phone: '+919820123456',
    company_name: 'Tata Communications Global',
    raw_text: '🇮🇳 India Direct CLI 60/1 @ $0.0130 | Operator Interconnect',
    daysAgo: 1.4
  },
  {
    country: 'Japan',
    route_type: 'CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0280,
    ani_pass: '81xx Clean Transit',
    quality_notes: 'NTT Direct Gateway, High Connection Rate',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Kenji Sato',
    vendor_phone: '+819012345678',
    company_name: 'NTT Communications Partner',
    raw_text: '🇯🇵 Japan CLI 1/1 @ $0.0280 | Clean NTT Route',
    daysAgo: 2.5
  },
  {
    country: 'Macau',
    route_type: 'CC CLI',
    billing_pulse: '60/1',
    rate_per_min: 0.0190,
    ani_pass: '853xx ANI',
    quality_notes: 'CTM Partner Interconnect, Clean Traffic',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'HANI',
    vendor_phone: '+8801304474210',
    company_name: 'Echolink Tel Ltd',
    raw_text: '🇲🇴 Macau CC CLI 60/1 @ $0.0190 | 853xx ANI',
    daysAgo: 1.6
  },
  {
    country: 'UAE',
    route_type: 'CC CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0850,
    ani_pass: '971xx Direct',
    quality_notes: 'Etisalat & Du Licensed Interconnect',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Omar Al-Mansoor',
    vendor_phone: '+971501234567',
    company_name: 'Du Wholesale Dubai',
    raw_text: '🇦🇪 UAE CC CLI 1/1 @ $0.0850 | Direct Media',
    daysAgo: 0.6
  },
  {
    country: 'Puerto Rico',
    route_type: 'CLI',
    billing_pulse: '1/1',
    rate_per_min: 0.0070,
    ani_pass: '1787/1939 ANI',
    quality_notes: 'Liberty Telecom Direct Route, 0% FAS',
    fas_free: 1,
    intent: 'WTS',
    vendor_name: 'Juan Colon',
    vendor_phone: '+17875551234',
    company_name: 'San Juan Telecom',
    raw_text: '🇵🇷 Puerto Rico CLI 1/1 at $0.0070 | Liberty Direct',
    daysAgo: 1.9
  }
];

const BENCHMARK_NEWS = [
  {
    category: 'OUTAGE',
    headline: 'Red Sea Subsea Cable Cut (SMW4/AAE-1) Severing Primary Europe-Asia Latency Corridor',
    affected_countries: 'Egypt, India, Bangladesh, UAE',
    urgency: 'HIGH',
    raw_text: 'CRITICAL ALERT: Physical subsea cable cut confirmed in Red Sea corridor near Jeddah. Latency increased by 140ms on South Asia voice trunks. Carriers rerouting via terrestrial and Cape of Good Hope routes with heavy transit congestion.',
    hoursAgo: 0.2
  },
  {
    category: 'REGULATION',
    headline: 'BTRC Bangladesh Mandates Real-Time A-Number Verification on Inbound International Gateways',
    affected_countries: 'Bangladesh, India',
    urgency: 'HIGH',
    raw_text: 'DIRECTIVE: BTRC order 2026-BTRC-04 requires Tier-1 ICX and IGW operators to drop non-standard ANI/CLI strings. Unregistered VoIP traffic terminating to BD Mobile 880 prefixes facing immediate 403 Forbidden response.',
    hoursAgo: 0.8
  },
  {
    category: 'OUTAGE',
    headline: 'Backbone Terrestrial Fiber Cut Near Bogota Impacting Tier-1 Interconnects',
    affected_countries: 'Colombia, Panama, Ecuador',
    urgency: 'HIGH',
    raw_text: 'ALERT: Major terrestrial fiber cut reported on Bogota-Medellin mountain pass. Multiple carriers reporting 35% ASR drop on Colombia Mobile Claro/Tigo. Microwave failover active with reduced capacity.',
    hoursAgo: 1.5
  },
  {
    category: 'FRAUD',
    headline: 'High-Volume False Answer Supervision (FAS) Burst Detected on Pakistan Mobile 923 Ranges',
    affected_countries: 'Pakistan, UAE, UK',
    urgency: 'HIGH',
    raw_text: 'FRAUD WARNING: Telecom security sensors detected unauthorized 12-second pre-answer audio loops on rogue Pakistan route offers. Immediate vendor quarantine advised for untrusted VoIP accounts.',
    hoursAgo: 2.2
  },
  {
    category: 'REGULATION',
    headline: 'FCC STIR/SHAKEN Mandate: Robocall Mitigation Database Verification for US 800 Toll-Free Trunks',
    affected_countries: 'USA, Canada',
    urgency: 'HIGH',
    raw_text: 'REGULATORY: FCC Tier-1 enforcement deadline reached. Intermediate providers must block all incoming session initiation protocol calls lacking full Level-A cryptographic attestation tokens.',
    hoursAgo: 3.5
  },
  {
    category: 'OUTAGE',
    headline: 'Southern California Boundary Exchange Power Surge Trips Primary SBC Cluster',
    affected_countries: 'USA, Mexico',
    urgency: 'HIGH',
    raw_text: 'ALERT: Core Session Border Controller cluster in Los Angeles data center experienced sudden power drop. Traffic shifting automatically to Ashburn redundancy site with transient call disconnects.',
    hoursAgo: 4.1
  },
  {
    category: 'FRAUD',
    headline: 'International Revenue Share Fraud (IRSF) Exploiting Somalia and Latvia Premium Prefixes',
    affected_countries: 'Somalia, Latvia, Lithuania',
    urgency: 'HIGH',
    raw_text: 'FRAUD ADVISORY: Coordinated autodialer burst attempting PBX brute force to generate high-cost terminates to +252 and +371 ranges. Set maximum duration limits to under 180 seconds on unverified routes.',
    hoursAgo: 5.0
  },
  {
    category: 'MAINTENANCE',
    headline: 'Tata Communications Scheduled Subsea Core Gateway Maintenance (02:00 - 04:00 GMT)',
    affected_countries: 'India, Singapore, UAE',
    urgency: 'MEDIUM',
    raw_text: 'SCHEDULED: Core router firmware upgrade on Europe-Asia subsea transit. Minimal latency fluctuations of 15-25ms anticipated during failover convergence.',
    hoursAgo: 6.5
  },
  {
    category: 'REGULATION',
    headline: 'UK Ofcom Anti-Spoofing Directive on International VoIP Inbound to +44 7 Mobile Ranges',
    affected_countries: 'United Kingdom, Germany',
    urgency: 'MEDIUM',
    raw_text: 'BULLETIN: Ofcom implementation guidance mandates carrier boundary drop for foreign CLI claiming UK local origin without roaming clearinghouse tokens.',
    hoursAgo: 8.0
  },
  {
    category: 'MAINTENANCE',
    headline: 'SEACOM West Africa Subsea Cable Emergency Wet Plant Maintenance',
    affected_countries: 'South Africa, Kenya, Tanzania',
    urgency: 'MEDIUM',
    raw_text: 'ADVISORY: Repair ship dispatched off the coast of Mtunzini. Traffic rerouted via WACS and Equiano fiber systems during scheduled daylight hours.',
    hoursAgo: 10.0
  },
  {
    category: 'OUTAGE',
    headline: 'Trans-Alpine Fiber Severed Near Turin Impairing Franco-Italian Voice Peering',
    affected_countries: 'Italy, France, Switzerland',
    urgency: 'MEDIUM',
    raw_text: 'DISPATCH: Civil construction works cut regional duct. Sparkle and Orange rerouting wholesale voice through Zurich. ACD down 4%, ASR steady.',
    hoursAgo: 12.0
  },
  {
    category: 'REGULATION',
    headline: 'Brazil ANATEL Enforces Strict Origin Identification on 0800 Toll-Free Terminations',
    affected_countries: 'Brazil, USA',
    urgency: 'MEDIUM',
    raw_text: 'COMPLIANCE: ANATEL circular requires non-national origination identifiers for wholesale call center transit terminating into Brazilian national carriers.',
    hoursAgo: 14.0
  },
  {
    category: 'OUTAGE',
    headline: 'Lagos Metro Ring Disruption Affecting Inter-Carrier SIP Handshakes',
    affected_countries: 'Nigeria, Ghana',
    urgency: 'MEDIUM',
    raw_text: 'INCIDENT: Metro fiber cut during roadway expansion impacting interconnect between MTN and Airtel. Terrestrial microwave backup links operating at 85% capacity.',
    hoursAgo: 16.5
  },
  {
    category: 'INFRASTRUCTURE',
    headline: 'PLDT Trans-Pacific AAG Segment Fault Repairs Successfully Completed',
    affected_countries: 'Philippines, USA, Japan',
    urgency: 'LOW',
    raw_text: 'RECOVERY: Full restoration confirmed on Asia-America Gateway segment 1. Latency on Manila-San Jose voice trunks returned to baseline 155ms.',
    hoursAgo: 19.0
  },
  {
    category: 'MAINTENANCE',
    headline: 'Etisalat UAE Regional Softswitch Database Indexing Window',
    affected_countries: 'UAE, Qatar, Oman',
    urgency: 'LOW',
    raw_text: 'ROUTINE: Database maintenance scheduled between 03:00 and 04:30 GST. All active sessions maintain media flow without interruption.',
    hoursAgo: 22.0
  },
  {
    category: 'MAINTENANCE',
    headline: 'SingTel International Gateway SIP Trunking Routine Failover Drill',
    affected_countries: 'Singapore, Malaysia, Indonesia',
    urgency: 'LOW',
    raw_text: 'DRILL: Planned BGP multi-homing validation drill completed with zero dropped calls recorded across tier-1 trading partners.',
    hoursAgo: 26.0
  },
  {
    category: 'INFRASTRUCTURE',
    headline: 'China Telecom Golden Week Traffic Shaping and Route Capacity Optimization',
    affected_countries: 'China, Hong Kong',
    urgency: 'LOW',
    raw_text: 'OPERATIONAL: Traffic capacity expanded on Hong Kong cross-border gateways in anticipation of holiday volume peaks. CLI routes clear.',
    hoursAgo: 30.0
  },
  {
    category: 'REGULATION',
    headline: 'Germany BNetzA Guidance Clarification for Wholesale Transit Operators',
    affected_countries: 'Germany, Austria',
    urgency: 'LOW',
    raw_text: 'INFORMATIONAL: Technical specification updated regarding transit operator obligations under section 120 of the German Telecommunications Act.',
    hoursAgo: 36.0
  }
];

/**
 * Seeds benchmark routes, vendors, and market news into SQLite database
 */
function seedBenchmarkRoutes(db, force = false) {
  if (!db) return 0;
  try {
    const existingCount = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get()?.c || 0;
    if (existingCount > 0 && !force) {
      return existingCount;
    }

    const { evaluateRouteFraudRisk } = require('./server/fraud-detector');
    const now = Date.now();

    const insertRoute = db.prepare(`
      INSERT OR REPLACE INTO route_ticks (
        id, message_id, vendor_name, vendor_phone, company_name,
        country, route_type, billing_pulse, rate_per_min, ani_pass,
        quality_notes, fas_free, intent, raw_text, fraud_risk_score,
        fraud_risk_level, fraud_flags, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const upsertVendor = db.prepare(`
      INSERT INTO vendors (phone, name, company, total_offers, last_seen_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = COALESCE(excluded.name, vendors.name),
        company = COALESCE(excluded.company, vendors.company),
        total_offers = vendors.total_offers + 1,
        last_seen_at = excluded.last_seen_at
    `);

    const insertNews = db.prepare(`
      INSERT OR REPLACE INTO market_news (
        id, message_id, category, headline, affected_countries, urgency, raw_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      // 1. Purge old benchmark records to prevent duplication ballooning
      db.prepare("DELETE FROM route_ticks WHERE id LIKE 'rt_bm_%'").run();

      // 2. Seed Routes with deterministic IDs
      for (let i = 0; i < BENCHMARK_ROUTES.length; i++) {
        const r = BENCHMARK_ROUTES[i];
        const routeId = `rt_bm_${String(i).padStart(3, '0')}_${r.country.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const routeTime = now - Math.round((r.daysAgo || 0) * 86400000);
        const fraud = evaluateRouteFraudRisk({
          country: r.country,
          route_type: r.route_type,
          billing_pulse: r.billing_pulse,
          rate_per_min: r.rate_per_min,
          ani_pass: r.ani_pass,
          quality_notes: r.quality_notes,
          raw_text: r.raw_text
        });

        insertRoute.run(
          routeId,
          `bm_msg_${routeId}`,
          r.vendor_name,
          r.vendor_phone,
          r.company_name,
          r.country,
          r.route_type,
          r.billing_pulse,
          r.rate_per_min,
          r.ani_pass,
          r.quality_notes,
          r.fas_free ? 1 : 0,
          r.intent || 'WTS',
          r.raw_text,
          fraud.risk_score,
          fraud.risk_level,
          JSON.stringify(fraud.flags),
          routeTime
        );

        if (r.vendor_phone) {
          upsertVendor.run(r.vendor_phone, r.vendor_name, r.company_name, routeTime);
        }
      }

      // 2. Seed News
      for (let i = 0; i < BENCHMARK_NEWS.length; i++) {
        const n = BENCHMARK_NEWS[i];
        const offsetMs = n.hoursAgo ? Math.round(n.hoursAgo * 3600000) : (i * 3600000 * 2);
        insertNews.run(
          `news_bm_${i}`,
          `bm_news_msg_${i}`,
          n.category,
          n.headline,
          n.affected_countries,
          n.urgency,
          n.raw_text,
          now - offsetMs
        );
      }
    })();

    const countAfter = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get()?.c || 0;
    console.log(`✅ [Trading Terminal] Successfully seeded ${countAfter} wholesale telecom routes!`);
    return countAfter;
  } catch (err) {
    console.error('❌ Failed to seed benchmark routes:', err.message);
    return 0;
  }
}

module.exports = {
  BENCHMARK_ROUTES,
  BENCHMARK_NEWS,
  seedBenchmarkRoutes
};

if (require.main === module) {
  const { getTradingDb } = require('./server/db');
  const db = getTradingDb();
  if (db) {
    seedBenchmarkRoutes(db, true);
  }
}

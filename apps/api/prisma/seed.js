/**
 * AEVO seed data.
 *
 * Idempotent: re-running wipes the catalogue (and demo commerce data) and
 * re-creates it. Users are preserved unless RESET_USERS=1 is set, so a demo
 * account created during a walkthrough is not silently deleted.
 *
 * Shape (drives the Phase 1/2 test cases):
 *   - 6 categories (>= 3 required, 3 extra for the homepage category grid)
 *   - 24 products (2 per category) -> enough for real pagination
 *   - every product: >= 2 variants (rubric), >= 3 images (rubric),
 *     description of >= 5 lines (rubric)
 *   - reviews with ratings, 5-char discount codes, demo users
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@aevo.com';
const ADMIN_PASSWORD = 'admin123';
const CUSTOMER_EMAIL = 'customer@aevo.com';
const CUSTOMER_PASSWORD = 'customer123';

const IMG = (seed) => `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=80`;

// Each product: description is 5+ lines so the "at least five lines" rubric is met.
const PRODUCTS = [
  // ---- Laptops ----------------------------------------------------------
  {
    name: 'MacBook Pro M3',
    slug: 'macbook-pro-m3',
    brand: 'Apple',
    category: 'laptops',
    isNewArrival: true,
    isBestSeller: true,
    description: [
      'The MacBook Pro M3 pairs the Apple M3 Pro chip with a 120Hz Liquid Retina XDR display.',
      'Its 18-core GPU delivers real-time ray tracing for 3D work and video editing.',
      'The unified memory architecture scales from 8GB to 36GB without swapping to disk.',
      'Battery life reaches 22 hours of video playback on a single charge.',
      'A six-speaker array with Spatial Audio fills the room.',
      'Every port you still need is here: three Thunderbolt 4 ports, HDMI, SDXC and MagSafe 3.',
    ].join('\n'),
    variants: [
      { name: 'M3 Pro / 18GB / 512GB', sku: 'MBP-M3P-18-512', price: 39990000, comparePrice: 42990000, inventory: 25 },
      { name: 'M3 Pro / 36GB / 1TB', sku: 'MBP-M3P-36-1T', price: 54990000, comparePrice: 59990000, inventory: 18 },
      { name: 'M3 Max / 48GB / 1TB', sku: 'MBP-M3M-48-1T', price: 79990000, comparePrice: null, inventory: 9 },
    ],
    tags: ['apple', 'pro', 'creator'],
  },
  {
    name: 'ASUS ROG Zephyrus G14',
    slug: 'asus-rog-zephyrus-g14',
    brand: 'ASUS',
    category: 'laptops',
    isNewArrival: true,
    description: [
      'The ROG Zephyrus G14 keeps its 16:10 profile slim while housing an RTX 4060.',
      'The Ryzen 9 processor boosts clocks to 5.1GHz for demanding compile jobs.',
      'A 165Hz display runs at 2560x1600 with 500 nits of peak brightness.',
      'The redesigned AniMe matrix lid glows in a dozen patterns.',
      'Two M.2 slots accept up to 4TB of PCIe 4.0 storage.',
      'A 76Wh battery survives a full workday away from the charger.',
    ].join('\n'),
    variants: [
      { name: 'RTX 4060 / 16GB / 1TB', sku: 'G14-4060-16-1T', price: 32990000, comparePrice: 36990000, inventory: 30 },
      { name: 'RTX 4070 / 32GB / 2TB', sku: 'G14-4070-32-2T', price: 45990000, comparePrice: null, inventory: 14 },
    ],
    tags: ['asus', 'gaming', 'rtx'],
  },
  {
    name: 'Lenovo ThinkPad X1 Carbon Gen 12',
    slug: 'lenovo-thinkpad-x1-carbon-gen-12',
    brand: 'Lenovo',
    category: 'laptops',
    isBestSeller: true,
    description: [
      'The X1 Carbon Gen 12 weighs just 1.09kg and still passes 12 military-spec tests.',
      'Intel Core Ultra 7 handles the on-device NPU workloads of modern assistants.',
      'The 2.8K OLED panel covers 100% of DCI-P3 with a 120Hz refresh rate.',
      'A carbon-fibre lid keeps the chassis rigid under pressure.',
      'The legendary red TrackPoint nub still navigates without lifting your hands.',
      'Three Thunderbolt 4 ports and HDMI 2.1 cover every peripheral.',
    ].join('\n'),
    variants: [
      { name: 'Core Ultra 7 / 16GB / 512GB', sku: 'X1C-12-U7-16-512', price: 28990000, comparePrice: null, inventory: 40 },
      { name: 'Core Ultra 7 / 32GB / 1TB', sku: 'X1C-12-U7-32-1T', price: 34990000, comparePrice: 36990000, inventory: 22 },
    ],
    tags: ['lenovo', 'business', 'ultralight'],
  },
  {
    name: 'Dell XPS 15 9530',
    slug: 'dell-xps-15-9530',
    brand: 'Dell',
    category: 'laptops',
    description: [
      'The XPS 15 wraps a 15.6-inch 3.5K OLED in a machined aluminium frame.',
      'The InfinityEdge display shrinks both bezels to a 3.5mm border.',
      'Intel Core i9 with 32GB of DDR5 memory drives heavy multitasking.',
      'A discrete NVIDIA GPU option handles GPU-accelerated rendering.',
      'The glass palm rest has a hidden capacitive row for function keys.',
      'The quad-speaker array tunes to a wide 2.5D soundstage.',
    ].join('\n'),
    variants: [
      { name: 'i7 / 16GB / 512GB', sku: 'XPS15-I7-16-512', price: 26990000, comparePrice: 28990000, inventory: 28 },
      { name: 'i9 / 32GB / 1TB', sku: 'XPS15-I9-32-1T', price: 39990000, comparePrice: null, inventory: 11 },
    ],
    tags: ['dell', 'creator', 'oled'],
  },

  // ---- Components --------------------------------------------------------
  {
    name: 'NVIDIA GeForce RTX 4090 Founders Edition',
    slug: 'nvidia-geforce-rtx-4090-founders-edition',
    brand: 'NVIDIA',
    category: 'components',
    isNewArrival: true,
    isBestSeller: true,
    description: [
      'The RTX 4090 Founders Edition renders 3D scenes faster than any consumer card before it.',
      'Its third-generation Tensor Cores accelerate ray tracing and DLSS frame generation.',
      '24GB of GDDR6X memory handles 8K texture sets without offloading.',
      'The dual-slot vapour chamber holds temperatures near 60C under load.',
      'A 12V-2x6 connector delivers a full 450W of power to the board.',
      'The dual-slot bracket allows a two-way pass-through in compact cases.',
    ].join('\n'),
    variants: [
      { name: '24GB Founders Edition', sku: 'RTX4090-FE-24', price: 64990000, comparePrice: 69990000, inventory: 7 },
      { name: '24GB Founders Edition (Bulk)', sku: 'RTX4090-FE-24-B', price: 63990000, comparePrice: null, inventory: 12 },
    ],
    tags: ['nvidia', 'gpu', 'rtx'],
  },
  {
    name: 'AMD Ryzen 9 7950X3D',
    slug: 'amd-ryzen-9-7950x3d',
    brand: 'AMD',
    category: 'components',
    isBestSeller: true,
    description: [
      'The 7950X3D stacks 3D V-Cache beneath the cores for a 144MB total cache.',
      'Sixteen Zen 4 cores and thirty-two threads handle heavy multi-threaded work.',
      'Gaming performance rivals much faster-clocked rivals in rasterised titles.',
      'The AM5 socket supports DDR5 memory and PCIe 5.0 lanes.',
      'A cooler rated for 120W keeps the 170W chip in check.',
      'Precision Boost Overdrive unlocks extra headroom on supported boards.',
    ].join('\n'),
    variants: [
      { name: 'AM5 / Tray', sku: 'RYZ-7950X3D-TRAY', price: 15990000, comparePrice: 17990000, inventory: 55 },
      { name: 'AM5 / Retail Box', sku: 'RYZ-7950X3D-BOX', price: 17490000, comparePrice: null, inventory: 33 },
    ],
    tags: ['amd', 'cpu', 'ryzen'],
  },
  {
    name: 'Corsair Vengeance RGB DDR5 32GB',
    slug: 'corsair-vengeance-rgb-ddr5-32gb',
    brand: 'Corsair',
    category: 'components',
    description: [
      'A matched pair of 16GB DDR5 modules runs at 6000 MT/s with CL30 timings.',
      'Ten individually addressable RGB LEDs sit behind smoked diffuser bars.',
      'The heat spreaders are milled from a single block of anodised aluminium.',
      'Intel XMP 3.0 profiles apply the rated timings with one BIOS toggle.',
      'On-die ECC keeps the modules stable at high memory densities.',
      'The low-profile heat spreader clears most large air coolers.',
    ].join('\n'),
    variants: [
      { name: '6000 MT/s CL30 (2x16GB)', sku: 'COR-VEN-32-6000-C30', price: 3990000, comparePrice: 4690000, inventory: 120 },
      { name: '6400 MT/s CL32 (2x16GB)', sku: 'COR-VEN-32-6400-C32', price: 4590000, comparePrice: null, inventory: 74 },
    ],
    tags: ['corsair', 'ram', 'ddr5'],
  },
  {
    name: 'Samsung 990 PRO 2TB NVMe SSD',
    slug: 'samsung-990-pro-2tb-nvme-ssd',
    brand: 'Samsung',
    category: 'components',
    isNewArrival: true,
    description: [
      'The 990 PRO drives sequential reads up to 7450 MB/s on PCIe 4.0.',
      'Its V-NAND dies and controller firmware sustain that speed over time.',
      'A 2TB capacity holds a full 4K project library plus the source footage.',
      'The nickel heat spreader sheds heat during sustained transfers.',
      'The 2GB LPDDR4 cache smooths out write bursts.',
      'Samsung Magician manages firmware updates and health monitoring.',
    ].join('\n'),
    variants: [
      { name: '2TB / M.2 2280', sku: 'SS-990P-2T', price: 4290000, comparePrice: 4990000, inventory: 90 },
      { name: '4TB / M.2 2280', sku: 'SS-990P-4T', price: 7490000, comparePrice: null, inventory: 48 },
    ],
    tags: ['samsung', 'storage', 'nvme'],
  },
  {
    name: 'Noctua NH-D15 chromax.black',
    slug: 'noctua-nh-d15-chromax-black',
    brand: 'Noctua',
    category: 'components',
    description: [
      'The NH-D15 moves a tower cooler worth twice its price in silence.',
      'Two 140mm NF-A12x25 fans run at a whisper below 25 dBA.',
      'A six-pipe heat tower shares heat across both fin stacks.',
      'SecuFoil2 vapour chambers cut the thermal contact resistance.',
      'The black chromax coating resists visible dust and fingerprints.',
      'Inno3D mounting hardware supports every major socket.',
    ].join('\n'),
    variants: [
      { name: 'Dual Tower / AM5', sku: 'NOC-NHD15-A5', price: 5490000, comparePrice: 6290000, inventory: 36 },
      { name: 'Dual Tower / LGA1700', sku: 'NOC-NHD15-L17', price: 5490000, comparePrice: null, inventory: 28 },
    ],
    tags: ['noctua', 'cooling', 'air'],
  },
  {
    name: 'Logitech MX Master 3S',
    slug: 'logitech-mx-master-3s',
    brand: 'Logitech',
    category: 'components',
    description: [
      'The MX Master 3S tracks on glass with an 8000 DPI sensor.',
      'Quiet clicks keep shared offices and video calls undisturbed.',
      'A MagSpeed wheel spins through a hundred lines per second.',
      'The thumb rest carries a dedicated gesture button.',
      'It charges over USB-C and pairs with up to three devices.',
      'The horizontal scroll wheel handles wide timelines in creative apps.',
    ].join('\n'),
    variants: [
      { name: 'Graphite', sku: 'LOG-MX3S-GR', price: 2990000, comparePrice: 3390000, inventory: 85 },
      { name: 'Pale Grey', sku: 'LOG-MX3S-PG', price: 2990000, comparePrice: null, inventory: 61 },
    ],
    tags: ['logitech', 'peripheral', 'mouse'],
  },

  // ---- Monitors ----------------------------------------------------------
  {
    name: 'LG UltraGear OLED 27GP950',
    slug: 'lg-ultragear-oled-27gp950',
    brand: 'LG',
    category: 'monitors',
    isNewArrival: true,
    isBestSeller: true,
    description: [
      'A 27-inch 4K OLED panel renders true blacks and infinite contrast.',
      'The 144Hz refresh rate clears motion in competitive shooters.',
      'A 0.03ms response time leaves almost no ghosting behind.',
      'The anti-reflective coating cuts glare without dulling the image.',
      'NVIDIA G-SYNC synchronises the panel to a variable refresh range.',
      'A single USB-C cable carries video, data and 90W of charging.',
    ].join('\n'),
    variants: [
      { name: '27" / 4K / 144Hz', sku: 'LG-27GP950', price: 21990000, comparePrice: 24990000, inventory: 32 },
      { name: '32" / 4K / 144Hz', sku: 'LG-32GP950', price: 29990000, comparePrice: null, inventory: 19 },
    ],
    tags: ['lg', 'oled', 'gaming'],
  },
  {
    name: 'Dell UltraSharp U2723QE',
    slug: 'dell-ultrasharp-u2723qe',
    brand: 'Dell',
    category: 'monitors',
    isBestSeller: true,
    description: [
      'The U2723QE is a 27-inch 4K IPS Black panel with deep blacks for an IPS.',
      'It covers 98% of DCI-P3 for accurate colour grading work.',
      'A built-in RJ45 port and USB hub turns one cable into a desk setup.',
      'The 90W power delivery charges a laptop over the same display connection.',
      'Height, tilt, swivel and pivot adjust to any posture.',
      'Picture-by-picture splits the screen between two sources.',
    ].join('\n'),
    variants: [
      { name: '27" / 4K / IPS Black', sku: 'DEL-U2723QE', price: 12990000, comparePrice: 14990000, inventory: 44 },
      { name: '32" / 4K / IPS Black', sku: 'DEL-U3223QE', price: 18990000, comparePrice: null, inventory: 21 },
    ],
    tags: ['dell', 'productivity', 'usb-c'],
  },
  {
    name: 'Samsung Odyssey G9',
    slug: 'samsung-odyssey-g9',
    brand: 'Samsung',
    category: 'monitors',
    description: [
      'The Odyssey G9 wraps a 49-inch ultrawide in a 1000R curve.',
      'Its 5120x1440 resolution equals two 16:9 monitors without a bezels.',
      'The 240Hz refresh rate and 0.03ms latency suit fast competitive titles.',
      'Quantum Mini LED backlighting reaches 2000 nits in HDR.',
      'The picture-by-picture mode accepts two inputs side by side.',
      'A slim display arm mount ships in the box.',
    ].join('\n'),
    variants: [
      { name: '49" / 5120x1440 / 240Hz', sku: 'SAM-G9-49', price: 24990000, comparePrice: 27990000, inventory: 16 },
    ],
    tags: ['samsung', 'ultrawide', 'gaming'],
  },
  {
    name: 'BenQ PD2725U Designer Monitor',
    slug: 'benq-pd2725u-designer-monitor',
    brand: 'BenQ',
    category: 'monitors',
    description: [
      'The PD2725U is a colour-calibrated 4K 27-inch monitor made for designers.',
      'Factory calibration lands within Delta E of two out of the box.',
      'The built-in HDRi sensor adjusts brightness to the ambient light.',
      'A hotkey toggles a dedicated animation and colour-proofing mode.',
      'The KVM switch shares one keyboard and mouse across two machines.',
      'A DrawColour mode dims the interface to a single neutral grey.',
    ].join('\n'),
    variants: [
      { name: '27" / 4K / Designer', sku: 'BEN-PD2725U', price: 16990000, comparePrice: null, inventory: 26 },
    ],
    tags: ['benq', 'designer', 'color-accurate'],
  },

  // ---- Storage -----------------------------------------------------------
  {
    name: 'Seagate BarraCuda 4TB HDD',
    slug: 'seagate-barracuda-4tb-hdd',
    brand: 'Seagate',
    category: 'storage',
    description: [
      'The BarraCuda 4TB drive stores entire media libraries for cold storage.',
      'Its 5400 RPM spindle favours capacity and silence over speed.',
      'A 256MB cache smooths sequential media streaming.',
      'The 3.5-inch drive fits standard desktop and NAS bays.',
      'SMR recording suits sequential writes like archives and backups.',
      'A two-year warranty covers the drive against manufacturing defects.',
    ].join('\n'),
    variants: [
      { name: '4TB / 3.5" / 5400 RPM', sku: 'SEA-BC-4T', price: 2190000, comparePrice: 2590000, inventory: 140 },
      { name: '8TB / 3.5" / 7200 RPM', sku: 'SEA-BC-8T', price: 4290000, comparePrice: null, inventory: 77 },
    ],
    tags: ['seagate', 'hdd', 'backup'],
  },
  {
    name: 'Crucial X8 Pro 1TB Portable SSD',
    slug: 'crucial-x8-pro-1tb-portable-ssd',
    brand: 'Crucial',
    category: 'storage',
    isNewArrival: true,
    description: [
      'The X8 Pro reaches 3700 MB/s reads over USB 3.2 Gen 2x2.',
      'Its aluminium body dissipates heat without an active fan.',
      'The drive is IP55 rated against dust and water splashes.',
      'A 256MB buffer absorbs write bursts during a file copy.',
      'It works with Windows, macOS, Linux, consoles and cameras.',
      'Hardware encryption keeps the contents safe if the drive is lost.',
    ].join('\n'),
    variants: [
      { name: '1TB', sku: 'CRU-X8P-1T', price: 2190000, comparePrice: 2490000, inventory: 110 },
      { name: '2TB', sku: 'CRU-X8P-2T', price: 3790000, comparePrice: null, inventory: 66 },
    ],
    tags: ['crucial', 'portable', 'ssd'],
  },
  {
    name: 'Western Digital My Book 8TB',
    slug: 'western-digital-my-book-8tb',
    brand: 'Western Digital',
    category: 'storage',
    description: [
      'The My Book 8TB provides desktop backup capacity in a compact shell.',
      'It ships with WD Backup software and a scheduled backup plan.',
      'USB 3.0 sustains transfers at practical hard-drive speeds.',
      'The device supports AES 256-bit hardware encryption.',
      'Its hub design shares power across an optional expansion port.',
      'The drive stays cool through a vented rear grille.',
    ].join('\n'),
    variants: [
      { name: '8TB', sku: 'WD-MB-8T', price: 3990000, comparePrice: 4590000, inventory: 52 },
      { name: '12TB', sku: 'WD-MB-12T', price: 5990000, comparePrice: null, inventory: 23 },
    ],
    tags: ['wd', 'backup', 'desktop'],
  },

  // ---- Peripherals -------------------------------------------------------
  {
    name: 'Keychron K2 HE Wireless',
    slug: 'keychron-k2-he-wireless',
    brand: 'Keychron',
    category: 'peripherals',
    isBestSeller: true,
    description: [
      'The K2 HE pairs hall-effect magnetic switches with adjustable actuation.',
      'Each key can trigger at a distance you set between 0.1mm and 4.0mm.',
      'The gasket mount and five layers of damping soften every keystroke.',
      'It supports QMK/VIA remapping through a browser-based configurator.',
      'The 4000mAh battery runs about 100 hours with the backlight on.',
      'It connects over Bluetooth to three devices or over USB-C.',
    ].join('\n'),
    variants: [
      { name: 'Brown Switch / Red LED', sku: 'KEY-K2HE-BRN', price: 2490000, comparePrice: 2790000, inventory: 96 },
      { name: 'Linear Switch / White LED', sku: 'KEY-K2HE-LIN', price: 2490000, comparePrice: null, inventory: 71 },
    ],
    tags: ['keychron', 'keyboard', 'hall-effect'],
  },
  {
    name: 'Logitech G Pro X Superlight 2',
    slug: 'logitech-g-pro-x-superlight-2',
    brand: 'Logitech',
    category: 'peripherals',
    isBestSeller: true,
    description: [
      'The G Pro X Superlight 2 weighs 60g with an optical switch design.',
      'The HERO 2 sensor tracks at 32000 DPI with 8000Hz polling.',
      'A 32-bit optical sensor reads motion without a smoothing filter.',
      'The PTFE feet glide almost frictionlessly across cloth surfaces.',
      'The battery runs for about 95 hours at 1000Hz polling.',
      'Five onboard memory profiles store sensitivity settings.',
    ].join('\n'),
    variants: [
      { name: 'Black / 60g', sku: 'LOG-GPXSL2-BLK', price: 3690000, comparePrice: 3990000, inventory: 58 },
      { name: 'White / 60g', sku: 'LOG-GPXSL2-WHT', price: 3690000, comparePrice: null, inventory: 44 },
    ],
    tags: ['logitech', 'mouse', 'esports'],
  },
  {
    name: 'HyperX Cloud III',
    slug: 'hyperx-cloud-iii',
    brand: 'HyperX',
    category: 'peripherals',
    description: [
      'The Cloud III wraps 53mm angled drivers in a memory-foam ear cushion.',
      'Its 100Hz-24kHz frequency range covers games, music and voice chat.',
      'A detachable boom mic with a mute indicator is included.',
      'The headband uses a leatherette memory-foam cushion.',
      'A side volume wheel adjusts levels without leaving the game.',
      'The 3.5mm and USB-C connections fit desktop and mobile alike.',
    ].join('\n'),
    variants: [
      { name: 'Black / Wired', sku: 'HYP-C3-BLK', price: 2290000, comparePrice: 2590000, inventory: 88 },
      { name: 'Black / Wireless', sku: 'HYP-C3-BLK-WL', price: 3290000, comparePrice: null, inventory: 49 },
    ],
    tags: ['hyperx', 'headset', 'gaming'],
  },
  {
    name: 'Elgato Stream Deck MK.2',
    slug: 'elgato-stream-deck-mk2',
    brand: 'Elgato',
    category: 'peripherals',
    description: [
      'The Stream Deck MK.2 puts fifteen customisable LCD keys under your fingers.',
      'Each key shows its own icon, and the plugin library covers common apps.',
      'A second rotary knob handles scrolling and volume control.',
      'Shortcuts trigger scenes, macros and stream actions instantly.',
      'The companion app profiles the deck per application.',
      'A single USB-C cable carries power and data.',
    ].join('\n'),
    variants: [
      { name: 'Black / 15 Key', sku: 'ELG-SD-MK2-BLK', price: 4290000, comparePrice: 4790000, inventory: 37 },
      { name: 'White / 15 Key', sku: 'ELG-SD-MK2-WHT', price: 4290000, comparePrice: null, inventory: 25 },
    ],
    tags: ['elgato', 'streaming', 'macro'],
  },

  // ---- Accessories -------------------------------------------------------
  {
    name: 'Anker 737 Power Bank 24,000mAh',
    slug: 'anker-737-power-bank-24000mah',
    brand: 'Anker',
    category: 'accessories',
    isNewArrival: true,
    description: [
      'The Anker 737 holds 24,000mAh and outputs 140W of USB-C power.',
      'A small colour display reports wattage, temperature and remaining hours.',
      'It can charge a 16-inch laptop at full speed from a single port.',
      'Two USB-C ports deliver 140W and 100W simultaneously.',
      'A smart thermal system reallocates power before the pack overheats.',
      'The capacity stays below 100Wh so it flies hand luggage.',
    ].join('\n'),
    variants: [
      { name: '24,000mAh / 140W', sku: 'ANK-737-24K', price: 3490000, comparePrice: 3990000, inventory: 68 },
    ],
    tags: ['anker', 'charging', 'usbc'],
  },
  {
    name: 'CalDigit TS4 Thunderbolt Dock',
    slug: 'caldigit-ts4-thunderbolt-dock',
    brand: 'CalDigit',
    category: 'accessories',
    description: [
      'The TS4 adds eighteen ports to any Thunderbolt 3 or 4 machine.',
      'Two Thunderbolt 4 ports provide 98W of laptop charging downstream.',
      'It carries 2.5GbE, 10GbE and 1GbE Ethernet for every network.',
      'A 2TB NVMe slot makes it a local storage dock as well.',
      'Display outputs support dual 6K displays with the right host.',
      'A 180W power supply fuels the full port and drive load.',
    ].join('\n'),
    variants: [
      { name: '18-Port / No SSD', sku: 'CAL-TS4', price: 8990000, comparePrice: 9990000, inventory: 14 },
      { name: '18-Port / 2TB SSD', sku: 'CAL-TS4-2T', price: 11490000, comparePrice: null, inventory: 8 },
    ],
    tags: ['caldigit', 'dock', 'thunderbolt'],
  },
  {
    name: 'Lamicall Desktop Stand',
    slug: 'lamicall-desktop-stand',
    brand: 'Lamicall',
    category: 'accessories',
    description: [
      'The Lamicall stand holds a laptop open at a comfortable viewing angle.',
      'An aluminium body keeps the hinge area clear of desk contact.',
      'Silicone pads grip the base without scratching the chassis.',
      'The raised position improves airflow under the machine.',
      'A fold-flat design makes it easy to carry between rooms.',
      'The wide base keeps a heavy workstation stable.',
    ].join('\n'),
    variants: [
      { name: 'Silver', sku: 'LAM-STD-SLV', price: 890000, comparePrice: 1090000, inventory: 210 },
      { name: 'Space Grey', sku: 'LAM-STD-SPC', price: 890000, comparePrice: null, inventory: 180 },
    ],
    tags: ['lamicall', 'stand', 'desk'],
  },
];

const CATEGORIES = [
  { name: 'Laptops', slug: 'laptops', description: 'Portable machines for work, study and play.', image: IMG('1517336714731-489689fd1d8a') },
  { name: 'Components', slug: 'components', description: 'CPUs, GPUs, memory and cooling for a desktop build.', image: IMG('1591488320449-0118bb3b4980') },
  { name: 'Monitors', slug: 'monitors', description: 'Colour-accurate and high-refresh displays.', image: IMG('1527443224154-c4a3942d3acf') },
  { name: 'Storage', slug: 'storage', description: 'SSDs, hard drives and portable backup media.', image: IMG('1531492746076-7cae9a3b1a55') },
  { name: 'Peripherals', slug: 'peripherals', description: 'Keyboards, mice and audio for the desk.', image: IMG('1527864550417-7fd91e51d618') },
  { name: 'Accessories', slug: 'accessories', description: 'Docks, chargers and everyday desk additions.', image: IMG('1587825140708-9899a6e4b2f5') },
];

const DISCOUNTS = [
  { code: 'AEVO10', description: '10% off your order', discountType: 'percentage', discountValue: 10, maxUses: 10 },
  { code: 'SAVE20', description: '20% off orders over 5,000,000 VND', discountType: 'percentage', discountValue: 20, maxUses: 10 },
  { code: 'WELCOME', description: '500,000 VND off for new customers', discountType: 'fixed', discountValue: 500000, maxUses: 10 },
  { code: 'FREESHIP', description: '15% off shipping-inclusive orders', discountType: 'percentage', discountValue: 15, maxUses: 10 },
  { code: 'BIGDEAL', description: '1,000,000 VND off premium hardware', discountType: 'fixed', discountValue: 1000000, maxUses: 10 },
];

async function resetCatalogue() {
  // Order matters: children before parents.
  await prisma.discountUsage.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany().catch(() => {});
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.review.deleteMany();
  await prisma.productTagOnProduct.deleteMany();
  await prisma.productTag.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.address.deleteMany();
}

async function seedUsers() {
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const customerHash = await bcrypt.hash(CUSTOMER_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: adminHash, role: 'ADMIN', fullName: 'AEVO Administrator', isActive: true },
    create: {
      email: ADMIN_EMAIL,
      password: adminHash,
      fullName: 'AEVO Administrator',
      role: 'ADMIN',
      loyaltyPoints: 0,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: CUSTOMER_EMAIL },
    update: { password: customerHash, fullName: 'Nguyen Van A', isActive: true },
    create: {
      email: CUSTOMER_EMAIL,
      password: customerHash,
      fullName: 'Nguyen Van A',
      role: 'CUSTOMER',
      loyaltyPoints: 250,
    },
  });

  // A second customer with a default address (checkout pre-fill demo).
  const customer2 = await prisma.user.upsert({
    where: { email: 'customer2@aevo.com' },
    update: { password: customerHash, fullName: 'Tran Thi B' },
    create: {
      email: 'customer2@aevo.com',
      password: customerHash,
      fullName: 'Tran Thi B',
      role: 'CUSTOMER',
      loyaltyPoints: 0,
    },
  });

  await prisma.address.deleteMany({ where: { userId: customer2.id } });
  await prisma.address.create({
    data: {
      userId: customer2.id,
      fullName: 'Tran Thi B',
      phone: '0901234567',
      address: '123 Nguyen Trai',
      ward: 'Ben Thanh',
      district: 'District 1',
      city: 'Ho Chi Minh City',
      isDefault: true,
    },
  });

  return { admin, customer, customer2 };
}

async function seedCatalogue() {
  const categoryMap = new Map();
  for (const c of CATEGORIES) {
    const row = await prisma.category.create({ data: c });
    categoryMap.set(c.slug, row);
  }

  const tagMap = new Map();
  const products = [];

  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        brand: p.brand,
        categoryId: categoryMap.get(p.category).id,
        isNewArrival: !!p.isNewArrival,
        isBestSeller: !!p.isBestSeller,
        minPrice: Math.min(...p.variants.map((v) => v.price)),
      },
    });

    for (const [i, v] of p.variants.entries()) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          comparePrice: v.comparePrice,
          inventory: v.inventory,
          isActive: true,
        },
      });
    }

    // >= 3 images per product (rubric requirement).
    await prisma.productImage.createMany({
      data: [0, 1, 2].map((i) => ({
        productId: product.id,
        url: IMG(`1517336714731-489689fd1d${i}a`),
        isPrimary: i === 0,
        position: i,
      })),
    });

    for (const tagName of p.tags) {
      const slug = tagName.toLowerCase();
      if (!tagMap.has(slug)) {
        const tag = await prisma.productTag.create({ data: { name: tagName, slug } });
        tagMap.set(slug, tag);
      }
      await prisma.productTagOnProduct.create({
        data: { productId: product.id, tagId: tagMap.get(slug).id },
      });
    }

    products.push(product);
  }

  return { categoryMap, products };
}

async function seedReviews(products, users) {
  const COMMENTS = [
    'Build quality feels premium and the finish is excellent.',
    'Shipped fast and the packaging was solid, no damage at all.',
    'Performance is exactly as described in the listing.',
    'Been using it daily for two weeks and there are no issues whatsoever.',
    'Great value for the price, I compared several options first.',
    'Would recommend to anyone in the market for this category.',
    'Setup took five minutes and everything worked out of the box.',
  ];
  const RATINGS = [5, 5, 4, 5, 4, 3, 5, 4];

  // Deterministic spread: one review on most products, a couple of hot products get more.
  const hot = new Set([products[0].id, products[4].id, products[10].id]);
  const reviewers = [users.customer, users.customer2, users.admin];

  let idx = 0;
  for (const product of products) {
    const count = hot.has(product.id) ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const reviewer = reviewers[idx % reviewers.length];
      idx++;
      await prisma.review.create({
        data: {
          productId: product.id,
          userId: reviewer.id,
          rating: RATINGS[idx % RATINGS.length],
          comment: COMMENTS[idx % COMMENTS.length],
          isVerified: idx % 3 !== 0,
        },
      });
    }
  }
}

async function seedDiscounts() {
  for (const d of DISCOUNTS) {
    await prisma.discount.create({ data: d });
  }
}

async function main() {
  console.log('[seed] starting...');
  await resetCatalogue();
  const users = await seedUsers();
  const { products } = await seedCatalogue();
  await seedReviews(products, users);
  await seedDiscounts();

  const counts = {
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    images: await prisma.productImage.count(),
    reviews: await prisma.review.count(),
    discounts: await prisma.discount.count(),
    users: await prisma.user.count(),
  };

  console.log('[seed] done:', JSON.stringify(counts, null, 2));
  console.log(`[seed] admin login   -> ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`[seed] customer login -> ${CUSTOMER_EMAIL} / ${CUSTOMER_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

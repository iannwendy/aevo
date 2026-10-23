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
const NEW_PRODUCTS_2026 = require('./products-2026.json');
const APPLE_PRODUCTS_2026 = require('./apple-2026.json');

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@aevo.com';
const ADMIN_PASSWORD = 'admin123';
const CUSTOMER_EMAIL = 'customer@aevo.com';
const CUSTOMER_PASSWORD = 'customer123';

const IMG = (seed) => `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=80`;

const GALLERY_SEEDS = {
  laptops: [
    '1517336714731-489689fd1d8a',
    '1496181133206-80ce9b88a853',
    '1525547719571-a2d4ac8945e2',
    '1531297484001-80022131f5a1',
  ],
  components: [
    '1591488320449-0118bb3b4980',
    '1587202372775-e229f172b9d7',
    '1555617981-dac3880eac6e',
    '1518770660439-4636190af475',
  ],
  monitors: [
    '1527443224154-c4a3942d3acf',
    '1547119957-637f8679db1e',
    '1593640408182-31c70c8268f5',
    '1585792180666-f7347c490ee2',
  ],
  storage: [
    '1531492746076-7cae9a3b1a55',
    '1597852074816-d933c7d2b988',
    '1544197150-b99a580bb7a8',
    '1558494949-ef010cbdcc31',
  ],
  peripherals: [
    '1527864550417-7fd91e51d618',
    '1587829741301-dc798b83add3',
    '1618384887929-16ec33fab9ef',
    '1541140532154-b024d705b90a',
  ],
  accessories: [
    '1587825140708-9899a6e4b2f5',
    '1526738549149-8e07eca6c147',
    '1572569511254-d8f925fe2cbb',
    '1498049794561-7780e7231661',
  ],
};

// Each product: description is 5+ lines so the "at least five lines" rubric is met.
const PRODUCTS = [
  // ---- Laptops ----------------------------------------------------------
  {
    name: 'MacBook Pro M3',
    slug: 'macbook-pro-m3',
    images: [
      'https://macone.vn/wp-content/uploads/2025/09/MacBook_Pro_14-in_M5_Pro_Space_Black_PDP_Image_Position_1__VN-VI-768x768.jpg',
      'https://macone.vn/wp-content/uploads/2025/09/MacBook_Pro_14-in_M5_Pro_Space_Black_PDP_Image_Position_2__VN-VI-768x768.jpg',
      'https://macone.vn/wp-content/uploads/2025/09/MacBook_Pro_14-in_M5_Pro_Silver_PDP_Image_Position_1__VN-VI-768x768.jpg',
      'https://macone.vn/wp-content/uploads/2025/09/MacBook_Pro_14-in_M5_Pro_Space_Black_PDP_Image_Position_6__VN-VI-768x768.jpg',
    ],
    brand: 'Apple',
    category: 'laptops',
    isNewArrival: true,
    isBestSeller: true,
    description: [
      'The MacBook Pro M3 flagship laptop pairs the Apple M3, M3 Pro and M3 Max 3nm chips with a 120Hz ProMotion Liquid Retina XDR display.',
      'Hardware-accelerated ray tracing and Dynamic Caching deliver desktop-class GPU performance for 3D rendering, Xcode and 8K video.',
      'Unified Memory scales from 16GB up to 64GB with ultra-fast NVMe SSD storage from 512GB to 2TB.',
      'Battery life reaches up to 22 hours on a single charge with silent fan curves under everyday workloads.',
      'Six-speaker high-fidelity sound system with force-cancelling woofers and studio-quality three-mic array.',
      'Full pro connectivity: three Thunderbolt 4 ports, HDMI 2.1, SDXC card slot, headphone jack and MagSafe 3 in Space Black or Silver.',
    ].join('\n'),
    variants: [
      { name: 'M3 (8C CPU / 10C GPU) / 16GB / 512GB / Space Grey', sku: 'MBP-M3-16-512-SG', price: 35990000, comparePrice: 39990000, inventory: 22 },
      { name: 'M3 Pro (11C CPU / 14C GPU) / 18GB / 512GB / Space Black', sku: 'MBP-M3P-18-512', price: 39990000, comparePrice: 44990000, inventory: 25 },
      { name: 'M3 Pro (12C CPU / 18C GPU) / 36GB / 1TB / Space Black', sku: 'MBP-M3P-36-1T', price: 52990000, comparePrice: 57990000, inventory: 18 },
      { name: 'M3 Max (14C CPU / 30C GPU) / 36GB / 1TB / Silver', sku: 'MBP-M3M-36-1T-SL', price: 68990000, comparePrice: 74990000, inventory: 12 },
      { name: 'M3 Max (16C CPU / 40C GPU) / 48GB / 1TB / Space Black', sku: 'MBP-M3M-48-1T', price: 79990000, comparePrice: 85990000, inventory: 9 },
    ],
    tags: ['apple', 'macbook', 'macbook-pro', 'm3', 'pro', 'creator'],
  },
  {
    name: 'ASUS ROG Zephyrus G14',
    slug: 'asus-rog-zephyrus-g14',
    images: [
      'https://m.media-amazon.com/images/I/61WJkJCsYZL._AC_SL1000_.jpg',
      'https://m.media-amazon.com/images/I/61YURuJ1QzL._AC_SL1000_.jpg',
      'https://m.media-amazon.com/images/I/713tovDb2OL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61kGpBGP7DL._AC_SL1000_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/61GSvJjxBuL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61VVypCqZxL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61jVaCmKXAL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61yafX5gUtL._AC_SL1039_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/71748MYAozL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61crHKovSKL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61aZ5XNG03L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/510UlYOnZ0L._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/514QPBuqGyL._AC_SL1002_.jpg',
      'https://m.media-amazon.com/images/I/61n5Z0eMm6L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61P6nrmF+NL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71PKwzCa8ZL._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/51jNS8epPeL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/51wD3-OAv0L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/51qA89Dg6UL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61rKeM-2DpL._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/61EVf-QxpvL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81fnmTvXQlL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81iJ8gp-VHL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/91mS+ceUWfL._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/71OWtcxKgvL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61qidDdfgRL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61D9foQdhDL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61S4fCwCigL._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/91t48GBv8TL._SL1500_.jpg',
      'https://m.media-amazon.com/images/I/91O+0CrmvSL._SL1500_.jpg',
      'https://m.media-amazon.com/images/I/914SVxljeIL._SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81MxGwGWBZL._SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/61C0EGFbtEL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81f-tgX7C9L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71-0F2ReUML._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81wTU+JA24L._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/81iMclFYKIL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81Lw-dn5L8L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81iCtprkQ7L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/91dAAoGUO-L._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/81MxURKFxuL._SL1500_.jpg',
      'https://m.media-amazon.com/images/I/512dpZN-V-L._SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81m13zgd+GL._SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61SLNvDzNpL._SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/61X2vtmJGlL._AC_SL1000_.jpg',
      'https://m.media-amazon.com/images/I/51PpQvTj2iL._AC_SL1000_.jpg',
      'https://m.media-amazon.com/images/I/61JAQ3X++fL._AC_SL1000_.jpg',
      'https://m.media-amazon.com/images/I/51wkXMRfhiL._AC_SL1000_.jpg',
    ],
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
      { name: '49" OLED / 5120x1440 / 240Hz', sku: 'SAM-G9-49-OLED', price: 31990000, comparePrice: 34990000, inventory: 9 },
    ],
    tags: ['samsung', 'ultrawide', 'gaming'],
  },
  {
    name: 'BenQ PD2725U Designer Monitor',
    slug: 'benq-pd2725u-designer-monitor',
    images: [
      'https://m.media-amazon.com/images/I/71T6IXSp69L._AC_SL1200_.jpg',
      'https://m.media-amazon.com/images/I/61LY3i31VAL._AC_SL1200_.jpg',
      'https://m.media-amazon.com/images/I/6115LMMkgtL._AC_SL1200_.jpg',
      'https://m.media-amazon.com/images/I/61ZQw4Jr58L._AC_SL1200_.jpg',
    ],
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
      { name: '32" / 4K / Designer', sku: 'BEN-PD3225U', price: 23990000, comparePrice: 25990000, inventory: 14 },
    ],
    tags: ['benq', 'designer', 'color-accurate'],
  },

  // ---- Storage -----------------------------------------------------------
  {
    name: 'Seagate BarraCuda 4TB HDD',
    slug: 'seagate-barracuda-4tb-hdd',
    images: [
      'https://m.media-amazon.com/images/I/71V1jd3s9dL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71s1Sdv4CEL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/91-ZZ7WGjNL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71MeWAEqCLL._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/41n+bV47yGL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61-60csvLgL._AC_SL1080_.jpg',
      'https://m.media-amazon.com/images/I/71jDeOfT8hL._AC_SL1080_.jpg',
      'https://m.media-amazon.com/images/I/61RBsORIayL._AC_SL1080_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/61-HsohPa4L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/91de3oIDNKL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71Etw--2wyL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71HzrIJCr8L._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/71ayR53urCL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71jyIVQyM6L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81p8dv-3LfL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71oXi08x5CL._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/51Cps60NQpL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61C1qwVNamL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/810kkuWpvLL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71jjVeUc0DL._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/71pz2njkNRL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81iEg46f+yL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/914OFsiHnuL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/818aW-ERYRL._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/51jSapFsaWL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71on77A9qcL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/7104SfP4HIL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71ZcscXhy-L._AC_SL1500_.jpg',
    ],
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
    name: 'Anker 575 USB-C Docking Station (13-in-1)',
    slug: 'anker-575-usb-c-docking-station-13-in-1',
    images: [
      'https://cdn.shopify.com/s/files/1/0493/9834/9974/products/666.png?v=1756800781',
      'https://cdn.shopify.com/s/files/1/0493/9834/9974/files/A83921A1_Rich_image_TD02_EN_V2.jpg?v=1764735579',
      'https://cdn.shopify.com/s/files/1/0493/9834/9974/files/A83921A1_Rich_image_TD05_EN_V2.jpg?v=1764735579',
      'https://cdn.shopify.com/s/files/1/0493/9834/9974/files/A83921A1_Rich_image_TD08_EN_V2.jpg?v=1764735579',
    ],
    brand: 'Anker',
    category: 'accessories',
    isNewArrival: true,
    description: [
      'The Anker 575 expands a single laptop USB-C port into 13 workstation ports.',
      'Dual HDMI and DisplayPort outputs drive up to three 1080p60 external monitors.',
      'Simultaneous 85W upstream laptop pass-through and 18W USB-C Power Delivery.',
      'Includes 10Gbps USB-C data, three USB-A ports, Gigabit Ethernet and 3.5mm audio.',
      'Built-in SD and microSD UHS-I card readers transfer media at up to 104MB/s.',
      'Vertical aluminum desktop footprint keeps workstation cables organized.',
    ].join('\n'),
    variants: [
      { name: '13-in-1 / 85W Host Pass-Through', sku: 'ANK-575-13IN1', price: 3490000, comparePrice: 3990000, inventory: 68 },
      { name: '13-in-1 + 40Gbps USB4 Cable Bundle', sku: 'ANK-575-13IN1-PRO', price: 4490000, comparePrice: null, inventory: 42 },
    ],
    tags: ['anker', 'dock', 'usbc'],
  },
  {
    name: 'CalDigit TS4 Thunderbolt Dock',
    slug: 'caldigit-ts4-thunderbolt-dock',
    images: [
      'https://m.media-amazon.com/images/I/61RBOqHLI0L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71YqWcZ8ufL._AC_SL1250_.jpg',
      'https://m.media-amazon.com/images/I/612R7T6l3mL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71gk7GAoDaL._AC_SL1500_.jpg',
    ],
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
    images: [
      'https://m.media-amazon.com/images/I/71pNZrEkYWL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61USbMWIgRL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61brLi6S5cL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71iusJDvlgL._AC_SL1500_.jpg',
    ],
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
  {
    name: 'HP ZBook Studio G10 Workstation',
    slug: 'hp-zbook-studio-g10-workstation',
    images: [
      'https://m.media-amazon.com/images/I/71rMQHAnahL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71smTXcTVuL._AC_SL1254_.jpg',
      'https://m.media-amazon.com/images/I/71jzfHSA5dL._AC_SL1254_.jpg',
      'https://m.media-amazon.com/images/I/71A0ssC7yEL._AC_SL1254_.jpg',
    ],
    brand: 'HP',
    category: 'laptops',
    description: [
      'Engineered for CAD and 3D pipelines in a slim aluminium chassis.',
      'Intel Core i9 H-series processor sustains high all-core clock speeds.',
      'DreamColor 4K display ships with Pantone-validated colour presets.',
      'VaporForce cooling routes heat away from the palm rest under load.',
      'Dual Thunderbolt 4 ports connect high-speed RAID arrays and displays.',
      'ISV-certified drivers ensure stability in Blender, AutoCAD and Maya.',
    ].join('\n'),
    variants: [
      { name: 'i7 / 32GB / 1TB / RTX 2000 Ada', sku: 'HP-ZBS10-I7-32', price: 44990000, comparePrice: 48990000, inventory: 15 },
      { name: 'i9 / 64GB / 2TB / RTX 4000 Ada', sku: 'HP-ZBS10-I9-64', price: 62990000, comparePrice: null, inventory: 8 },
    ],
    tags: ['hp', 'workstation', 'creator'],
  },
  {
    name: 'ASUS ProArt Display PA279CRV',
    slug: 'asus-proart-display-pa279crv',
    images: [
      'https://m.media-amazon.com/images/I/91dkLCfM8dL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/712-CXJj6oL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71PpaJoDtQL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81cDU1dWeKL._AC_SL1500_.jpg',
    ],
    brand: 'ASUS',
    category: 'monitors',
    description: [
      'A 27-inch 4K UHD IPS monitor designed for studio editors and photographers.',
      'Covers 99% DCI-P3 and 99% Adobe RGB colour spaces with 10-bit depth.',
      'Calman Verified factory calibration achieves Delta E below 2.',
      'USB-C port delivers DisplayPort signal, data transfers and 96W charging.',
      'Daisy-chain DisplayPort output simplifies multi-monitor desk setups.',
      'Ergonomic stand supports full height, tilt, swivel and 90-degree pivot.',
    ].join('\n'),
    variants: [
      { name: '27" / 4K / 96W USB-C', sku: 'ASU-PA279CRV', price: 13490000, comparePrice: 14990000, inventory: 29 },
      { name: '32" / 4K / 96W USB-C', sku: 'ASU-PA329CRV', price: 17990000, comparePrice: null, inventory: 17 },
    ],
    tags: ['asus', 'designer', 'usb-c'],
  },
  {
    name: 'SanDisk Extreme PRO Portable SSD V2',
    slug: 'sandisk-extreme-pro-portable-ssd-v2',
    images: [
      'https://m.media-amazon.com/images/I/71Sk-mD8mlL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/810ivFLJD0L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71q+ZrYKXyL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81cB7E7VuTL._AC_SL1500_.jpg',
    ],
    brand: 'SanDisk',
    category: 'storage',
    description: [
      'Forged aluminium chassis acts as a heatsink to sustain 2000MB/s transfers.',
      'NVMe solid state performance handles direct 4K ProRes editing from the drive.',
      'Three-meter drop protection and IP65 water and dust resistance for field work.',
      '256-bit AES hardware encryption protects sensitive project files.',
      'Includes both USB-C to USB-C and USB-C to USB-A braided cables.',
      'Integrated carabiner loop secures the drive to camera bags and backpacks.',
    ].join('\n'),
    variants: [
      { name: '2TB / 2000MB/s', sku: 'SND-EXPRO-2T', price: 4690000, comparePrice: 5290000, inventory: 64 },
      { name: '4TB / 2000MB/s', sku: 'SND-EXPRO-4T', price: 8290000, comparePrice: null, inventory: 31 },
    ],
    tags: ['sandisk', 'portable', 'nvme'],
  },
  {
    name: 'Razer Huntsman V3 Pro TKL',
    slug: 'razer-huntsman-v3-pro-tkl',
    images: [
      'https://m.media-amazon.com/images/I/81zUBZKswJL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81j4GVC09OL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71zcVPsfA-L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71LbGMeSYvL._AC_SL1500_.jpg',
    ],
    brand: 'Razer',
    category: 'peripherals',
    description: [
      'Second-generation Razer Analog Optical Switches allow Rapid Trigger mode.',
      'Adjustable actuation range from 0.1mm to 4.0mm tuned directly on the board.',
      'Tenkeyless layout frees desk space for low-sensitivity mouse movement.',
      'Textured doubleshot PBT keycaps resist shine through years of heavy use.',
      'Brushed aircraft-grade aluminium top plate prevents deck flex.',
      'Magnetic leatherette wrist rest snaps cleanly to the front edge.',
    ].join('\n'),
    variants: [
      { name: 'TKL / Black', sku: 'RZR-HV3P-TKL-BLK', price: 5490000, comparePrice: 5990000, inventory: 42 },
      { name: 'TKL / White Edition', sku: 'RZR-HV3P-TKL-WHT', price: 5690000, comparePrice: null, inventory: 27 },
    ],
    tags: ['razer', 'keyboard', 'esports'],
  },
  {
    name: 'TwelveSouth BookArc Flex Vertical Stand',
    slug: 'twelvesouth-bookarc-flex-vertical-stand',
    images: [
      'https://m.media-amazon.com/images/I/51Tepm-v3zL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71qukwp9Z-L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61ZT2YTd2KL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61kN0ZsLeoL._AC_SL1500_.jpg',
    ],
    brand: 'TwelveSouth',
    category: 'accessories',
    description: [
      'Cradles your laptop vertically to reclaim desk space in clamshell mode.',
      'Spring-loaded steel mechanism adjusts automatically to notebooks up to 1 inch.',
      'Non-slip silicone interior cushions the aluminium lid without marking it.',
      'Elevates the chassis off the desk surface to prevent accidental liquid spills.',
      'Rear cable catch keeps USB-C and power leads from dropping behind the desk.',
      'Minimal architectural profile pairs naturally with studio monitors.',
    ].join('\n'),
    variants: [
      { name: 'Matte Black', sku: 'TWS-BAF-BLK', price: 1490000, comparePrice: 1690000, inventory: 95 },
      { name: 'Birch White', sku: 'TWS-BAF-WHT', price: 1490000, comparePrice: null, inventory: 80 },
    ],
    tags: ['twelvesouth', 'stand', 'desk'],
  },
];

const CATEGORIES = [
  { name: 'Laptops', slug: 'laptops', description: 'Apple MacBook Pro M5, MacBook Air M5, MacBook Neo & flagship portable workstations.', image: 'https://macone.vn/wp-content/uploads/2025/09/MacBook_Pro_14-in_M5_Pro_Space_Black_PDP_Image_Position_1__VN-VI-768x768.jpg' },
  { name: 'Components', slug: 'components', description: 'Apple Mac Studio, Mac mini, iMac 24", Mac Pro & flagship desktop hardware.', image: 'https://macone.vn/wp-content/uploads/2026/08/Mac_Studio_M5_Max_Aug26_PDP_Image_Position_1__VN-VI-768x768.jpg' },
  { name: 'Monitors', slug: 'monitors', description: 'Apple Studio Display XDR, Pro Display XDR & colour-accurate 5K/6K studio displays.', image: 'https://macone.vn/wp-content/uploads/2026/03/Studio_Display_XDR_PDP_Image_Position_1__VN-VI-768x768.jpg' },
  { name: 'Storage', slug: 'storage', description: 'Apple Mac Pro & Mac Studio SSD upgrade kits, Thunderbolt 5 NVMe & studio RAID.', image: 'https://macone.vn/wp-content/uploads/2026/08/Mac_Studio_M5_Ultra_Aug26_PDP_Image_Position_1__VN-VI-768x768.jpg' },
  { name: 'Peripherals', slug: 'peripherals', description: 'Apple Magic Keyboard Touch ID, Magic Trackpad, Magic Mouse & studio desk gear.', image: 'https://macone.vn/wp-content/uploads/2024/12/MXK83_AV1.jpeg' },
  { name: 'Accessories', slug: 'accessories', description: 'Apple Thunderbolt 5 Pro docks, braided cables, USB-C hubs & workspace stands.', image: 'https://macone.vn/wp-content/uploads/2023/12/MU2G3.jpeg' },
];

const DISCOUNTS = [
  { code: 'AEV10', description: '10% off your order', discountType: 'percentage', discountValue: 10, maxUses: 10 },
  { code: 'SAV20', description: '20% off orders over 5,000,000 VND', discountType: 'percentage', discountValue: 20, maxUses: 10 },
  { code: 'NEW50', description: '500,000 VND off for new customers', discountType: 'fixed', discountValue: 500000, maxUses: 10 },
  { code: 'VIP15', description: '15% off shipping-inclusive orders', discountType: 'percentage', discountValue: 15, maxUses: 10 },
  { code: 'PRO1M', description: '1,000,000 VND off premium hardware', discountType: 'fixed', discountValue: 1000000, maxUses: 10 },
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
  const macbookProM3 = PRODUCTS.find((p) => p.slug === 'macbook-pro-m3');
  const otherBaseProducts = PRODUCTS.filter((p) => p.slug !== 'macbook-pro-m3');
  const appleNonLaptops = APPLE_PRODUCTS_2026.filter((p) => p.category !== 'laptops');
  const appleLaptops = APPLE_PRODUCTS_2026.filter((p) => p.category === 'laptops');
  // Order ensures:
  // 1) In every category (Accessories, Storage, Peripherals, Monitors, Components, Laptops),
  //    Apple products have the newest timestamps and appear first on Page 1.
  // 2) All 12 Apple MacBook laptops (including macbook-pro-m3) are the 12 newest items overall.
  const allProducts = [
    ...NEW_PRODUCTS_2026,
    ...otherBaseProducts,
    ...appleNonLaptops,
    ...appleLaptops.slice(0, 1),
    ...(macbookProM3 ? [macbookProM3] : []),
    ...appleLaptops.slice(1),
  ];
  const baseTime = Date.now() - allProducts.length * 60000;

  for (const [idx, p] of allProducts.entries()) {
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
        createdAt: new Date(baseTime + idx * 60000),
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
    const imageUrls = Array.isArray(p.images) && p.images.length >= 3
      ? p.images
      : (GALLERY_SEEDS[p.category] || GALLERY_SEEDS.laptops).slice(0, 4).map((seed) => IMG(seed));
    await prisma.productImage.createMany({
      data: imageUrls.map((url, i) => ({
        productId: product.id,
        url,
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

  // Deterministic spread: one review on most products, flagship Apple & hero products get more.
  const hotSlugs = new Set([
    'macbook-pro-16-m5-max-2026',
    'macbook-pro-14-m5-pro-max-2026',
    'macbook-pro-14-m5-2025',
    'macbook-air-13-m5-2026',
    'macbook-air-15-m5-2026',
    'macbook-neo-13-a18-pro-2026',
    'macbook-pro-m3',
    'apple-studio-display-xdr-27-5k-2026',
    'apple-mac-studio-m5-max-ultra-2026',
    'apple-mac-mini-m5-pro-2026',
    'apple-magic-keyboard-touch-id-numeric-usbc',
    'apple-magic-desktop-studio-kit-usbc',
    'nvidia-geforce-rtx-4090-founders-edition',
    'dell-ultrasharp-u2723qe',
  ]);
  const hot = new Set(products.filter((p) => hotSlugs.has(p.slug)).map((p) => p.id));
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

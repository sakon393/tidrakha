// Brands, categories and size lists. Each size label is drawn on the photo exactly as written.
(function (root) {
  const SNEAKER_SIZES = [
    'UK3.5/36/22cm', 'UK4/36.5/22.5cm', 'UK4.5/37.5/23cm', 'UK5/38/23.5cm', 'UK5.5/38.5/24cm',
    'UK6/39.5/24.5cm', 'UK6.5/40/25cm', 'UK7/40.5/25.5cm', 'UK7.5/41.5/26cm', 'UK8/42/26.5cm',
    'UK8.5/42.5/27cm', 'UK9/43.5/27.5cm', 'UK9.5/44/28cm', 'UK10/44.5/28.5cm', 'UK10.5/45.5/29cm',
    'UK11/46/29.5cm', 'UK11.5/46.5/30cm', 'UK12/47.5/30.5cm',
  ];
  const SANDAL_SIZES = [
    'UK4 EU37 CM22.5', 'UK5 EU38 CM23.5', 'UK6 EU39 CM24.5', 'UK7 EU40.5 CM25.5', 'UK8 EU42 CM26.5',
    'UK9 EU43 CM27.5', 'UK10 EU44.5 CM28.5', 'UK11 EU46 CM29.5', 'UK12 EU47 CM30.5',
  ];
  // Built from one size and measurement that the user types in.
  const CLOTHES_CHART = {
    names: ['2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    step: 2,
    kinds: {
      top: { name: 'เสื้อ', word: 'อก' },
      bottom: { name: 'กางเกง', word: 'เอว' },
      custom: { name: 'ไซส์พิเศษ' },   // typed by hand, as many lines as needed
    },
  };
  const SOCK_SIZES = [
    'KXS(16-18)', 'KS(19-21)', 'KM(22-24)', 'KL(25-27)', 'KXL(28-30)', 'KXXL(31-33)',
    'XS(34-36)', 'S(37-39)', 'M(40-42)', 'L(43-45)', 'XL(46-48)',
  ];

  // layout: 'table' = small left-aligned rows, 'list' = large centred rows.
  // bottom: lower edge of the size box on the 1080px photo.
  const ADIDAS_CATEGORIES = [
    { id: 'sneakers', name: 'รองเท้าผ้าใบ', icon: '👟', sizes: SNEAKER_SIZES, layout: 'table', bottom: 1032 },
    { id: 'sandals', name: 'รองเท้าแตะ', icon: '🩴', sizes: SANDAL_SIZES, layout: 'table', bottom: 1032 },
    { id: 'clothes', name: 'เสื้อผ้า', icon: '👕', sizes: [], sizeChart: CLOTHES_CHART, layout: 'list', bottom: 982 },
    { id: 'socks', name: 'ถุงเท้า', icon: '🧦', sizes: SOCK_SIZES, layout: 'list', bottom: 1032 },
    { id: 'bags', name: 'กระเป๋า', icon: '🎒', sizes: [] },
    { id: 'hats', name: 'หมวก', icon: '🧢', sizes: [] },
  ];

  const PUMA_SANDAL_SIZES = [
    'UK3 EU36 CM22', 'UK4 EU37 CM23', 'UK5 EU38 CM24', 'UK6 EU39 CM25', 'UK7 EU40.5 CM26',
    'UK8 EU42 CM27', 'UK9 EU43 CM28', 'UK10 EU44.5 CM29', 'UK11 EU46 CM30', 'UK12 EU47 CM31',
  ];
  const PUMA_SHOE_SIZES = [
    'UK3 | 35.5 | 22CM', 'UK3.5 | 36 | 22.5CM', 'UK4 | 37 | 23CM', 'UK4.5 | 37.5 | 23.5CM',
    'UK5 | 38 | 24CM', 'UK5.5 | 38.5 | 24.5CM', 'UK6 | 39 | 25CM', 'UK6.5 | 40 | 25.5CM',
    'UK7 | 40.5 | 26CM', 'UK7.5 | 41 | 26.5CM', 'UK8 | 42 | 27CM', 'UK8.5 | 42.5 | 27.5CM',
    'UK9 | 43 | 28CM', 'UK9.5 | 44 | 28.5CM', 'UK10 | 44.5 | 29CM', 'UK10.5 | 45 | 29.5CM',
    'UK11 | 46 | 30CM', 'UK11.5 | 46.5 | 30.5CM', 'UK12 | 47 | 31CM',
  ];
  const PUMA_SIZES = { sneakers: PUMA_SHOE_SIZES, sandals: PUMA_SANDAL_SIZES };
  const PUMA_CATEGORIES = ADIDAS_CATEGORIES.map((c) => (PUMA_SIZES[c.id] ? { ...c, sizes: PUMA_SIZES[c.id] } : c));

  const NIKE_MEN_SHOE_SIZES = [
    'US 5 EU 37.5 CM 23.5', 'US 5.5 EU 38 CM 24', 'US 6 EU 38.5 CM 24', 'US 6.5 EU 39 CM 24.5',
    'US 7 EU 40 CM 25', 'US 7.5 EU 40.5 CM 25.5', 'US 8 EU 41 CM 26', 'US 8.5 EU 42 CM 26.5',
    'US 9 EU 42.5 CM 27', 'US 9.5 EU 43 CM 27.5', 'US 10 EU 44 CM 28', 'US 10.5 EU 44.5 CM 28.5',
    'US 11 EU 45 CM 29', 'US 11.5 EU 45.5 CM 29.5', 'US 12 EU 46 CM 30', 'US 12.5 EU 46.5 CM 30.5',
    'US 13 EU 47.5 CM 31',
  ];
  const NIKE_WOMEN_SHOE_SIZES = [
    'US 5 EU 35.5 CM 22', 'US 5.5 EU 36 CM 22.5', 'US 6 EU 36.5 CM 23', 'US 6.5 EU 37.5 CM 23.5',
    'US 7 EU 38 CM 24', 'US 7.5 EU 38.5 CM 24.5', 'US 8 EU 39 CM 25', 'US 8.5 EU 40 CM 25.5',
    'US 9 EU 40.5 CM 26', 'US 9.5 EU 41 CM 26.5', 'US 10 EU 42 CM 27', 'US 10.5 EU 42.5 CM 27.5',
    'US 11 EU 43 CM 28', 'US 11.5 EU 44 CM 28.5', 'US 12 EU 44.5 CM 29',
  ];
  const NIKE_MEN_SANDAL_SIZES = [
    'US 5 EU 37.5 CM 23.5', 'US 6 EU 38.5 CM 24', 'US 7 EU 40 CM 25', 'US 8 EU 41 CM 26',
    'US 9 EU 42.5 CM 27', 'US 10 EU 44 CM 28', 'US 11 EU 45 CM 29', 'US 12 EU 46 CM 30',
  ];
  const NIKE_WOMEN_SANDAL_SIZES = [
    'US 5 EU 35.5 CM 22', 'US 6 EU 36.5 CM 23', 'US 7 EU 38 CM 24', 'US 8 EU 39 CM 25',
    'US 9 EU 40.5 CM 26', 'US 10 EU 42 CM 27', 'US 11 EU 43 CM 28', 'US 12 EU 44.5 CM 29',
  ];
  // sizeSets: lists to choose between on the size panel; the first is the default.
  const menWomen = (men, women) => ({
    sizes: men,
    sizeSets: [
      { id: 'men', name: 'ผู้ชาย', sizes: men },
      { id: 'women', name: 'ผู้หญิง', sizes: women },
    ],
  });
  const NIKE_SIZES = {
    sneakers: menWomen(NIKE_MEN_SHOE_SIZES, NIKE_WOMEN_SHOE_SIZES),
    sandals: menWomen(NIKE_MEN_SANDAL_SIZES, NIKE_WOMEN_SANDAL_SIZES),
  };
  const NIKE_CATEGORIES = ADIDAS_CATEGORIES.map((c) => (NIKE_SIZES[c.id] ? { ...c, ...NIKE_SIZES[c.id] } : c));

  const BRANDS = [
    { id: 'adidas', name: 'adidas', categories: ADIDAS_CATEGORIES },
    { id: 'puma', name: 'PUMA', categories: PUMA_CATEGORIES },
    // Same as adidas except sneakers and sandals, which have men's and women's sizes.
    { id: 'nike', name: 'NIKE', categories: NIKE_CATEGORIES },
    { id: 'ccoo', name: 'CCOO', categories: null },
  ];

  root.Catalog = { BRANDS };
})(globalThis);

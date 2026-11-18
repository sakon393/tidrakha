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

  // Brand marks from Simple Icons (CC0), drawn on a 24 × 24 box.
  const LOGOS = {
    adidas: 'm24 19.535-8.697-15.07-4.659 2.687 7.145 12.383Zm-8.287 0L9.969 9.59 5.31 12.277l4.192 7.258ZM4.658 14.723l2.776 4.812H1.223L0 17.41Z',
    puma: 'M23.845 3.008c-.417-.533-1.146-.106-1.467.08-2.284 1.346-2.621 3.716-3.417 5.077-.626 1.09-1.652 1.89-2.58 1.952-.686.049-1.43-.084-2.168-.405-1.807-.781-2.78-1.792-3.017-1.97-.487-.37-4.23-4.015-7.28-4.164 0 0-.372-.75-.465-.763-.222-.025-.45.451-.616.501-.15.053-.413-.512-.565-.487-.153.02-.302.586-.6.877-.22.213-.486.2-.637.463-.052.096-.034.265-.093.42-.127.32-.551.354-.555.697 0 .381.357.454.669.72.248.212.265.362.554.461.258.088.632-.187.964-.088.277.081.543.14.602.423.054.256 0 .658-.34.613-.112-.015-.598-.174-1.198-.11-.725.077-1.553.309-1.634 1.11-.041.447.514.97 1.055.866.371-.071.196-.506.399-.716.267-.27 1.772.944 3.172.944.593 0 1.031-.15 1.467-.605.04-.029.093-.102.155-.11a.632.632 0 01.195.088c1.131.897 1.984 2.7 6.13 2.721.582.007 1.25.279 1.796.777.48.433.764 1.125 1.037 1.825.418 1.053 1.161 2.069 2.292 3.203.06.068.99.78 1.06.833.012.01.084.167.053.255-.02.69-.123 2.67 1.365 2.753.366.02.275-.231.275-.41-.005-.341-.065-.685.113-1.04.253-.478-.526-.709-.509-1.756.019-.784-.645-.651-.984-1.25-.19-.343-.368-.532-.35-.946.073-2.38-.517-3.948-.805-4.327-.227-.294-.423-.403-.207-.54 1.24-.815 1.525-1.574 1.525-1.574.66-1.541 1.256-2.945 2.075-3.57.166-.12.589-.44.852-.56.763-.362 1.173-.578 1.388-.788.356-.337.635-1.053.294-1.48z',
    nike: 'M24 7.8L6.442 15.276c-1.456.616-2.679.925-3.668.925-1.12 0-1.933-.392-2.437-1.177-.317-.504-.41-1.143-.28-1.918.13-.775.476-1.6 1.036-2.478.467-.71 1.232-1.643 2.297-2.8a6.122 6.122 0 00-.784 1.848c-.28 1.195-.028 2.072.756 2.632.373.261.886.392 1.54.392.522 0 1.11-.084 1.764-.252L24 7.8z',
  };

  const BRANDS = [
    { id: 'adidas', name: 'adidas', logo: LOGOS.adidas, categories: ADIDAS_CATEGORIES },
    { id: 'puma', name: 'PUMA', logo: LOGOS.puma, categories: PUMA_CATEGORIES },
    // Same as adidas except sneakers and sandals, which have men's and women's sizes.
    { id: 'nike', name: 'NIKE', logo: LOGOS.nike, categories: NIKE_CATEGORIES },
    { id: 'ccoo', name: 'CCOO', categories: null },
  ];

  root.Catalog = { BRANDS };
})(globalThis);

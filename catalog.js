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
  const CLOTHES_SIZES = ['S เอว 28', 'M เอว 30', 'L เอว 32', 'XL เอว 34', '2XL เอว 36'];
  const SOCK_SIZES = ['XS(34-36)', 'S(37-39)', 'M(40-42)', 'L(43-45)', 'XL(46-48)'];

  // layout: 'table' = small left-aligned rows, 'list' = large centred rows.
  // bottom: lower edge of the size box on the 1080px photo.
  const ADIDAS_CATEGORIES = [
    { id: 'sneakers', name: 'รองเท้าผ้าใบ', sizes: SNEAKER_SIZES, layout: 'table', bottom: 1032 },
    { id: 'sandals', name: 'รองเท้าแตะ', sizes: SANDAL_SIZES, layout: 'table', bottom: 1032 },
    { id: 'clothes', name: 'เสื้อผ้า', sizes: CLOTHES_SIZES, layout: 'list', bottom: 982 },
    { id: 'socks', name: 'ถุงเท้า', sizes: SOCK_SIZES, layout: 'list', bottom: 1032 },
    { id: 'bags', name: 'กระเป๋า', sizes: [] },
    { id: 'hats', name: 'หมวก', sizes: [] },
  ];

  const BRANDS = [
    { id: 'adidas', name: 'adidas', categories: ADIDAS_CATEGORIES },
    { id: 'puma', name: 'PUMA', categories: null },
    { id: 'nike', name: 'NIKE', categories: null },
    { id: 'ccoo', name: 'CCOO', categories: null },
  ];

  root.Catalog = { BRANDS };
})(globalThis);

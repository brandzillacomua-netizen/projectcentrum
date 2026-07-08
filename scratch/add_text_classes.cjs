const fs = require('fs');
const filePath = 'a:/centrum/src/modules/PackagingModule.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add classes to paragraph tags
content = content.replace(
  `                    <p style={{ margin: 0, color: '#555', fontSize: '1rem', fontWeight: 600 }}>Замовник: <strong style={{ color: '#888' }}>{activeBatchData.customer}</strong></p>
                    <p style={{ margin: '4px 0 0 0', color: '#555', fontSize: '1rem', fontWeight: 600 }}>Виріб: <strong style={{ color: '#ff9000' }}>{activeBatchData.productNames}</strong></p>`,
  `                    <p className="detail-customer-text" style={{ margin: 0, color: '#555', fontSize: '1rem', fontWeight: 600 }}>Замовник: <strong style={{ color: '#888' }}>{activeBatchData.customer}</strong></p>
                    <p className="detail-product-text" style={{ margin: '4px 0 0 0', color: '#555', fontSize: '1rem', fontWeight: 600 }}>Виріб: <strong style={{ color: '#ff9000' }}>{activeBatchData.productNames}</strong></p>`
);

// Add styling inside media query
content = content.replace(
  `.order-detail-title {
            font-size: 1.2rem !important; /* Make title much smaller */
          }`,
  `.order-detail-title {
            font-size: 1.2rem !important; /* Make title much smaller */
          }
          .detail-customer-text, .detail-product-text {
            font-size: 0.8rem !important;
          }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added text classes and mobile styles!');
